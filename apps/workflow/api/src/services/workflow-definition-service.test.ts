import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { applyPendingMigrations } from "../db/migrations.js";
import * as workflowDefinitionService from "./workflow-definition-service.js";

describe("WorkflowDefinitionService", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const tempDir = tmpdir();
    const testDbFile = join(tempDir, `test-workflow-def-${randomUUID()}.db`);
    const testDbUrl = `file:${testDbFile}`;
    await applyPendingMigrations(testDbUrl);
    prisma = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("createDefinition() persists a workflow definition", async () => {
    const input = {
      name: "test-workflow-1",
      version: "1.0",
      description: "Test workflow",
      triggers: ["manual"],
      definitionJson: {
        steps: [
          {
            type: "command",
            id: "step-1",
            label: "Run test",
            scriptPath: "/bin/echo",
            args: ["hello"]
          }
        ]
      }
    };

    const result = await workflowDefinitionService.createDefinition(prisma, input);

    expect(result).toBeDefined();
    expect(result.name).toBe("test-workflow-1");
    expect(result.version).toBe("1.0");
    expect(result.description).toBe("Test workflow");
    expect(result.status).toBe("active");
  });

  it("listDefinitions() returns all active definitions", async () => {
    await workflowDefinitionService.createDefinition(prisma, {
      name: "workflow-a",
      version: "1.0",
      description: "Workflow A",
      triggers: ["manual"],
      definitionJson: {}
    });

    await workflowDefinitionService.createDefinition(prisma, {
      name: "workflow-b",
      version: "1.0",
      description: "Workflow B",
      triggers: ["event"],
      definitionJson: {}
    });

    const results = await workflowDefinitionService.listDefinitions(prisma);

    expect(results.length).toBeGreaterThanOrEqual(2);
    const names = results.map(r => r.name);
    expect(names).toContain("workflow-a");
    expect(names).toContain("workflow-b");
  });

  it("getDefinitionByName() returns latest version by name", async () => {
    const name = "versioned-workflow";

    await workflowDefinitionService.createDefinition(prisma, {
      name,
      version: "1.0",
      description: "v1",
      triggers: ["manual"],
      definitionJson: {}
    });

    await workflowDefinitionService.createDefinition(prisma, {
      name,
      version: "2.0",
      description: "v2",
      triggers: ["manual"],
      definitionJson: {}
    });

    const result = await workflowDefinitionService.getDefinitionByName(prisma, name);

    expect(result).toBeDefined();
    expect(result?.name).toBe(name);
    // The service should return the latest version (2.0)
    expect(result?.version).toBe("2.0");
  });

  it("getDefinitionByName() returns null for nonexistent definition", async () => {
    const result = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "nonexistent-workflow"
    );

    expect(result).toBeNull();
  });

  it("createDefinition() allows multiple versions of same name", async () => {
    const name = "multi-version";

    const v1 = await workflowDefinitionService.createDefinition(prisma, {
      name,
      version: "1.0",
      description: "Version 1",
      triggers: ["manual"],
      definitionJson: { v: 1 }
    });

    const v2 = await workflowDefinitionService.createDefinition(prisma, {
      name,
      version: "2.0",
      description: "Version 2",
      triggers: ["event"],
      definitionJson: { v: 2 }
    });

    expect(v1.id).not.toBe(v2.id);
    expect(v1.name).toBe(v2.name);
    expect(v1.version).not.toBe(v2.version);
  });
});
