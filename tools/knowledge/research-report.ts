import { z } from "zod";

import type { CreateKnowledgeEntryDraftInput, KnowledgeEntry, UpdateKnowledgeEntryPatchInput } from "@taxes/shared";
import { KnowledgeEntryKindSchema } from "@taxes/shared";

export const FindKnowledgeEntriesInputSchema = z.object({
  kind: KnowledgeEntryKindSchema.optional(),
  limit: z.int().positive().max(100).default(10),
  namespace: z.string().min(1).optional(),
  search: z.string().min(1).optional()
});

export const ResearchReportMatchSchema = z
  .object({
    entryId: z.string().min(1).optional(),
    slug: z.string().min(1).optional(),
    sourceUri: z.string().min(1).optional(),
    title: z.string().min(1).optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: "Provide at least one research-report match field."
  });

export const ResearchReportUpsertInputSchema = z.object({
  content: z.object({
    abstract: z.string().min(1),
    format: z.enum(["json", "markdown", "hybrid"]),
    json: z.record(z.string(), z.unknown()).optional(),
    markdown: z.string().min(1).optional(),
    sections: z.array(
      z.object({
        body: z.string().min(1).optional(),
        items: z.array(z.string().min(1)).default([]),
        title: z.string().min(1)
      })
    ).default([]),
    sources: z.array(
      z.object({
        authority: z.enum(["maintainer-docs", "official-docs", "peer-reviewed", "repo-doc", "user-note"]).optional(),
        title: z.string().min(1),
        url: z.string().min(1)
      })
    ).default([])
  }),
  createdByName: z.string().min(1).optional(),
  importance: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  match: ResearchReportMatchSchema.optional(),
  namespace: z.string().min(1),
  sourceTitle: z.string().min(1).optional(),
  sourceUri: z.string().min(1).optional(),
  status: z.enum(["draft", "active", "review-needed", "archived"]).default("active"),
  subjectId: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).default([]),
  title: z.string().min(1),
  visibility: z.enum(["agent", "human", "shared"]).default("shared")
});

export type FindKnowledgeEntriesInput = z.infer<typeof FindKnowledgeEntriesInputSchema>;
export type ResearchReportUpsertInput = z.input<typeof ResearchReportUpsertInputSchema>;

export function findKnowledgeEntries(entries: KnowledgeEntry[], input: FindKnowledgeEntriesInput): KnowledgeEntry[] {
  const searchTerms = normalizeSearchTerms(input.search);

  return entries
    .filter((entry) => matchesKind(entry, input.kind))
    .filter((entry) => matchesNamespace(entry, input.namespace))
    .filter((entry) => matchesSearch(entry, searchTerms))
    .slice(0, input.limit);
}

export function resolveResearchReportUpsert(
  entries: KnowledgeEntry[],
  rawInput: ResearchReportUpsertInput,
  reviewedAt: string
):
  | { action: "create"; input: CreateKnowledgeEntryDraftInput }
  | { action: "update"; entryId: string; input: UpdateKnowledgeEntryPatchInput } {
  const input = ResearchReportUpsertInputSchema.parse(rawInput);
  const existing = findExistingResearchReport(entries, input);

  if (existing === undefined) {
    return {
      action: "create",
      input: {
        content: input.content,
        createdByKind: "agent",
        ...(input.createdByName === undefined ? {} : { createdByName: input.createdByName }),
        importance: input.importance,
        kind: "research-report",
        namespace: input.namespace,
        origin: "research-agent",
        ...(input.sourceTitle === undefined ? {} : { sourceTitle: input.sourceTitle }),
        ...(input.sourceUri === undefined ? {} : { sourceUri: input.sourceUri }),
        status: input.status,
        ...(input.subjectId === undefined ? {} : { subjectId: input.subjectId }),
        tags: input.tags,
        title: input.title,
        visibility: input.visibility
      }
    };
  }

  return {
    action: "update",
    entryId: existing.id,
    input: {
      content: input.content,
      importance: input.importance,
      lastReviewedAt: reviewedAt,
      namespace: input.namespace,
      ...(input.sourceTitle === undefined ? {} : { sourceTitle: input.sourceTitle }),
      ...(input.sourceUri === undefined ? {} : { sourceUri: input.sourceUri }),
      status: input.status,
      ...(input.subjectId === undefined ? {} : { subjectId: input.subjectId }),
      tags: input.tags,
      title: input.title,
      visibility: input.visibility
    }
  };
}

function findExistingResearchReport(entries: KnowledgeEntry[], input: ResearchReportUpsertInput): KnowledgeEntry | undefined {
  const researchEntries = entries.filter((entry) => entry.kind === "research-report" && entry.namespace === input.namespace);
  const match = input.match;

  if (match?.entryId !== undefined) {
    return researchEntries.find((entry) => entry.id === match.entryId);
  }

  if (match?.slug !== undefined) {
    return researchEntries.find((entry) => entry.slug === match.slug);
  }

  if (match?.sourceUri !== undefined) {
    return researchEntries.find((entry) => entry.sourceUri === match.sourceUri);
  }

  if (match?.title !== undefined) {
    const normalizedTitle = normalizeText(match.title);

    return researchEntries.find((entry) => normalizeText(entry.title) === normalizedTitle);
  }

  if (input.sourceUri !== undefined) {
    return researchEntries.find((entry) => entry.sourceUri === input.sourceUri);
  }

  const normalizedTitle = normalizeText(input.title);
  return researchEntries.find((entry) => normalizeText(entry.title) === normalizedTitle);
}

function matchesKind(entry: KnowledgeEntry, kind: FindKnowledgeEntriesInput["kind"]): boolean {
  return kind === undefined || entry.kind === kind;
}

function matchesNamespace(entry: KnowledgeEntry, namespace: string | undefined): boolean {
  return namespace === undefined || entry.namespace === namespace;
}

function matchesSearch(entry: KnowledgeEntry, searchTerms: string[]): boolean {
  if (searchTerms.length === 0) {
    return true;
  }

  const haystack = normalizeText([
    entry.title,
    entry.slug,
    entry.content.abstract,
    entry.content.markdown ?? "",
    entry.sourceTitle ?? "",
    entry.sourceUri ?? "",
    ...entry.tags
  ].join(" "));

  return searchTerms.every((term) => haystack.includes(term));
}

function normalizeSearchTerms(search: string | undefined): string[] {
  if (search === undefined) {
    return [];
  }

  return normalizeText(search)
    .split(" ")
    .filter((term) => term.length > 0);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}
