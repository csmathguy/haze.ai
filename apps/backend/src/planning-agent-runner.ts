import { spawn, spawnSync } from "node:child_process";
import type { TaskRecord } from "./tasks.js";

export interface PlanningAgentDecision {
  decision: "approved" | "needs_info";
  reasonCodes: string[];
  evaluationSource: "cli" | "heuristic";
  usedFallback: boolean;
}

interface PlanningAgentRunnerOptions {
  command?: string;
  args?: string[];
  timeoutMs?: number;
}

const DEFAULT_COMMAND = "codex";
const DEFAULT_TIMEOUT_MS = 20_000;

export class PlanningAgentRunner {
  private readonly command: string;
  private readonly args: string[];
  private readonly timeoutMs: number;

  constructor(options?: PlanningAgentRunnerOptions) {
    this.command = options?.command ?? DEFAULT_COMMAND;
    this.args = options?.args ?? [];
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async evaluate(task: TaskRecord): Promise<PlanningAgentDecision> {
    const cliResult = await this.evaluateWithCli(task);
    if (cliResult) {
      return cliResult;
    }

    const heuristic = this.evaluateWithHeuristic(task);
    return {
      ...heuristic,
      evaluationSource: "heuristic",
      usedFallback: true,
      reasonCodes: ["CLI_FALLBACK_USED", ...heuristic.reasonCodes]
    };
  }

  private async evaluateWithCli(task: TaskRecord): Promise<PlanningAgentDecision | null> {
    if (!this.isCommandAvailable(this.command)) {
      return null;
    }

    const prompt = this.buildPrompt(task);
    let stdout = "";
    try {
      stdout = await this.runCommand(prompt);
    } catch {
      return null;
    }

    const parsed = this.tryParseDecision(stdout);
    if (!parsed) {
      return null;
    }
    return {
      decision: parsed.decision,
      reasonCodes: parsed.reasonCodes,
      evaluationSource: "cli",
      usedFallback: false
    };
  }

  private evaluateWithHeuristic(task: TaskRecord): {
    decision: "approved" | "needs_info";
    reasonCodes: string[];
  } {
    const metadata = this.asRecord(task.metadata);
    const planningArtifact = this.asRecord(metadata.planningArtifact);
    const testingArtifacts = this.asRecord(metadata.testingArtifacts);
    const planned = this.asRecord(testingArtifacts.planned);
    const awaiting = this.asRecord(metadata.awaitingHumanArtifact);

    const reasons: string[] = [];
    if (this.readStringArray(metadata.acceptanceCriteria).length === 0) {
      reasons.push("MISSING_ACCEPTANCE_CRITERIA");
    }
    if (this.readStringArray(planningArtifact.goals).length === 0) {
      reasons.push("MISSING_PLANNING_GOALS");
    }
    if (this.readStringArray(planningArtifact.steps).length === 0) {
      reasons.push("MISSING_PLANNING_STEPS");
    }
    if (this.readStringArray(planned.gherkinScenarios).length === 0) {
      reasons.push("MISSING_GHERKIN_SCENARIOS");
    }
    if (this.readStringArray(planned.unitTestIntent).length === 0) {
      reasons.push("MISSING_UNIT_TEST_INTENT");
    }
    if (this.readStringArray(planned.integrationTestIntent).length === 0) {
      reasons.push("MISSING_INTEGRATION_TEST_INTENT");
    }
    if (this.readString(awaiting.question)) {
      reasons.push("AWAITING_HUMAN_OPEN");
    }

    return {
      decision: reasons.length === 0 ? "approved" : "needs_info",
      reasonCodes: [...new Set(reasons)]
    };
  }

  private isCommandAvailable(command: string): boolean {
    const probe = process.platform === "win32" ? "where" : "which";
    const result = spawnSync(probe, [command], { stdio: "ignore" });
    return result.status === 0;
  }

  private runCommand(input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.command, this.args, {
        stdio: ["pipe", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("planning_agent_cli_timeout"));
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
          reject(new Error(`planning_agent_cli_failed:${code}:${stderr.trim()}`));
          return;
        }
        resolve(stdout.trim());
      });

      child.stdin.write(input);
      child.stdin.end();
    });
  }

  private buildPrompt(task: TaskRecord): string {
    return JSON.stringify(
      {
        instruction:
          "Return strict JSON only with fields decision (approved|needs_info) and reasonCodes (string[]).",
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

  private tryParseDecision(raw: string): { decision: "approved" | "needs_info"; reasonCodes: string[] } | null {
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
      reasonCodes: this.readStringArray(parsed.reasonCodes)
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
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim());
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }
}
