import { mkdir, writeFile } from "node:fs/promises";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { TestKnowledgeContext } from "../test/database.js";
import { createTestKnowledgeContext } from "../test/database.js";
import {
  createKnowledgeEntry,
  createKnowledgeSubject,
  getKnowledgeWorkspace,
  importRepositoryKnowledge,
  promoteKnowledgeMemoryEntry,
  findKnowledgeMemoryEntries,
  getKnowledgeMemoryContextPack,
  updateKnowledgeEntry,
  updateKnowledgeSubject
} from "./knowledge.js";

describe("knowledge service", () => {
  const workspaces: TestKnowledgeContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("returns an empty local-only workspace", async () => {
    const workspace = await createTestKnowledgeContext("knowledge-service-empty");
    workspaces.push(workspace);
    const snapshot = await getKnowledgeWorkspace(workspace);

    expect(snapshot.localOnly).toBe(true);
    expect(snapshot.summary.totalEntries).toBe(0);
    expect(snapshot.subjects).toEqual([]);
  });

  it("stores subjects and entries with structured content", async () => {
    const workspace = await createTestKnowledgeContext("knowledge-service-create");
    workspaces.push(workspace);
    const subject = await createKnowledgeSubject(
      {
        isPrimaryHuman: true,
        kind: "human",
        name: "Primary human",
        namespace: "human:primary",
        profile: {
          facts: [{ confidence: "high", key: "role", label: "Role", value: "Repository owner" }],
          goals: ["Build durable local tools"],
          preferences: ["Prefer explicit planning data"],
          recentFocus: ["Agent workflows"],
          workingStyle: ["Likes visible progress and direct tradeoffs"]
        }
      },
      workspace
    );
    const entry = await createKnowledgeEntry(
      {
        content: {
          abstract: "The user wants planning and memory systems with strong local guardrails.",
          format: "hybrid",
          json: {
            type: "alignment-note"
          },
          markdown: "Capture durable planning, auditability, and local-first constraints.",
          sections: [{ items: ["Local-only", "Strong validation"], title: "Constraints" }],
          sources: []
        },
        createdByKind: "agent",
        createdByName: "codex",
        kind: "agent-memory",
        namespace: "human:primary",
        subjectId: subject.id,
        tags: ["alignment", "preferences"],
        title: "Primary human workflow preferences"
      },
      workspace
    );

    expect(subject.isPrimaryHuman).toBe(true);
    expect(entry.subjectId).toBe(subject.id);
    expect(entry.content.format).toBe("hybrid");
    expect(entry.tags).toContain("alignment");
  });

  it("updates subjects, entries, and imports repository docs", async () => {
    const workspace = await createTestKnowledgeContext("knowledge-service-update");
    workspaces.push(workspace);
    await mkdir(workspace.docsRoot, { recursive: true });
    await writeFile(
      path.join(workspace.docsRoot, "memory.md"),
      "# Memory Model\n\nKeep structured notes and human-readable summaries in the same system.\n",
      "utf8"
    );

    const subject = await createKnowledgeSubject(
      {
        kind: "technology",
        name: "Knowledge product",
        namespace: "product:knowledge"
      },
      workspace
    );
    const entry = await createKnowledgeEntry(
      {
        content: {
          abstract: "Initial placeholder entry.",
          format: "json",
          json: {
            stage: "draft"
          },
          sections: [],
          sources: []
        },
        kind: "technical-note",
        namespace: "product:knowledge",
        subjectId: subject.id,
        title: "Knowledge MVP notes"
      },
      workspace
    );

    await updateKnowledgeSubject(
      subject.id,
      {
        profile: {
          aliases: ["KB"],
          facts: [],
          goals: ["Support agents and humans"],
          preferences: ["Typed storage"],
          recentFocus: ["MVP"],
          workingStyle: ["Local-first"]
        },
        summary: "The product family for knowledge and long-term memory."
      },
      workspace
    );
    await updateKnowledgeEntry(
      entry.id,
      {
        lastReviewedAt: "2026-03-13T15:00:00.000Z",
        status: "review-needed",
        tags: ["mvp", "review"]
      },
      workspace
    );
    const sync = await importRepositoryKnowledge(workspace);
    const snapshot = await getKnowledgeWorkspace(workspace);

    expect(sync.scanned).toBe(1);
    expect(snapshot.summary.repositoryDocs).toBe(1);
    expect(snapshot.entries.some((knowledgeEntry) => knowledgeEntry.kind === "doc-mirror")).toBe(true);
    expect(snapshot.entries.find((knowledgeEntry) => knowledgeEntry.id === entry.id)?.status).toBe("review-needed");
  });

  it("filters, promotes, and packages memory entries by role and tier", async () => {
    const workspace = await createTestKnowledgeContext("knowledge-service-memory");
    workspaces.push(workspace);

    const entry = await createKnowledgeEntry(
      {
        content: {
          abstract: "TypeScript and React are preferred for frontend work.",
          format: "hybrid",
          memory: {
            agentRoles: ["orchestrator", "coder"],
            confidence: "high",
            reactivationCount: 2,
            reviewState: "approved",
            sharedAcrossAgents: true,
            sourceType: "user-stated",
            tier: "archive"
          },
          markdown: "Prefer TypeScript/React and keep branches low-conflict.",
          sections: [],
          sources: []
        },
        createdByKind: "agent",
        kind: "agent-memory",
        namespace: "human:primary",
        tags: ["preferences"],
        title: "Frontend stack preference"
      },
      workspace
    );

    const memoryEntries = findKnowledgeMemoryEntries([entry], { agentRole: "coder", tier: "archive" });
    const contextPack = getKnowledgeMemoryContextPack([entry], { agentRole: "coder", tier: "archive" });
    const promoted = promoteKnowledgeMemoryEntry(entry, "2026-03-21T01:00:00.000Z", {
      agentRoles: ["coder", "orchestrator"],
      sharedAcrossAgents: true,
      tier: "medium-term"
    });

    expect(memoryEntries).toHaveLength(1);
    expect(contextPack.entries).toHaveLength(1);
    expect(contextPack.tier).toBe("archive");
    expect(promoted.content.memory.tier).toBe("medium-term");
    expect(promoted.content.memory.reactivationCount).toBe(3);
    expect(promoted.lastReviewedAt).toBe("2026-03-21T01:00:00.000Z");
  });
});
