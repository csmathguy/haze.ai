/**
 * File discovery pre-pass — PLAN-105
 *
 * Ranks repository files by relevance to a task description using a cheap
 * Haiku API call (when ANTHROPIC_API_KEY is set) or a keyword-score fallback.
 *
 * Usage:
 *   npm run agent:discover-files -- --task "description" [--max 10] [--output json|paths]
 *
 * Output (paths mode, default):
 *   tools/agent/file-discovery.ts
 *   tools/agent/execution-log.ts
 *   ...
 *
 * Output (json mode):
 *   [{"path":"...","relevanceScore":0.9,"reason":"..."}]
 */

import { execSync } from "node:child_process";

const EXCLUDE_PATTERNS = [
  /package-lock\.json$/,
  /\.lock$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.svg$/,
  /\.ico$/,
  /\.woff/,
  /\.ttf$/,
  /\.eot$/,
  /^dist\//,
  /^build\//,
  /^coverage\//,
  /^\.worktrees\//,
  /^artifacts\//,
  /migrations\/.*\.sql$/,
  /prisma\/migrations\//
];

interface FileCandidate {
  path: string;
  reason: string;
  relevanceScore: number;
}

interface HaikuMessagePart {
  text: string;
  type: string;
}

interface HaikuMessage {
  content: HaikuMessagePart[];
}

function getTrackedFiles(): string[] {
  return execSync("git ls-files", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((f) => !EXCLUDE_PATTERNS.some((p) => p.test(f)));
}

function keywordScore(task: string, files: string[]): FileCandidate[] {
  const words = task
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);

  return files
    .map((f) => {
      const lower = f.toLowerCase();
      const hits = words.filter((w) => lower.includes(w)).length;
      const isCode = /\.(ts|tsx|js|jsx)$/.test(f);
      const score = (hits * 2 + (isCode ? 1 : 0)) / (words.length * 2 + 1);

      return { path: f, reason: `keyword match (${String(hits)}/${String(words.length)} terms)`, relevanceScore: score };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

async function rankWithHaiku(task: string, files: string[], maxFiles: number): Promise<FileCandidate[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey === undefined || apiKey.length === 0) {
    return keywordScore(task, files).slice(0, maxFiles);
  }

  const prompt = `Task: "${task}"

Rank these repository files by relevance to the task above. Return a JSON array of objects with:
- path: the file path exactly as given
- relevanceScore: number from 0.0 to 1.0 (1.0 = definitely needed)
- reason: one short phrase explaining why

Include only files with relevanceScore > 0.1. Aim for 5–10 files. Prefer .ts/.tsx files.
Return only valid JSON, no markdown.

Files:
${files.join("\n")}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    body: JSON.stringify({
      max_tokens: 2048,
      messages: [{ content: prompt, role: "user" }],
      model: "claude-haiku-4-5-20251001"
    }),
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": apiKey
    },
    method: "POST"
  });

  if (!response.ok) {
    process.stderr.write(`Haiku API error ${String(response.status)} — falling back to keyword score\n`);
    return keywordScore(task, files).slice(0, maxFiles);
  }

  const body = (await response.json()) as HaikuMessage;
  const text = body.content[0]?.text ?? "[]";

  try {
    const candidates = JSON.parse(text) as FileCandidate[];

    return candidates
      .filter((c) => typeof c.path === "string" && typeof c.relevanceScore === "number")
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxFiles);
  } catch {
    process.stderr.write("Haiku returned non-JSON — falling back to keyword score\n");
    return keywordScore(task, files).slice(0, maxFiles);
  }
}

function parseFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);

  return idx >= 0 ? args[idx + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const task = parseFlagValue(args, "--task");

  if (task === undefined || task.length === 0) {
    process.stderr.write("Missing required --task argument\n");
    process.exitCode = 1;
    return;
  }

  const maxFiles = Number(parseFlagValue(args, "--max") ?? "10");
  const outputMode = parseFlagValue(args, "--output") ?? "paths";
  const allFiles = getTrackedFiles();

  let candidates: FileCandidate[];

  if (process.env.ANTHROPIC_API_KEY !== undefined && process.env.ANTHROPIC_API_KEY.length > 0) {
    candidates = await rankWithHaiku(task, allFiles, maxFiles);
  } else {
    candidates = keywordScore(task, allFiles).slice(0, maxFiles);
  }

  if (outputMode === "json") {
    process.stdout.write(`${JSON.stringify(candidates, null, 2)}\n`);
  } else {
    for (const c of candidates) {
      process.stdout.write(`${c.path}\n`);
    }
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
