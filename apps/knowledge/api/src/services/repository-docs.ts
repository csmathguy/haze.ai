import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import * as path from "node:path";

import type { Prisma } from "@prisma/client";

import { buildEntrySlug, serializeJson } from "./knowledge-support.js";

export interface RepositoryDocSyncResult {
  created: number;
  scanned: number;
  updated: number;
}

export async function syncRepositoryDocs(transaction: Prisma.TransactionClient, docsRoot: string): Promise<RepositoryDocSyncResult> {
  const filePaths = await collectMarkdownFiles(docsRoot);
  let created = 0;
  let updated = 0;

  for (const filePath of filePaths) {
    const result = await upsertRepositoryDoc(transaction, docsRoot, filePath);

    created += result.created;
    updated += result.updated;
  }

  return {
    created,
    scanned: filePaths.length,
    updated
  };
}

async function upsertRepositoryDoc(
  transaction: Prisma.TransactionClient,
  docsRoot: string,
  filePath: string
): Promise<{ created: number; updated: number }> {
  const relativePath = path.relative(docsRoot, filePath).replaceAll("\\", "/");
  const markdown = await readFile(filePath, "utf8");
  const checksum = createHash("sha256").update(markdown).digest("hex");
  const slug = buildEntrySlug(`repo-doc-${relativePath}`, `repo-doc-${relativePath}`);
  const existing = await transaction.knowledgeEntry.findUnique({
    where: {
      slug
    }
  });

  if (existing?.sourceChecksum === checksum) {
    return { created: 0, updated: 0 };
  }

  const data = buildRepositoryDocData(relativePath, markdown, checksum);

  if (existing === null) {
    await transaction.knowledgeEntry.create({
      data: {
        ...data,
        id: randomUUID(),
        slug
      }
    });
    return { created: 1, updated: 0 };
  }

  await transaction.knowledgeEntry.update({
    data,
    where: {
      id: existing.id
    }
  });

  return { created: 0, updated: 1 };
}

function buildRepositoryDocData(relativePath: string, markdown: string, checksum: string) {
  const title = extractTitle(relativePath, markdown);
  const abstract = extractAbstract(markdown, title);

  return {
    contentJson: serializeJson({
      abstract,
      format: "hybrid",
      markdown,
      sections: [
        {
          items: [`Repository path: ${relativePath}`],
          title: "Repository Source"
        }
      ],
      sources: [
        {
          authority: "repo-doc",
          title: relativePath,
          url: relativePath
        }
      ]
    }),
    createdByKind: "system",
    importance: "medium",
    kind: "doc-mirror",
    namespace: "repo:docs",
    origin: "repo-doc-sync",
    sourceChecksum: checksum,
    sourceTitle: title,
    sourceUri: relativePath,
    status: "active",
    tagsJson: serializeJson(["documentation", "repo-doc"]),
    title,
    visibility: "shared"
  } as const;
}

async function collectMarkdownFiles(rootDirectory: string): Promise<string[]> {
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  const filePaths: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDirectory, entry.name);

    if (entry.isDirectory()) {
      filePaths.push(...(await collectMarkdownFiles(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      filePaths.push(fullPath);
    }
  }

  return filePaths.sort((left, right) => left.localeCompare(right));
}

function extractTitle(relativePath: string, markdown: string): string {
  const heading = markdown
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));

  return heading === undefined ? relativePath.replace(/\.md$/u, "") : heading.slice(2).trim();
}

function extractAbstract(markdown: string, title: string): string {
  const firstParagraph = markdown
    .split(/\r?\n\r?\n/u)
    .map((block) => block.trim())
    .find((block) => block.length > 0 && !block.startsWith("#"));

  return firstParagraph ?? `Repository documentation mirror for ${title}.`;
}
