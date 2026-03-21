import {
  createWatchState,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_STALE_HEARTBEAT_MIN,
  isStale,
  minutesSinceHeartbeat,
  processEvents,
  readNewEvents,
  readRunEndStatus,
  resolveEventsPath,
  type WatchLine,
  type WatchOptions
} from "./lib/workflow-watch.js";

const GATE_PREFIX = "\x1b[33m⚑ APPROVAL GATE\x1b[0m";
const TS_WIDTH = 8; // HH:MM:SS

async function main(): Promise<void> {
  const { runId, options } = parseArgs();
  const eventsPath = resolveEventsPath(runId);
  const state = createWatchState(runId);

  process.stdout.write(
    `workflow:watch — following ${runId}\n` +
    `  events: ${eventsPath}\n` +
    `  stale-after: ${String(options.staleHeartbeatMin)}m  poll: ${String(options.pollIntervalMs / 1000)}s\n` +
    `  Press Ctrl+C to exit.\n\n`
  );

  setupSignals();
  await watchLoop(eventsPath, state, options);
}

function setupSignals(): void {
  process.on("SIGINT", () => {
    process.stdout.write("\nwatcher stopped.\n");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    process.exit(0);
  });
}

async function watchLoop(
  eventsPath: string,
  state: ReturnType<typeof createWatchState>,
  options: WatchOptions
): Promise<void> {
  for (;;) {
    const newEvents = await readNewEvents(eventsPath, state);
    const lines = processEvents(newEvents, state);

    for (const line of lines) {
      printLine(line);
    }

    if (isStale(state, options)) {
      const mins = minutesSinceHeartbeat(state);
      process.stderr.write(
        `\n[workflow:watch] No heartbeat received for ${String(mins)} minute(s) ` +
        `(threshold: ${String(options.staleHeartbeatMin)}m). The sub-agent may be stalled.\n` +
        `  Run: npm run audit:progress   to see all active runs\n`
      );
      process.exitCode = 1;
      return;
    }

    const endStatus = await readRunEndStatus(eventsPath);
    if (endStatus !== null) {
      const code = endStatus === "failed" ? 1 : 0;
      process.stdout.write(`\nworkflow ended — status: ${endStatus}\n`);
      process.exitCode = code;
      return;
    }

    await sleep(options.pollIntervalMs);
  }
}

function printLine(line: WatchLine): void {
  const ts = formatTimestamp(new Date());

  if (line.kind === "event") {
    if (line.isGate) {
      process.stdout.write(`${ts}  ${GATE_PREFIX}  ${line.label}\n`);
    } else {
      process.stdout.write(`${ts}  ${line.label}\n`);
    }
  }
}

function formatTimestamp(date: Date): string {
  const hh = date.getHours().toString().padStart(2, "0");
  const mm = date.getMinutes().toString().padStart(2, "0");
  const ss = date.getSeconds().toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`.padEnd(TS_WIDTH);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

interface ParsedArgs {
  runId: string;
  options: WatchOptions;
}

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  let runId: string | undefined;
  let staleHeartbeatMin = DEFAULT_STALE_HEARTBEAT_MIN;
  let pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;

  let index = 0;
  while (index < args.length) {
    const token = args[index] ?? "";

    switch (token) {
      case "--stale-after":
        staleHeartbeatMin = readPositiveInt(args, index, "--stale-after");
        index += 2;
        break;
      case "--poll":
        pollIntervalMs = readPositiveInt(args, index, "--poll") * 1000;
        index += 2;
        break;
      default:
        if (token.startsWith("--")) throw new Error(`Unknown flag: ${token}`);
        runId ??= token;
        index++;
    }
  }

  if (runId === undefined || runId.length === 0) {
    throw new Error(
      "Usage: npm run workflow:watch -- <runId> [--stale-after <minutes>] [--poll <seconds>]\n" +
      "  runId: the workflow run ID (from workflow:start output or .agent-session.json)\n" +
      "  --stale-after: exit non-zero if no heartbeat for N minutes (default: 10)\n" +
      "  --poll: re-check interval in seconds (default: 3)"
    );
  }

  return { runId, options: { pollIntervalMs, staleHeartbeatMin } };
}

function readPositiveInt(args: string[], index: number, flagName: string): number {
  const value = args[index + 1];
  if (value === undefined) throw new Error(`${flagName} requires a value.`);
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) throw new Error(`${flagName} must be a positive integer.`);
  return parsed;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
