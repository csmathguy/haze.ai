import type { ZodType } from "zod";

/**
 * Token usage information extracted from CLI output.
 */
export interface TokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

/**
 * Internal result from spawnCli containing parsed stream lines.
 */
export interface CliStreamResult {
  readonly output: unknown;
  readonly tokenUsage?: TokenUsage;
  readonly durationMs?: number;
  readonly reasoning?: string;
  readonly rawLines: string[];
}

/**
 * Parses stream-json formatted output from CLI execution.
 */
export function parseStreamJson(
  lines: string[],
  outputSchema: ZodType
): CliStreamResult {
  const rawLines = [...lines];
  const state: {
    output: unknown;
    tokenUsage?: TokenUsage;
    durationMs?: number;
    reasoning: string;
  } = {
    output: null,
    reasoning: ""
  };

  processStreamLines(lines, state);

  if (!state.output) {
    throw new Error("No output received from step execution");
  }

  // Validate output against schema if provided
  if (typeof outputSchema.parse === "function") {
    state.output = validateOutput(outputSchema, state.output);
  }

  const reasoning = state.reasoning.length > 0 ? state.reasoning : undefined;
  return {
    output: state.output,
    ...(state.tokenUsage !== undefined ? { tokenUsage: state.tokenUsage } : {}),
    ...(state.durationMs !== undefined ? { durationMs: state.durationMs } : {}),
    ...(reasoning !== undefined ? { reasoning } : {}),
    rawLines
  };
}

function processStreamLines(
  lines: string[],
  state: {
    output: unknown;
    tokenUsage?: TokenUsage;
    durationMs?: number;
    reasoning: string;
  }
): void {
  for (const line of lines) {
    const result = parseJsonLine(line);
    if (result.isJson && result.data) {
      processJsonMessage(result.data, state);
    } else if (line && !line.startsWith("{")) {
      state.reasoning = `${state.reasoning}\n${line}`;
    }
  }
}

/** Parse a string result from the CLI — try direct JSON, then extract last `{...}` block. */
function parseStringOutput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    const lastBrace = raw.lastIndexOf("{");
    if (lastBrace === -1) return raw;
    try {
      return JSON.parse(raw.slice(lastBrace));
    } catch {
      return raw;
    }
  }
}

function applyCompleteMessage(
  msg: Record<string, unknown>,
  state: { output: unknown; tokenUsage?: TokenUsage; durationMs?: number; reasoning: string }
): void {
  const raw = msg.output ?? msg.result;
  // Claude CLI emits the agent's text response as a string in msg.result.
  // If it looks like JSON, parse it so the output schema validator receives an object.
  if (typeof raw === "string") {
    state.output = parseStringOutput(raw);
  } else {
    state.output = raw;
  }
  const tokenUsage = msg.tokenUsage as TokenUsage | undefined;
  if (tokenUsage !== undefined) { state.tokenUsage = tokenUsage; }
  const durationMs = msg.durationMs as number | undefined;
  if (durationMs !== undefined) { state.durationMs = durationMs; }
  const reasoningVal = msg.reasoning;
  if (typeof reasoningVal === "string") { state.reasoning = reasoningVal; }
}

function processJsonMessage(
  msg: Record<string, unknown>,
  state: {
    output: unknown;
    tokenUsage?: TokenUsage;
    durationMs?: number;
    reasoning: string;
  }
): void {
  const msgType = msg.type;
  // "result" is the Claude CLI stream-json final event (--output-format stream-json).
  // "step-complete" / "complete" are legacy names kept for backward compatibility.
  if (msgType === "result" || msgType === "step-complete" || msgType === "complete") {
    applyCompleteMessage(msg, state);
  } else if (msgType === "text" || msgType === "chunk") {
    processTextChunk(msg, state);
  } else if (msgType === "error") {
    const message = msg.message;
    const errorMsg =
      typeof message === "string" ? message : "Unknown error";
    const error = new Error(`Step execution error: ${errorMsg}`);
    error.cause = new Error("Step execution error from stream");
    throw error;
  }
}

function processTextChunk(
  msg: Record<string, unknown>,
  state: { output: unknown; reasoning: string }
): void {
  // Accumulate text chunks if needed (for debugging)
  if (!state.output) {
    const content = msg.content;
    if (content && typeof content === "string") {
      state.reasoning = `${state.reasoning}${content}`;
    }
  }
}

function validateOutput(outputSchema: ZodType, output: unknown): unknown {
  try {
    return outputSchema.parse(output);
  } catch (validationError) {
    const message =
      validationError instanceof Error
        ? validationError.message
        : String(validationError);
    const error = new Error(`Output validation failed: ${message}`);
    error.cause = validationError instanceof Error ? validationError : new Error(String(validationError));
    throw error;
  }
}

function parseJsonLine(
  line: string
): { isJson: boolean; data?: Record<string, unknown> } {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    return { isJson: true, data: parsed };
  } catch {
    // Not JSON, treat as debug line
    return { isJson: false };
  }
}
