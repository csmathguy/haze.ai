import { describe, expect, it } from "vitest";

import { parseCheckoutMode } from "./refresh-workspace.js";
import { hasPendingCheckoutChanges } from "./lib/refresh-workspace-selection.js";

type CheckoutMode = "auto" | "current-worktree" | "main";

const parseCheckoutModeTyped: (value: string) => CheckoutMode = parseCheckoutMode;

describe("hasPendingCheckoutChanges", () => {
  it("returns false when git status output is empty", () => {
    expect(hasPendingCheckoutChanges("")).toBe(false);
  });

  it("returns true when git status output contains staged or unstaged entries", () => {
    expect(hasPendingCheckoutChanges("M  tools/agent/refresh-workspace.ts\n")).toBe(true);
    expect(hasPendingCheckoutChanges("?? apps/gateway/api/src/db/migrations.test.ts\n")).toBe(true);
  });
});

describe("parseCheckoutMode", () => {
  it("accepts supported checkout modes", () => {
    expect(parseCheckoutModeTyped("auto")).toBe("auto");
    expect(parseCheckoutModeTyped("current-worktree")).toBe("current-worktree");
    expect(parseCheckoutModeTyped("main")).toBe("main");
  });

  it("rejects unsupported checkout modes", () => {
    expect(() => parseCheckoutModeTyped("feature")).toThrow(/Unsupported checkout/);
  });
});
