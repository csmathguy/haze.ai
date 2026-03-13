import type { AuditRunOverview } from "@taxes/shared";

const MAX_PREVIEW_ITEMS = 3;

export interface RunPresentation {
  readonly previewItems: string[];
  readonly secondaryText?: string;
  readonly title: string;
  readonly trailingCount?: number;
}

export function summarizeRunPresentation(run: AuditRunOverview): RunPresentation {
  const task = run.task?.trim();

  if (task === undefined || task.length === 0) {
    return {
      previewItems: [],
      title: run.workflow
    };
  }

  const colonIndex = task.indexOf(":");

  if (colonIndex === -1) {
    return {
      previewItems: [],
      title: task
    };
  }

  const title = task.slice(0, colonIndex).trim();
  const remainder = task.slice(colonIndex + 1).trim();

  if (remainder.length === 0) {
    return { previewItems: [], title };
  }

  const previewItems = remainder
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (previewItems.length < 2 && !title.toLowerCase().includes("files")) {
    return {
      previewItems: [],
      secondaryText: remainder,
      title
    };
  }

  return {
    previewItems: previewItems.slice(0, MAX_PREVIEW_ITEMS),
    secondaryText: `${previewItems.length.toString()} files`,
    title,
    trailingCount: Math.max(previewItems.length - MAX_PREVIEW_ITEMS, 0)
  };
}
