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
