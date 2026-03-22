export type DiffViewMode = "split" | "unified";

export interface UnifiedDiffLine {
  readonly color: "error.main" | "info.main" | "success.main" | "text.primary";
  readonly value: string;
}

export interface SplitDiffLine {
  readonly left?: string;
  readonly leftKind: "context" | "delete" | "empty" | "hunk";
  readonly right?: string;
  readonly rightKind: "add" | "context" | "empty" | "hunk";
}

export function splitPatch(patch: string | undefined): UnifiedDiffLine[] {
  if (patch === undefined || patch.length === 0) {
    return [];
  }

  return patch.split("\n").map((line) => ({
    color: resolvePatchLineColor(line),
    value: line
  }));
}

export function buildSplitDiffLines(patch: string | undefined): SplitDiffLine[] {
  const lines = patch?.split("\n") ?? [];

  if (lines.length === 0 || (lines.length === 1 && lines[0] === "")) {
    return [];
  }

  const rows: SplitDiffLine[] = [];
  let pendingDeletes: string[] = [];
  let pendingAdds: string[] = [];

  function flushPendingChanges() {
    const rowCount = Math.max(pendingDeletes.length, pendingAdds.length);

    for (let index = 0; index < rowCount; index += 1) {
      const left = pendingDeletes[index];
      const right = pendingAdds[index];

      rows.push({
        ...(left === undefined ? {} : { left }),
        leftKind: left === undefined ? "empty" : "delete",
        ...(right === undefined ? {} : { right }),
        rightKind: right === undefined ? "empty" : "add"
      });
    }

    pendingDeletes = [];
    pendingAdds = [];
  }

  for (const line of lines) {
    if (line.startsWith("@@")) {
      flushPendingChanges();
      rows.push({
        left: line,
        leftKind: "hunk",
        right: line,
        rightKind: "hunk"
      });
      continue;
    }

    if (line.startsWith("-")) {
      pendingDeletes.push(line);
      continue;
    }

    if (line.startsWith("+")) {
      pendingAdds.push(line);
      continue;
    }

    flushPendingChanges();
    rows.push({
      left: line,
      leftKind: "context",
      right: line,
      rightKind: "context"
    });
  }

  flushPendingChanges();

  return rows;
}

function resolvePatchLineColor(line: string): "error.main" | "info.main" | "success.main" | "text.primary" {
  if (line.startsWith("@@")) {
    return "info.main";
  }

  if (line.startsWith("+")) {
    return "success.main";
  }

  if (line.startsWith("-")) {
    return "error.main";
  }

  return "text.primary";
}
