import { copyFile, mkdir, readFile } from "node:fs/promises";
import * as path from "node:path";

export interface TranscriptExportResult {
  filePath: string;
  lineCount: number;
}

/**
 * Copy the Claude Code session JSONL from sourcePath to
 * <outputDir>/<runId>.jsonl, creating the output directory if needed.
 *
 * Returns the resolved destination path and the number of JSONL lines written.
 */
export async function exportTranscript(
  sourcePath: string,
  runId: string,
  outputDir?: string
): Promise<TranscriptExportResult> {
  const resolvedOutputDir = outputDir ?? path.resolve(".audit", "transcripts");

  await mkdir(resolvedOutputDir, { recursive: true });

  const destPath = path.join(resolvedOutputDir, `${runId}.jsonl`);

  await copyFile(sourcePath, destPath);

  const content = await readFile(destPath, "utf8");
  const lineCount = content
    .split("\n")
    .filter((line) => line.trim().length > 0).length;

  return { filePath: destPath, lineCount };
}
