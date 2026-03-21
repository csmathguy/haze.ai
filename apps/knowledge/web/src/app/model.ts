import { startTransition } from "react";
import type { CreateKnowledgeEntryDraftInput, KnowledgeEntry, KnowledgeWorkspace } from "@taxes/shared";

import { fetchKnowledgeWorkspace } from "./api.js";

export async function refreshWorkspace(
  setErrorMessage: (value: string | null) => void,
  setIsBusy: (value: boolean) => void,
  setWorkspace: (value: KnowledgeWorkspace | null) => void
): Promise<void> {
  setIsBusy(true);
  setErrorMessage(null);

  try {
    const nextWorkspace = await fetchKnowledgeWorkspace();

    startTransition(() => {
      setWorkspace(nextWorkspace);
    });
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : "Failed to load the knowledge workspace.");
  } finally {
    setIsBusy(false);
  }
}

export async function runMutation(options: {
  readonly action: () => Promise<void>;
  readonly errorMessage: string;
  readonly refresh: () => Promise<void>;
  readonly setErrorMessage: (value: string | null) => void;
  readonly setSuccessMessage: (value: string | null) => void;
  readonly successMessage: string;
}): Promise<void> {
  options.setErrorMessage(null);
  options.setSuccessMessage(null);

  try {
    await options.action();
    options.setSuccessMessage(options.successMessage);
    await options.refresh();
  } catch (error) {
    options.setErrorMessage(error instanceof Error ? error.message : options.errorMessage);
  }
}

export function filterEntries(entries: KnowledgeEntry[], subjectId: string, kindFilter: string, search: string): KnowledgeEntry[] {
  const normalizedSearch = search.trim().toLowerCase();

  return entries.filter((entry) => {
    if (subjectId !== "all" && entry.subjectId !== subjectId) {
      return false;
    }

    if (kindFilter !== "all" && entry.kind !== kindFilter) {
      return false;
    }

    if (normalizedSearch.length === 0) {
      return true;
    }

    return `${entry.title} ${entry.content.abstract} ${entry.tags.join(" ")}`.toLowerCase().includes(normalizedSearch);
  });
}

export interface KnowledgeBrowseFilters {
  readonly agentRole: string;
  readonly kind: string;
  readonly reviewState: string;
  readonly search: string;
  readonly sourceType: string;
  readonly subjectId: string;
  readonly tier: string;
}

export function filterKnowledgeEntries(entries: KnowledgeEntry[], filters: KnowledgeBrowseFilters): KnowledgeEntry[] {
  const normalizedSearch = filters.search.trim().toLowerCase();

  return entries.filter((entry) => {
    return matchesSubject(entry, filters.subjectId)
      && matchesKind(entry, filters.kind)
      && matchesMemoryTier(entry, filters.tier)
      && matchesMemoryReview(entry, filters.reviewState)
      && matchesMemorySource(entry, filters.sourceType)
      && matchesMemoryAgentRole(entry, filters.agentRole)
      && matchesSearch(entry, normalizedSearch);
  });
}

export function findRelatedKnowledgeEntries(entries: KnowledgeEntry[], entryId: string | null): KnowledgeEntry[] {
  if (entryId === null) {
    return [];
  }

  const entry = entries.find((item) => item.id === entryId);
  if (entry === undefined) {
    return [];
  }

  return entries.filter((candidate) => candidate.id !== entry.id && areEntriesRelated(entry, candidate)).slice(0, 8);
}

function matchesSubject(entry: KnowledgeEntry, subjectId: string): boolean {
  return subjectId === "all" || entry.subjectId === subjectId;
}

function matchesKind(entry: KnowledgeEntry, kind: string): boolean {
  return kind === "all" || entry.kind === kind;
}

function matchesMemoryTier(entry: KnowledgeEntry, tier: string): boolean {
  return tier === "all" || entry.content.memory?.tier === tier;
}

function matchesMemoryReview(entry: KnowledgeEntry, reviewState: string): boolean {
  return reviewState === "all" || entry.content.memory?.reviewState === reviewState;
}

function matchesMemorySource(entry: KnowledgeEntry, sourceType: string): boolean {
  return sourceType === "all" || entry.content.memory?.sourceType === sourceType;
}

function matchesMemoryAgentRole(entry: KnowledgeEntry, agentRole: string): boolean {
  const memory = entry.content.memory;

  return agentRole === "all" || memory === undefined || memory.agentRoles.length === 0 || memory.agentRoles.includes(agentRole);
}

function matchesSearch(entry: KnowledgeEntry, normalizedSearch: string): boolean {
  if (normalizedSearch.length === 0) {
    return true;
  }

  const memory = entry.content.memory;
  return `${entry.title} ${entry.content.abstract} ${entry.tags.join(" ")} ${memory?.tier ?? ""} ${memory?.sourceType ?? ""}`.toLowerCase().includes(normalizedSearch);
}

function areEntriesRelated(left: KnowledgeEntry, right: KnowledgeEntry): boolean {
  if (left.subjectId === right.subjectId && left.subjectId !== undefined) {
    return true;
  }

  if (left.namespace === right.namespace) {
    return true;
  }

  if (left.tags.some((tag) => right.tags.includes(tag))) {
    return true;
  }

  const leftMemory = left.content.memory;
  const rightMemory = right.content.memory;
  if (leftMemory?.agentRoles.some((role) => rightMemory?.agentRoles.includes(role) === true) === true) {
    return true;
  }

  return false;
}

export function buildEntryInput(formState: {
  abstract: string;
  importance: string;
  jsonText: string;
  kind: string;
  markdown: string;
  namespace: string;
  subjectId: string;
  tags: string;
  title: string;
  visibility: string;
}): CreateKnowledgeEntryDraftInput {
  const parsedJson = parseOptionalJson(formState.jsonText);

  return {
    content: {
      abstract: formState.abstract,
      format: resolveContentFormat(parsedJson, formState.markdown),
      json: parsedJson,
      markdown: emptyToUndefined(formState.markdown),
      sections: [],
      sources: []
    },
    importance: formState.importance as CreateKnowledgeEntryDraftInput["importance"],
    kind: formState.kind as CreateKnowledgeEntryDraftInput["kind"],
    namespace: formState.namespace,
    subjectId: emptyToUndefined(formState.subjectId),
    tags: formState.tags.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0),
    title: formState.title,
    visibility: formState.visibility as CreateKnowledgeEntryDraftInput["visibility"]
  };
}

export function buildSummaryCards(summary: KnowledgeWorkspace["summary"] | undefined) {
  return [
    { caption: "Subjects currently tracked for memory and alignment.", label: "Subjects", value: String(summary?.subjects ?? 0) },
    { caption: "Entries available to agents and humans right now.", label: "Entries", value: String(summary?.totalEntries ?? 0) },
    { caption: "Open follow-up notes still worth revisiting.", label: "Follow-ups", value: String(summary?.followUps ?? 0) }
  ];
}

export function emptyToUndefined(value: string): string | undefined {
  return value.trim().length === 0 ? undefined : value.trim();
}

function parseOptionalJson(value: string): Record<string, unknown> | undefined {
  return value.trim().length === 0 ? undefined : (JSON.parse(value) as Record<string, unknown>);
}

function resolveContentFormat(parsedJson: Record<string, unknown> | undefined, markdown: string): "hybrid" | "json" | "markdown" {
  if (parsedJson === undefined) {
    return "markdown";
  }

  return markdown.trim().length === 0 ? "json" : "hybrid";
}
