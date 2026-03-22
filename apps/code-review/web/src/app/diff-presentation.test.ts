import { describe, expect, it } from "vitest";

import { buildSplitDiffLines, splitPatch } from "./diff-presentation.js";

describe("splitPatch", () => {
  it("returns empty output for missing patch text", () => {
    expect(splitPatch(undefined)).toEqual([]);
  });

  it("colors unified lines by diff marker", () => {
    expect(splitPatch("@@ header\n-context\n+context\n plain")).toEqual([
      { color: "info.main", value: "@@ header" },
      { color: "error.main", value: "-context" },
      { color: "success.main", value: "+context" },
      { color: "text.primary", value: " plain" }
    ]);
  });
});

describe("buildSplitDiffLines", () => {
  it("aligns removed and added lines into paired rows", () => {
    expect(buildSplitDiffLines("@@ hunk\n-old one\n-old two\n+new one\n same")).toEqual([
      { left: "@@ hunk", leftKind: "hunk", right: "@@ hunk", rightKind: "hunk" },
      { left: "-old one", leftKind: "delete", right: "+new one", rightKind: "add" },
      { left: "-old two", leftKind: "delete", right: undefined, rightKind: "empty" },
      { left: " same", leftKind: "context", right: " same", rightKind: "context" }
    ]);
  });

  it("keeps pure context rows mirrored on both sides", () => {
    expect(buildSplitDiffLines(" context")).toEqual([
      { left: " context", leftKind: "context", right: " context", rightKind: "context" }
    ]);
  });
});
