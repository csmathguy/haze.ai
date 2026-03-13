import { randomUUID } from "node:crypto";

import type { KnowledgeEntry, KnowledgeSubject } from "@taxes/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

export class KnowledgeConflictError extends Error {}
export class KnowledgeNotFoundError extends Error {}

export const KNOWLEDGE_ENTRY_INCLUDE = {
  subject: true
} as const;

export type KnowledgePrismaClientLike = PrismaClient | Prisma.TransactionClient;
export type StoredKnowledgeEntry = Prisma.KnowledgeEntryGetPayload<{
  include: typeof KNOWLEDGE_ENTRY_INCLUDE;
}>;
export type StoredKnowledgeSubject = Prisma.KnowledgeSubjectGetPayload<Record<string, never>>;

export function buildKnowledgeSummary(
  entries: KnowledgeEntry[],
  subjects: KnowledgeSubject[]
): {
  activeEntries: number;
  followUps: number;
  humanSubjects: number;
  repositoryDocs: number;
  subjects: number;
  totalEntries: number;
} {
  return {
    activeEntries: entries.filter((entry) => entry.status === "active").length,
    followUps: entries.filter((entry) => entry.kind === "follow-up" && entry.status !== "archived").length,
    humanSubjects: subjects.filter((subject) => subject.kind === "human").length,
    repositoryDocs: entries.filter((entry) => entry.kind === "doc-mirror").length,
    subjects: subjects.length,
    totalEntries: entries.length
  };
}

export async function ensureKnowledgeSubjectExists(client: KnowledgePrismaClientLike, subjectId: string): Promise<void> {
  const subject = await client.knowledgeSubject.findUnique({
    where: {
      id: subjectId
    }
  });

  if (subject === null) {
    throw new KnowledgeNotFoundError(`Knowledge subject ${subjectId} was not found.`);
  }
}

export async function normalizePrimaryHuman(client: KnowledgePrismaClientLike, subjectId: string): Promise<void> {
  await client.knowledgeSubject.updateMany({
    data: {
      isPrimaryHuman: false
    },
    where: {
      id: {
        not: subjectId
      },
      isPrimaryHuman: true
    }
  });
}

export function buildSubjectSlug(name: string, slug?: string): string {
  return slugify(slug ?? `${name}-${randomUUID().slice(0, 8)}`);
}

export function buildEntrySlug(title: string, slug?: string): string {
  return slugify(slug ?? `${title}-${randomUUID().slice(0, 8)}`);
}

export function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

export function parseJson(value: string | null | undefined): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }

  return JSON.parse(value) as unknown;
}

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((part) => part.length > 0)
    .join("-")
    .slice(0, 80);
}
