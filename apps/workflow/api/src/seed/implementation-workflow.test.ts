import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import { applyPendingMigrations } from "../db/migrations.js";
import { seedImplementationWorkflow } from "./implementation-workflow.js";
import * as workflowDefinitionService from "../services/workflow-definition-service.js";

describe("Implementation Workflow Definition", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const tempDir = tmpdir();
    const testDbFile = join(
      tempDir,
      `test-implementation-workflow-${randomUUID()}.db`
    );
    const testDbUrl = `file:${testDbFile}`;
    await applyPendingMigrations(testDbUrl);
    prisma = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seedImplementationWorkflow() creates the workflow definition", async () => {
    await seedImplementationWorkflow(prisma);

    const definition = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "implementation"
    );

    expect(definition).toBeDefined();
    expect(definition?.name).toBe("implementation");
    expect(definition?.version).toBe("1.0.0");
    expect(definition?.status).toBe("active");
  });

  it("workflow definition contains required metadata", async () => {
    await seedImplementationWorkflow(prisma);

    const definition = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "implementation"
    );

    expect(definition?.description).toContain("planning");
    expect(definition?.description).toContain("worktree");
    expect(definition?.description).toContain("validation");
  });

  it("workflow definition has valid JSON structure", async () => {
    await seedImplementationWorkflow(prisma);

    const definition = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "implementation"
    );

    expect(definition?.definitionJson).toBeDefined();

    if (!definition?.definitionJson) {
      throw new Error("definitionJson is not defined");
    }

    let definitionObj: Record<string, unknown>;
    try {
      definitionObj = JSON.parse(definition.definitionJson) as Record<
        string,
        unknown
      >;
    } catch {
      throw new Error(
        `Failed to parse definitionJson as JSON: ${definition.definitionJson}`
      );
    }

    expect(definitionObj).toHaveProperty("name", "implementation");
    expect(definitionObj).toHaveProperty("version", "1.0.0");
    expect(definitionObj).toHaveProperty("triggers");
    expect(Array.isArray(definitionObj.triggers)).toBe(true);
    const triggers = definitionObj.triggers as string[];
    expect(triggers).toContain("manual");
  });

  it("workflow definition includes all required phases", async () => {
    await seedImplementationWorkflow(prisma);

    const definition = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "implementation"
    );

    if (!definition?.definitionJson) {
      throw new Error("definitionJson is not defined");
    }

    const definitionObj = JSON.parse(definition.definitionJson) as Record<
      string,
      unknown
    >;

    expect(definitionObj).toHaveProperty("steps");
    const steps = definitionObj.steps as Record<string, unknown>[];

    // Check for key phase steps
    const stepIds = steps.map((s) => String(s.id));

    expect(stepIds).toContain("phase-1-check-planning-item");
    expect(stepIds).toContain("phase-2-create-worktree");
    expect(stepIds).toContain("phase-3-implement");
    expect(stepIds).toContain("phase-4-quality-logged");
    expect(stepIds).toContain("phase-4-typecheck");
    expect(stepIds).toContain("phase-5-commit");
    expect(stepIds).toContain("phase-5-push-branch");
    expect(stepIds).toContain("phase-5-sync-pr");
  });

  it("workflow definition includes different step types", async () => {
    await seedImplementationWorkflow(prisma);

    const definition = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "implementation"
    );

    if (!definition?.definitionJson) {
      throw new Error("definitionJson is not defined");
    }

    const definitionObj = JSON.parse(definition.definitionJson) as Record<
      string,
      unknown
    >;
    const steps = definitionObj.steps as Record<string, unknown>[];

    // Extract step types
    const stepTypes = new Set(steps.map((s) => String(s.type)));

    // Verify we have command, agent, approval, and condition steps
    expect(stepTypes).toContain("command");
    expect(stepTypes).toContain("agent");
    expect(stepTypes).toContain("approval");
    expect(stepTypes).toContain("condition");
  });

  it("workflow definition triggers are correctly set", async () => {
    await seedImplementationWorkflow(prisma);

    const definition = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "implementation"
    );

    if (!definition?.triggerEvents) {
      throw new Error("triggerEvents is not defined");
    }

    const triggerEvents = JSON.parse(definition.triggerEvents) as string[];
    expect(triggerEvents).toContain("manual");
  });

  it("workflow definition is idempotent", async () => {
    // Seed twice to verify idempotency
    await seedImplementationWorkflow(prisma);
    await seedImplementationWorkflow(prisma);

    const definitions = await prisma.workflowDefinition.findMany({
      where: {
        name: "implementation"
      }
    });

    // Should only have one version 1.0.0, not duplicate
    const v1_0_0 = definitions.filter((d) => d.version === "1.0.0");
    expect(v1_0_0).toHaveLength(1);
  });

  it("workflow definition contains implementation phase as an agent step", async () => {
    await seedImplementationWorkflow(prisma);

    const definition = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "implementation"
    );

    if (!definition?.definitionJson) {
      throw new Error("definitionJson is not defined");
    }

    const definitionObj = JSON.parse(definition.definitionJson) as Record<
      string,
      unknown
    >;
    const steps = definitionObj.steps as Record<string, unknown>[];

    const implementStep = steps.find(
      (s) => s.id === "phase-3-implement" && s.type === "agent"
    );

    expect(implementStep).toBeDefined();
    if (implementStep) {
      expect(implementStep.agentId).toBe("implementer");
      const skillIds = implementStep.skillIds as string[];
      expect(skillIds).toContain("implementation-workflow");
    }
  });

  it("workflow definition includes human approval gates", async () => {
    await seedImplementationWorkflow(prisma);

    const definition = await workflowDefinitionService.getDefinitionByName(
      prisma,
      "implementation"
    );

    if (!definition?.definitionJson) {
      throw new Error("definitionJson is not defined");
    }

    const definitionObj = JSON.parse(definition.definitionJson) as Record<
      string,
      unknown
    >;
    const steps = definitionObj.steps as Record<string, unknown>[];

    const approvalSteps = steps.filter((s) => s.type === "approval");

    expect(approvalSteps.length).toBeGreaterThanOrEqual(1);
    expect(
      approvalSteps.some((s) => s.id === "phase-5-pr-review")
    ).toBe(true);
  });
});
