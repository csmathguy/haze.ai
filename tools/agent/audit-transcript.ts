import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import { findTranscriptArtifact } from "./lib/transcript-service.js";

/** Maximum characters to show for tool_use / thinking blocks before truncating. */
const TOOL_USE_TRUNCATE_CHARS = 200;

// ──────────────────────────────────────────────────────────────────────────────
// Session JSONL entry types
// ──────────────────────────────────────────────────────────────────────────────

interface TextContentPart {
  type: "text";
  text: string;
}

interface ThinkingContentPart {
  type: "thinking";
  thinking: string;
}

interface ToolUseContentPart {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface ToolResultContentPart {
  type: "tool_result";
  tool_use_id: string;
  content: SessionContentPart[] | string;
}

interface UnknownContentPart {
  type: string;
}

type SessionContentPart =
  | TextContentPart
  | ThinkingContentPart
  | ToolResultContentPart
  | ToolUseContentPart
  | UnknownContentPart;

interface SessionEntryMessage {
  role: string;
  content: SessionContentPart[] | string;
}

interface ConversationEntry {
  type: "assistant" | "user";
  message: SessionEntryMessage;
  uuid: string;
  timestamp: string;
}

interface OtherEntry {
  type: string;
}

type SessionEntry = ConversationEntry | OtherEntry;

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const runId = process.argv[2];

  if (runId === undefined || runId.trim().length === 0) {
    throw new Error("Usage: npm run audit:transcript:view <runId>");
  }

  const artifact = await findTranscriptArtifact(runId.trim());

  if (artifact === null) {
    throw new Error(`No transcript found for run ID: ${runId}`);
  }

  process.stdout.write(`Transcript: ${artifact.filePath}\n`);
  process.stdout.write(`Run ID:     ${artifact.runId}\n`);

  if (artifact.workItemId !== null) {
    process.stdout.write(`Work item:  ${artifact.workItemId}\n`);
  }

  process.stdout.write(`Captured:   ${artifact.capturedAt.toISOString()}\n`);

  if (artifact.lineCount !== null) {
    process.stdout.write(`Lines:      ${artifact.lineCount.toString()}\n`);
  }

  process.stdout.write("\n");
  process.stdout.write(`${"─".repeat(80)}\n\n`);

  await streamTranscript(artifact.filePath);
}

// ──────────────────────────────────────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────────────────────────────────────

async function streamTranscript(filePath: string): Promise<void> {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ crlfDelay: Infinity, input: stream });

  for await (const rawLine of rl) {
    const trimmed = rawLine.trim();

    if (trimmed.length === 0) {
      continue;
    }

    let entry: SessionEntry;

    try {
      entry = JSON.parse(trimmed) as SessionEntry;
    } catch {
      continue;
    }

    renderEntry(entry);
  }
}

function renderEntry(entry: SessionEntry): void {
  if (entry.type !== "user" && entry.type !== "assistant") {
    return;
  }

  const typed = entry as ConversationEntry;
  const role = typed.message.role.toUpperCase();
  const content = typed.message.content;

  process.stdout.write(`[${role}] ${typed.timestamp}\n`);

  if (typeof content === "string") {
    process.stdout.write(`${content}\n`);
  } else {
    for (const part of content) {
      renderContentPart(part);
    }
  }

  process.stdout.write("\n");
}

function truncate(text: string): string {
  return text.length > TOOL_USE_TRUNCATE_CHARS
    ? `${text.slice(0, TOOL_USE_TRUNCATE_CHARS)}…`
    : text;
}

function renderContentPart(part: SessionContentPart): void {
  if (isTextPart(part)) {
    process.stdout.write(`${part.text}\n`);
    return;
  }

  if (isThinkingPart(part)) {
    process.stdout.write(`<thinking> ${truncate(part.thinking)}\n`);
    return;
  }

  if (isToolUsePart(part)) {
    const inputStr = JSON.stringify(part.input);
    process.stdout.write(`<tool_use:${part.name}> ${truncate(inputStr)}\n`);
    return;
  }

  if (isToolResultPart(part)) {
    const resultContent = part.content;

    if (typeof resultContent === "string") {
      process.stdout.write(`<tool_result> ${truncate(resultContent)}\n`);
    } else {
      process.stdout.write(`<tool_result> [${resultContent.length.toString()} part(s)]\n`);
    }

    return;
  }

  process.stdout.write(`<${part.type}>\n`);
}

function isTextPart(part: SessionContentPart): part is TextContentPart {
  return part.type === "text";
}

function isThinkingPart(part: SessionContentPart): part is ThinkingContentPart {
  return part.type === "thinking";
}

function isToolUsePart(part: SessionContentPart): part is ToolUseContentPart {
  return part.type === "tool_use";
}

function isToolResultPart(part: SessionContentPart): part is ToolResultContentPart {
  return part.type === "tool_result";
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
