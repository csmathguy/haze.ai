import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PrismaClient, WorkflowStepRun, Agent, Skill } from "@taxes/db";
import type { AgentStep, WorkflowRun } from "@taxes/shared";
import { parseStreamJson } from "./agent-step-stream-parser.js";
import type { TokenUsage } from "./agent-step-stream-parser.js";

/**
 * Step execution result emitted by the CLI (stream-json format).
 */
export interface StepExecutionOutput {
  readonly output: unknown;
  readonly tokenUsage?: TokenUsage;
  readonly durationMs?: number;
  readonly reasoning?: string;
}

/**
 * Effect emitted after step execution.
 */
export interface StepExecutionEffect {
  readonly type: "step-completed" | "step-failed";
  readonly stepRun: WorkflowStepRun;
  readonly reason?: string;
}

/**
 * Execution context passed to recordStepRun.
 */
interface ExecutionContext {
  readonly output: unknown;
  readonly tokenUsage?: TokenUsage;
  readonly durationMs: number;
  readonly reasoning?: string;
  readonly providerFamily: string;
  readonly runtimeKind: string;
}

/**
 * Executes agent steps by dispatching to the appropriate CLI subprocess.
 *
 * Supports:
 * - anthropic/claude-code-subagent via `claude -p "..." --output-format stream-json`
 * - openai/codex via `codex exec "..."`
 *
 * Validates output against step's outputSchema (Zod) and records full trace metadata.
 */
export class AgentStepExecutor {
  /**
   * Executes an agent step.
   *
   * @param db - Prisma client
   * @param run - Current workflow run state
   * @param step - Agent step definition
   * @returns Effect describing the step run completion or failure
   */
  async execute(
    db: PrismaClient,
    run: WorkflowRun,
    step: AgentStep
  ): Promise<StepExecutionEffect> {
    const startTime = Date.now();

    try {
      const effect = await this.executeStep(db, run, step);
      return effect;
    } catch (error) {
      return this.handleExecutionError(db, run, step, {
        startTime,
        error
      });
    }
  }

  private async executeStep(
    db: PrismaClient,
    run: WorkflowRun,
    step: AgentStep
  ): Promise<StepExecutionEffect> {
    const startTime = Date.now();

    // Load the agent from registry
    const agent = await db.agent.findUnique({
      where: { id: step.agentId }
    });

    if (!agent) {
      throw new Error(`Agent not found: ${step.agentId}`);
    }

    // Verify skills are allowed
    this.verifyAllowedSkills(agent, step);

    // Load skill definitions
    const skills = await db.skill.findMany({
      where: {
        id: {
          in: step.skillIds
        }
      }
    });

    // Build the prompt from skill definitions
    const prompt = this.buildPrompt(agent, skills, step, run);

    // Dispatch to correct CLI based on providerFamily and runtimeKind
    const providerFamily = step.providerFamily ?? "anthropic";
    const runtimeKind = step.runtimeKind ?? "claude-code-subagent";

    // Only support CLI-based runtimes; SDK-based is future extension
    if (runtimeKind === "api") {
      throw new Error(
        "SDK-based runtimeKind not yet implemented. Use claude-code-subagent or codex-subagent."
      );
    }

    // Spawn CLI and stream output
    const cliOutput = await this.spawnCli(
      runtimeKind,
      providerFamily,
      prompt,
      step.timeoutMs ?? 120000
    );

    // Parse stream-json output
    const parsed = parseStreamJson(cliOutput, step.outputSchema);

    const durationMs = Date.now() - startTime;

    // Create step run record
    const stepRun = await this.recordStepRun(db, run, step, {
      agent,
      skills,
      execution: {
        output: parsed.output,
        ...(parsed.tokenUsage !== undefined ? { tokenUsage: parsed.tokenUsage } : {}),
        durationMs,
        ...(parsed.reasoning !== undefined ? { reasoning: parsed.reasoning } : {}),
        providerFamily,
        runtimeKind
      }
    });

    return {
      type: "step-completed",
      stepRun
    };
  }

  private verifyAllowedSkills(agent: Agent, step: AgentStep): void {
    const allowedSkillIds = agent.allowedSkillIds
      ? agent.allowedSkillIds.split(",").map((id) => id.trim())
      : [];

    // Verify all requested skills are allowed
    for (const skillId of step.skillIds) {
      if (!allowedSkillIds.includes(skillId) && allowedSkillIds.length > 0) {
        throw new Error(
          `Skill ${skillId} not allowed for agent ${agent.id}`
        );
      }
    }
  }

  private async handleExecutionError(
    db: PrismaClient,
    run: WorkflowRun,
    step: AgentStep,
    errorInfo: { startTime: number; error: unknown }
  ): Promise<StepExecutionEffect> {
    const durationMs = Date.now() - errorInfo.startTime;
    const errorMessage =
      errorInfo.error instanceof Error
        ? errorInfo.error.message
        : String(errorInfo.error);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const stepRun = await (db as any).workflowStepRun.create({
      data: {
        runId: run.id,
        stepId: step.id,
        stepType: "agent",
        nodeType: "agent",
        agentId: step.agentId,
        model: step.model,
        skillIds: step.skillIds.join(","),
        inputJson: JSON.stringify({
          step,
          runContext: run.contextJson
        }),
        errorJson: JSON.stringify({
          message: errorMessage,
          code: "AGENT_EXECUTION_ERROR",
          durationMs
        }),
        startedAt: new Date(),
        completedAt: new Date()
      }
    }) as WorkflowStepRun;

    return {
      type: "step-failed",
      stepRun,
      reason: errorMessage
    };
  }

