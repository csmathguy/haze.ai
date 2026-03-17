import { spawn } from "child_process";
import type { ChildProcess } from "child_process";

export interface CommandStepInput {
  readonly stepId: string;
  readonly command: string;
  readonly args?: string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
  readonly timeoutMs?: number;
}

export interface CommandStepResult {
  readonly stepId: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly success: boolean;
}

const DEFAULT_TIMEOUT_MS = 30000;

export async function executeCommandStep(
  input: CommandStepInput
): Promise<CommandStepResult> {
  const startTime = Date.now();
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cwd = input.cwd ?? process.cwd();
  const env = {
    ...process.env,
    ...(input.env ?? {})
  };

  return new Promise<CommandStepResult>((resolve) => {
    let timedOut = false;
    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    const child: ChildProcess = spawn(input.command, input.args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      // Give process time to terminate gracefully
      setTimeout(() => {
        child.kill("SIGKILL");
      }, 1000);
    }, timeoutMs);

    child.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code: number | null) => {
      clearTimeout(timeoutHandle);
      const durationMs = Date.now() - startTime;

      // Use timeout exit code if process was killed due to timeout
      if (timedOut) {
        exitCode = -1;
      } else {
        exitCode = code ?? 0;
      }

      const success = exitCode === 0;

      resolve({
        stepId: input.stepId,
        exitCode,
        stdout,
        stderr,
        durationMs,
        success
      });
    });

    child.on("error", (err: Error) => {
      clearTimeout(timeoutHandle);
      const durationMs = Date.now() - startTime;

      stderr += `\nProcess error: ${err.message}`;

      resolve({
        stepId: input.stepId,
        exitCode: 1,
        stdout,
        stderr,
        durationMs,
        success: false
      });
    });
  });
}
