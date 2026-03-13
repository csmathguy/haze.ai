import { afterEach, describe, expect, it, vi } from "vitest";

import { createKnowledgeEntry, createKnowledgeSubject, fetchKnowledgeWorkspace, syncRepositoryDocs } from "./api.js";

describe("knowledge api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches the knowledge workspace", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        workspace: {
          entries: [],
          generatedAt: "2026-03-13T15:00:00.000Z",
          localOnly: true,
          subjects: [],
          summary: {
            activeEntries: 0,
            followUps: 0,
            humanSubjects: 0,
            repositoryDocs: 0,
            subjects: 0,
            totalEntries: 0
          }
        }
      }),
      ok: true
    });
    vi.stubGlobal("fetch", fetchMock);

    const workspace = await fetchKnowledgeWorkspace();

    expect(fetchMock).toHaveBeenCalledWith("/api/knowledge/workspace");
    expect(workspace.localOnly).toBe(true);
  });

  it("posts subject and entry mutations and triggers repo-doc sync", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({}),
      ok: true
    });
    vi.stubGlobal("fetch", fetchMock);

    await createKnowledgeSubject({
      kind: "human",
      name: "Primary human",
      namespace: "human:primary"
    });
    await createKnowledgeEntry({
      content: {
        abstract: "Store durable preferences.",
        format: "markdown",
        markdown: "Local-only knowledge matters.",
        sections: [],
        sources: []
      },
      kind: "agent-memory",
      namespace: "human:primary",
      title: "Memory note"
    });
    await syncRepositoryDocs();

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/knowledge/subjects",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/knowledge/entries",
      expect.objectContaining({
        method: "POST"
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/knowledge/bootstrap/repository-docs",
      expect.objectContaining({
        method: "POST"
      })
    );
  });
});
