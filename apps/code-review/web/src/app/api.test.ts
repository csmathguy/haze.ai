import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCodeReviewWorkspace } from "./api.js";

interface MockFetchResponse {
  json?: () => Promise<unknown>;
  ok: boolean;
  status?: number;
}

describe("code review app api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the code review workspace", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          workspace: {
            freshnessStrategy: ["Refresh on head SHA change"],
            generatedAt: "2026-03-13T19:45:00.000Z",
            lanes: [
              {
                evidence: ["Changed tests"],
                id: "tests",
                questions: ["Do the tests cover the intended behavior?"],
                reviewerGoal: "Review proof separately from implementation.",
                summary: "Test review lane",
                title: "Tests"
              }
            ],
            localOnly: true,
            principles: [
              {
                description: "Keep review order deterministic.",
                title: "Reduce comprehension friction first"
              }
            ],
            purpose: "Help humans review agent pull requests.",
            researchSources: [
              {
                authority: "official-docs",
                id: "github",
                note: "Baseline review workflow.",
                reviewedAt: "2026-03-13",
                title: "GitHub Docs",
                url: "https://docs.github.com"
              }
            ],
            roadmap: [
              {
                dependencies: [],
                id: "workspace",
                outcome: "Scaffold exists.",
                stage: "mvp",
                summary: "Scaffold the workspace.",
                title: "Review workspace scaffold"
              }
            ],
            title: "Code Review Studio",
            trustStatement: "Human review confirms trust."
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    const workspace = await fetchCodeReviewWorkspace();

    expect(fetchMock).toHaveBeenCalledWith("/api/code-review/workspace");
    expect(workspace.lanes[0]?.id).toBe("tests");
  });

  it("throws when the code review workspace payload is invalid", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          workspace: {
            generatedAt: "2026-03-13T19:45:00.000Z",
            localOnly: true
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCodeReviewWorkspace()).rejects.toThrow("Code review workspace response was invalid.");
  });
});
