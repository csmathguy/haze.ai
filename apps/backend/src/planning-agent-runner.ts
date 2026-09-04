import { spawn, spawnSync } from "node:child_process";
import { readStringArray, type PlannerArtifactState, type PlannerTestingPlannedState } from "./task-planner-stage.js";
import type { TaskRecord } from "./tasks.js";

export interface PlanningAgentDecision {
  decision: "approved" | "needs_info";
  reasonCodes: string[];
  evaluationSource: "cli";
  planningArtifact?: PlannerArtifactState;
  testingPlanned?: PlannerTestingPlannedState;
  trace?: PlanningAgentExecutionTrace;
}

interface PlanningAgentRunnerOptions {
  command?: string;
  args?: string[];
  timeoutMs?: number;
}

export type PlanningAgentRunnerErrorCode =
  | "cli_unavailable"
  | "cli_execution_failed"
  | "cli_invalid_response"
  | "cli_timeout";

export class PlanningAgentRunnerError extends Error {
  constructor(
    message: string,
    public readonly code: PlanningAgentRunnerErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export interface PlanningAgentExecutionTrace {
  command: string;
  resolvedCommand: string;
  args: string[];
  prompt: string;
  rawResponse: string;
  stderr: string;
  parsedDecision: "approved" | "needs_info";
  parsedReasonCodes: string[];
}

const DEFAULT_COMMAND = "codex";
const DEFAULT_TIMEOUT_MS = 20_000;

export class PlanningAgentRunner {
  private readonly command: string;
  private readonly args: string[];
  private readonly timeoutMs: number;
  private readonly resolvedCommand: string | null;

  constructor(options?: PlanningAgentRunnerOptions) {
    this.command = options?.command ?? process.env.PLANNING_AGENT_COMMAND ?? DEFAULT_COMMAND;
    this.args = options?.args ?? [];
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.resolvedCommand = this.resolveCommandPath(this.command);
  }

  async evaluate(task: TaskRecord): Promise<PlanningAgentDecision> {
    return this.evaluateWithCli(task);
  }

  private async evaluateWithCli(task: TaskRecord): Promise<PlanningAgentDecision> {
    if (!this.isCommandAvailable()) {
      throw new PlanningAgentRunnerError(
        `planning agent CLI command not found: ${this.command}`,
        "cli_unavailable"
      );
    }

    const prompt = this.buildPrompt(task);
    let stdout = "";
    let stderr = "";
    try {
      const output = await this.runCommand(prompt);
      stdout = output.stdout;
      stderr = output.stderr;
    } catch (error) {
      if (error instanceof PlanningAgentRunnerError) {
        throw error;
      }
      throw new PlanningAgentRunnerError(
        `planning agent CLI execution failed: ${error instanceof Error ? error.message : String(error)}`,
        "cli_execution_failed",
        {
          command: this.resolvedCommand ?? this.command,
          args: this.args,
          prompt
        }
      );
    }

    const parsed = this.tryParseDecision(stdout);
    if (!parsed) {
      throw new PlanningAgentRunnerError(
        "planning agent CLI returned invalid response payload",
        "cli_invalid_response",
        {
          command: this.resolvedCommand ?? this.command,
          args: this.args,
          prompt,
          rawResponse: stdout,
          stderr
        }
      );
    }
    return {
      decision: parsed.decision,
      reasonCodes: parsed.reasonCodes,
      evaluationSource: "cli",
      planningArtifact: parsed.planningArtifact,
      testingPlanned: parsed.testingPlanned,
      trace: {
        command: this.command,
        resolvedCommand: this.resolvedCommand ?? this.command,
        args: [...this.args],
        prompt,
        rawResponse: stdout,
        stderr,
        parsedDecision: parsed.decision,
        parsedReasonCodes: parsed.reasonCodes
      }
    };
  }

  private isCommandAvailable(): boolean {
    return typeof this.resolvedCommand === "string" && this.resolvedCommand.length > 0;
  }

  private resolveCommandPath(command: string): string | null {
    const trimmed = command.trim();
    if (trimmed.length === 0) {
      return null;
    }
    const probe = process.platform === "win32" ? "where" : "which";
    const result = spawnSync(probe, [trimmed], { encoding: "utf8" });
    if (result.status !== 0) {
      return null;
    }
    const lines = result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      return null;
    }
    if (process.platform === "win32") {
      const exe = lines.find((line) => line.toLowerCase().endsWith(".exe"));
      if (exe) {
        return exe;
      }
      const cmd = lines.find((line) => {
        const normalized = line.toLowerCase();
        return normalized.endsWith(".cmd") || normalized.endsWith(".bat");
      });
      if (cmd) {
        return cmd;
      }
    }
    return lines[0] ?? null;
  }

  private runCommand(input: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const executable = this.resolvedCommand ?? this.command;
      const useShell =
        process.platform === "win32" &&
        (executable.toLowerCase().endsWith(".cmd") ||
          executable.toLowerCase().endsWith(".bat"));
      const child = spawn(executable, this.args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: useShell
      });

      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(
          new PlanningAgentRunnerError("planning agent CLI timed out", "cli_timeout", {
            command: this.command,
            resolvedCommand: executable,
            args: this.args,
            prompt: input
          })
        );
      }, this.timeoutMs);

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        if (code !== 0) {
          reject(
            new PlanningAgentRunnerError(
              `planning agent CLI failed with exit code ${code}: ${stderr.trim()}`,
              "cli_execution_failed",
              {
                command: this.command,
                resolvedCommand: executable,
                args: this.args,
                prompt: input,
                rawResponse: stdout,
                stderr
              }
            )
          );
          return;
        }
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim()
        });
      });

      child.stdin.write(input);
      child.stdin.end();
    });
  }

  private buildPrompt(task: TaskRecord): string {
    return JSON.stringify(
      {
        instruction:
          "Return strict JSON only with: decision (approved|needs_info), reasonCodes (string[]), optional planningArtifact {goals:string[],steps:string[],risks:string[]}, optional testingPlanned {gherkinScenarios:string[],unitTestIntent:string[],integrationTestIntent:string[],notes:string|null}.",
        task: {
          id: task.id,
          title: task.title,
          description: task.description,
          metadata: task.metadata
        }
      },
      null,
      2
    );
  }

  private tryParseDecision(raw: string): {
    decision: "approved" | "needs_info";
    reasonCodes: string[];
    planningArtifact?: PlannerArtifactState;
    testingPlanned?: PlannerTestingPlannedState;
  } | null {
    const candidate = raw.trim();
    if (!candidate) {
      return null;
    }

    const parsed = this.parseJsonCandidate(candidate) ?? this.parseJsonCandidate(this.extractJsonBlock(candidate));
    if (!parsed) {
      return null;
    }

    const decision = this.readString(parsed.decision);
    if (decision !== "approved" && decision !== "needs_info") {
      return null;
    }
    return {
      decision,
      reasonCodes: this.readStringArray(parsed.reasonCodes),
      planningArtifact: this.readPlanningArtifact(parsed.planningArtifact),
      testingPlanned: this.readTestingPlanned(parsed.testingPlanned)
    };
  }

  private parseJsonCandidate(raw: string): Record<string, unknown> | null {
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  private extractJsonBlock(raw: string): string {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return "";
    }
    return raw.slice(start, end + 1);
  }

  private readString(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readStringArray(value: unknown): string[] {
    return readStringArray(value);
  }

  private readPlanningArtifact(value: unknown): PlannerArtifactState | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    const candidate = value as Record<string, unknown>;
    const goals = this.readStringArray(candidate.goals);
    const steps = this.readStringArray(candidate.steps);
    const risks = this.readStringArray(candidate.risks);
    if (goals.length === 0 && steps.length === 0 && risks.length === 0) {
      return undefined;
    }
    return {
      createdAt: new Date().toISOString(),
      goals,
      steps,
      risks
    };
  }

  private readTestingPlanned(value: unknown): PlannerTestingPlannedState | undefined {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return undefined;
    }
    const candidate = value as Record<string, unknown>;
    const gherkinScenarios = this.readStringArray(candidate.gherkinScenarios);
    const unitTestIntent = this.readStringArray(candidate.unitTestIntent);
    const integrationTestIntent = this.readStringArray(candidate.integrationTestIntent);
    const notes = this.readString(candidate.notes);
    if (
      gherkinScenarios.length === 0 &&
      unitTestIntent.length === 0 &&
      integrationTestIntent.length === 0 &&
      notes === null
    ) {
      return undefined;
    }
    return {
      gherkinScenarios,
      unitTestIntent,
      integrationTestIntent,
      notes
    };
  }
}
