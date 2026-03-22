import { spawn } from "child_process";
import type { ChildProcess } from "child_process";

/**
 * On Windows, package manager commands (npm, npx, node, etc.) are installed as .cmd batch
 * files which cannot be spawned directly — they require shell:true to run via cmd.exe.
 * We resolve to the .cmd name and set shell:true only for those commands, leaving native
 * executables (git, etc.) unaffected.
 */
// "node" is intentionally excluded — it ships as node.exe (a native binary), not a .cmd wrapper.
// Only package-manager launcher scripts that are .cmd files need shell:true.
const WINDOWS_CMD_COMMANDS = new Set(["npm", "npx", "pnpm", "yarn", "bun"]);
function resolveCommand(cmd: string): { command: string; shell: boolean } {
  if (process.platform === "win32" && WINDOWS_CMD_COMMANDS.has(cmd)) {
    return { command: `${cmd}.cmd`, shell: true };
  }
  return { command: cmd, shell: false };
}

/**
 * When spawn is called with shell:true, args are joined with spaces without quoting.
 * On Windows cmd.exe this causes multi-word args to be word-split.
 * Wrap any arg that contains a space in double-quotes so the shell treats it as one token.
 */
function quoteArgsForShell(args: string[]): string[] {
  return args.map((a) => (a.includes(" ") ? `"${a}"` : a));
}

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

    const { command, shell } = resolveCommand(input.command);
    const rawArgs = input.args ?? [];
    const spawnArgs = shell ? quoteArgsForShell(rawArgs) : rawArgs;
    const child: ChildProcess = spawn(command, spawnArgs, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      shell
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
