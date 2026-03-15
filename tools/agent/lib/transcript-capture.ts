import { exportTranscript } from "./transcript-exporter.js";
import { createTranscriptArtifact } from "./transcript-service.js";
import { findCurrentSessionFile } from "./session-finder.js";

export interface TranscriptCaptureInput {
  runId: string;
  workItemId?: string;
}

/**
 * Attempt to export the Claude Code session JSONL and record a TranscriptArtifact.
 *
 * Called at workflow:end. Logs a warning and returns without throwing when:
 * - no session JSONL is found
 * - the copy or DB write fails for any reason
 */
export async function exportTranscriptIfAvailable(input: TranscriptCaptureInput): Promise<void> {
  let sessionFile: string | undefined;

  try {
    sessionFile = await findCurrentSessionFile();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[transcript] Could not locate session file: ${message}\n`);
    return;
  }

  if (sessionFile === undefined) {
    process.stderr.write("[transcript] No Claude Code session JSONL found; skipping transcript capture.\n");
    return;
  }

  try {
    const result = await exportTranscript(sessionFile, input.runId);

    process.stdout.write(
      `[transcript] Captured ${result.lineCount.toString()} lines → ${result.filePath}\n`
    );

    await persistTranscriptRecord(input, result.filePath, result.lineCount);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[transcript] Export failed (session still available at source): ${message}\n`);
  }
}

async function persistTranscriptRecord(
  input: TranscriptCaptureInput,
  filePath: string,
  lineCount: number
): Promise<void> {
  try {
    await createTranscriptArtifact({
      filePath,
      lineCount,
      runId: input.runId,
      ...(input.workItemId === undefined ? {} : { workItemId: input.workItemId })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[transcript] DB record failed (file artifact still written): ${message}\n`);
  }
}
