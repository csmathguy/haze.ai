import {
  KnowledgeEntryContentSchema,
  KnowledgeEntrySchema,
  KnowledgeSubjectProfileSchema,
  KnowledgeSubjectSchema
} from "@taxes/shared";

import { parseJson } from "./knowledge-support.js";
import type { StoredKnowledgeEntry, StoredKnowledgeSubject } from "./knowledge-support.js";

export function compareKnowledgeEntries(left: StoredKnowledgeEntry, right: StoredKnowledgeEntry): number {
  return right.updatedAt.getTime() - left.updatedAt.getTime() || left.title.localeCompare(right.title);
}

export function compareKnowledgeSubjects(left: StoredKnowledgeSubject, right: StoredKnowledgeSubject): number {
  return Number(right.isPrimaryHuman) - Number(left.isPrimaryHuman) || left.name.localeCompare(right.name);
}

export function mapKnowledgeSubject(record: StoredKnowledgeSubject) {
  const profile = parseJson(record.profileJson);

  return KnowledgeSubjectSchema.parse({
    createdAt: record.createdAt.toISOString(),
    id: record.id,
    isPrimaryHuman: record.isPrimaryHuman,
    kind: record.kind,
    name: record.name,
    namespace: record.namespace,
    profile: profile === undefined ? undefined : KnowledgeSubjectProfileSchema.parse(profile),
    slug: record.slug,
    summary: record.summary ?? undefined,
    updatedAt: record.updatedAt.toISOString()
  });
}

export function mapKnowledgeEntry(record: StoredKnowledgeEntry) {
  return KnowledgeEntrySchema.parse({
    content: KnowledgeEntryContentSchema.parse(parseJson(record.contentJson)),
    createdAt: record.createdAt.toISOString(),
    createdByKind: record.createdByKind,
    createdByName: record.createdByName ?? undefined,
    id: record.id,
    importance: record.importance,
    kind: record.kind,
    lastReviewedAt: record.lastReviewedAt?.toISOString(),
    namespace: record.namespace,
    origin: record.origin,
    slug: record.slug,
    sourceTitle: record.sourceTitle ?? undefined,
    sourceUri: record.sourceUri ?? undefined,
    status: record.status,
    subjectId: record.subjectId ?? undefined,
    tags: (parseJson(record.tagsJson) as string[] | undefined) ?? [],
    title: record.title,
    updatedAt: record.updatedAt.toISOString(),
    visibility: record.visibility
  });
}
