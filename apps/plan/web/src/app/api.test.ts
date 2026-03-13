import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPlanningWorkspace } from "./api.js";

interface MockFetchResponse {
  json?: () => Promise<unknown>;
  ok: boolean;
  status?: number;
}

describe("plan app api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the planning workspace", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          workspace: {
            generatedAt: "2026-03-12T18:00:00.000Z",
            localOnly: true,
            projects: [
              {
                createdAt: "2026-03-12T18:00:00.000Z",
                isActive: true,
                key: "planning",
                name: "Planning",
                sortOrder: 1,
                updatedAt: "2026-03-12T18:00:00.000Z"
              }
            ],
            summary: {
              activeItems: 0,
              backlogItems: 0,
              blockedItems: 0,
              doneItems: 0,
              readyItems: 0,
              totalItems: 0
            },
            workItems: []
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    const workspace = await fetchPlanningWorkspace();

    expect(fetchMock).toHaveBeenCalledWith("/api/planning/workspace");
    expect(workspace.projects[0]?.key).toBe("planning");
  });

  it("throws when the planning workspace payload is invalid", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          workspace: {
            generatedAt: "2026-03-12T18:00:00.000Z",
            localOnly: true,
            summary: {
              activeItems: 0,
              backlogItems: 0,
              blockedItems: 0,
              doneItems: 0,
              readyItems: 0,
              totalItems: 0
            },
            workItems: []
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPlanningWorkspace()).rejects.toThrow("Planning workspace response was invalid.");
  });
});
