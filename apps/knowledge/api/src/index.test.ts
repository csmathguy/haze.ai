import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { KnowledgeWorkspace } from "@taxes/shared";

import { buildApp } from "./app.js";
import type { TestKnowledgeContext } from "./test/database.js";
import { createTestKnowledgeContext } from "./test/database.js";

interface KnowledgeWorkspaceResponse {
  workspace: KnowledgeWorkspace;
}

describe("knowledge buildApp", () => {
  const workspaces: TestKnowledgeContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("returns an empty workspace snapshot", async () => {
    const workspace = await createTestKnowledgeContext("knowledge-build-app-empty");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const response = await app.inject({
      method: "GET",
      url: "/api/knowledge/workspace"
    });
    const payload: KnowledgeWorkspaceResponse = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.workspace.localOnly).toBe(true);
    expect(payload.workspace.summary.totalEntries).toBe(0);

    await app.close();
  });

  it("creates subjects and entries and syncs repository docs", async () => {
    const workspace = await createTestKnowledgeContext("knowledge-build-app-create");
    workspaces.push(workspace);
    await mkdir(workspace.docsRoot, { recursive: true });
    await writeFile(path.join(workspace.docsRoot, "workflow.md"), "# Workflow\n\nKnowledge belongs in the local database.\n", "utf8");
    const app = await buildApp(workspace);

    const subjectResponse = await app.inject({
      method: "POST",
      payload: {
        isPrimaryHuman: true,
        kind: "human",
        name: "Primary human",
        namespace: "human:primary"
      },
      url: "/api/knowledge/subjects"
    });
    const subjectPayload: { subject: { id: string } } = subjectResponse.json();

    const entryResponse = await app.inject({
      method: "POST",
      payload: {
        content: {
          abstract: "Track user preferences for future work.",
          format: "hybrid",
          markdown: "The primary human wants strong guardrails and planning data.",
          sections: [{ items: ["Guardrails", "Visibility"], title: "Signals" }],
          sources: []
        },
        createdByKind: "agent",
        createdByName: "codex",
        kind: "profile-note",
        namespace: "human:primary",
        subjectId: subjectPayload.subject.id,
        title: "Primary human profile note"
      },
      url: "/api/knowledge/entries"
    });

    expect(subjectResponse.statusCode).toBe(201);
    expect(entryResponse.statusCode).toBe(201);

    const syncResponse = await app.inject({
      method: "POST",
      url: "/api/knowledge/bootstrap/repository-docs"
    });
    expect(syncResponse.statusCode).toBe(202);

    const workspaceResponse = await app.inject({
      method: "GET",
      url: "/api/knowledge/workspace"
    });
    const workspacePayload: KnowledgeWorkspaceResponse = workspaceResponse.json();

    expect(workspacePayload.workspace.summary.humanSubjects).toBe(1);
    expect(workspacePayload.workspace.summary.repositoryDocs).toBe(1);
    expect(workspacePayload.workspace.entries.some((entry) => entry.kind === "doc-mirror")).toBe(true);

    await app.close();
  });
});