  /**
   * Reads the SKILL.md file content from disk for a given skill name.
   */
  private readSkillContent(skillName: string): string {
    try {
      const skillPath = join(process.cwd(), "skills", skillName, "SKILL.md");
      return readFileSync(skillPath, "utf-8");
    } catch {
      return "";
    }
  }

  /**
   * Builds the prompt from skill definitions and step context.
   */
  private buildPrompt(
    agent: Agent,
    skills: Skill[],
    step: AgentStep,
    run: WorkflowRun
  ): string {
    // Build skills section with full SKILL.md content
    const skillsSection = skills.map((s) => {
      const content = this.readSkillContent(s.name);
      if (content) {
        return `## Skill: ${s.name}\n\n${content}`;
      }
      return `## Skill: ${s.name}\n${s.description ?? "No description"}`;
    }).join("\n\n---\n\n");

    // System prompt with agent context
    const systemPrompt = `You are an agent executing the following step in a workflow.

Agent: ${agent.name}
Step: ${step.label}
Model: ${step.model}

Available Skills:
${skillsSection}

Workflow Context:
${JSON.stringify(run.contextJson, null, 2)}

Please execute the requested tasks and return structured JSON output.`;

    // User prompt with step details
    const userPrompt = `Execute step "${step.label}" (${step.id}).

Requested Skills: ${step.skillIds.join(", ")}

Provide your response as JSON matching the output schema. Include reasoning in a "reasoning" field.`;

    // Combine for the full prompt (will be passed to claude -p or codex exec)
    return `${systemPrompt}\n\n---\n\n${userPrompt}`;
  }

  /**
   * Spawns the CLI subprocess and streams output.
   */
  private async spawnCli(
    runtimeKind: string,
    providerFamily: string,
    prompt: string,
    timeoutMs: number
  ): Promise<string[]> {
    const { command, args } = this.getCliCommandAndArgs(
      runtimeKind,
      providerFamily,
      prompt
    );

    return new Promise<string[]>((resolve, reject) => {
      let timedOut = false;
      const lines: string[] = [];
      let buffer = "";

      const child: ChildProcess = spawn(command, args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"]
      });

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        setTimeout(() => {
          child.kill("SIGKILL");
        }, 1000);
      }, timeoutMs);

      child.stdout?.on("data", (data: Buffer) => {
        buffer += data.toString();
        this.collectLines(buffer, lines);
        buffer = this.getRemaining(buffer);
      });

      child.on("close", (code: number | null) => {
        clearTimeout(timeoutHandle);

        // Flush remaining buffer
        if (buffer.trim()) {
          lines.push(buffer.trim());
        }

        if (timedOut) {
          reject(new Error("CLI subprocess timed out"));
        } else if (code !== 0) {
          const exitCode = String(code ?? "unknown");
          reject(new Error(`CLI subprocess exited with code ${exitCode}`));
        } else {
          resolve(lines);
        }
      });

      child.on("error", (err: Error) => {
        clearTimeout(timeoutHandle);
        reject(err);
      });
    });
  }

  private getCliCommandAndArgs(
    runtimeKind: string,
    providerFamily: string,
    prompt: string
  ): { command: string; args: string[] } {
    if (providerFamily === "anthropic" && runtimeKind === "claude-code-subagent") {
      return {
        command: "claude",
        args: ["-p", prompt, "--output-format", "stream-json"]
      };
    }
    if (providerFamily === "openai" && runtimeKind === "codex-subagent") {
      return {
        command: "codex",
        args: ["exec", prompt]
      };
    }

    throw new Error(
      `Unsupported provider/runtime combination: ${providerFamily}/${runtimeKind}`
    );
  }

  private collectLines(buffer: string, lines: string[]): void {
    const parts = buffer.split("\n");
    for (let i = 0; i < parts.length - 1; i += 1) {
      const line = parts[i]?.trim() ?? "";
      if (line) {
        lines.push(line);
      }
    }
  }

  private getRemaining(buffer: string): string {
    const parts = buffer.split("\n");
    return parts[parts.length - 1] ?? "";
  }


  /**
   * Records the step run in the database.
   */
  private async recordStepRun(
    db: PrismaClient,
    run: WorkflowRun,
    step: AgentStep,
    context: { agent: Agent; skills: Skill[]; execution: ExecutionContext }
  ): Promise<WorkflowStepRun> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    return (db as any).workflowStepRun.create({
      data: {
        runId: run.id,
        stepId: step.id,
        stepType: "agent",
        nodeType: "agent",
        agentId: step.agentId,
        model: step.model,
        skillIds: step.skillIds.join(","),
        inputJson: JSON.stringify({
          step: {
            id: step.id,
            label: step.label,
            skillIds: step.skillIds
          },
          runContext: run.contextJson,
          agent: {
            id: context.agent.id,
            name: context.agent.name,
            model: context.agent.model,
            tier: context.agent.tier
          }
        }),
        outputJson: JSON.stringify({
          output: context.execution.output,
          tokenUsage: context.execution.tokenUsage,
          durationMs: context.execution.durationMs,
          reasoning: context.execution.reasoning,
          providerFamily: context.execution.providerFamily,
          runtimeKind: context.execution.runtimeKind
        }),
        tokenUsageJson: context.execution.tokenUsage
          ? JSON.stringify({
              inputTokens: context.execution.tokenUsage.inputTokens ?? 0,
              outputTokens: context.execution.tokenUsage.outputTokens ?? 0,
              totalTokens: context.execution.tokenUsage.totalTokens ?? 0
            })
          : null,
        startedAt: new Date(),
        completedAt: new Date()
      }
    }) as Promise<WorkflowStepRun>;
  }
}
