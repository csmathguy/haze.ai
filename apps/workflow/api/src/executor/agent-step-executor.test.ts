import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@taxes/db";
import { getPrismaClient } from "@taxes/db";
import { applyPendingMigrations } from "../db/migrations.js";
import { AgentStepExecutor } from "./agent-step-executor.js";
import type { AgentStep, WorkflowRun } from "@taxes/shared";

describe("AgentStepExecutor", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    const testDbFile = join(tmpdir(), `agent-executor-test-${randomUUID()}.db`);
    const testDbUrl = `file:${testDbFile}`;
    await applyPendingMigrations(testDbUrl);
    db = await getPrismaClient(testDbUrl);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("handles missing agent gracefully", async () => {
    const executor = new AgentStepExecutor();

    // Persist the workflow run to the database for foreign key constraint
    const persistedRun = await db.workflowRun.create({
      data: {
        id: `run_${randomUUID()}`,
        definitionId: "def_test",
        definitionName: "test-workflow",
        version: "1.0.0",
        status: "running",
        currentStep: "step_1",
        startedAt: new Date(),
        updatedAt: new Date()
      }
    });

    const workflowRun: WorkflowRun = {
      id: persistedRun.id,
      definitionName: "test-workflow",
      version: "1.0.0",
      status: "running",
      currentStepId: "step_1",
      contextJson: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const agentStep: AgentStep = {
      type: "agent",
      id: "step_1",
      label: "Test Agent Step",
      agentId: "nonexistent-agent",
      model: "claude-opus-4",
      providerFamily: "anthropic",
      runtimeKind: "claude-code-subagent",
      skillIds: [],
      outputSchema: {} as never
    };

    const result = await executor.execute(db, workflowRun, agentStep);

    expect(result).toBeDefined();
    expect(result.type).toBe("step-failed");
    expect(result.reason).toContain("Agent not found");
  });

  it("records step run with agent metadata", async () => {
    // Create test agent and skill
    const agent = await db.agent.create({
      data: {
        name: `test-agent-${randomUUID()}`,
        model: "claude-opus-4",
        tier: "3",
        providerFamily: "anthropic",
        runtimeKind: "claude-code-subagent",
        status: "active"
      }
    });

    const skill = await db.skill.create({
      data: {
        name: `skill-${randomUUID()}`,
        version: "1.0.0",
        status: "active"
      }
    });

    // Persist the workflow run to the database for foreign key constraint
    const persistedRun = await db.workflowRun.create({
      data: {
        id: `run_${randomUUID()}`,
        definitionId: "def_test",
        definitionName: "test-workflow",
        version: "1.0.0",
        status: "running",
        currentStep: "step_1",
        startedAt: new Date(),
        updatedAt: new Date()
      }
    });

    const workflowRun: WorkflowRun = {
      id: persistedRun.id,
      definitionName: "test-workflow",
      version: "1.0.0",
      status: "running",
      currentStepId: "step_1",
      contextJson: { input: { test: "data" } },
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const agentStep: AgentStep = {
      type: "agent",
      id: "step_1",
      label: "Test Agent Step",
      agentId: agent.id,
      model: agent.model,
      providerFamily: "anthropic",
      // Use "api" runtimeKind which throws immediately (not yet implemented),
      // so the test fails fast without spawning a real subprocess
      runtimeKind: "api",
      skillIds: [skill.id],
      outputSchema: {} as never
    };

    const executor = new AgentStepExecutor();

    // Fails immediately (api runtimeKind not implemented), but we're testing error handling and metadata recording
    const result = await executor.execute(db, workflowRun, agentStep);

    // Should fail (no actual CLI available in test), but record the step run
    expect(result).toBeDefined();
    expect(result.stepRun).toBeDefined();
    expect(result.stepRun.nodeType).toBe("agent");
    expect(result.stepRun.agentId).toBe(agent.id);
    expect(result.stepRun.skillIds).toContain(skill.id);
    expect(result.stepRun.model).toBe(agent.model);
  });

  it("rejects disallowed skills", async () => {
    const executor = new AgentStepExecutor();

    // Create agent with restricted skills
    const agent = await db.agent.create({
      data: {
        name: `test-agent-restricted-${randomUUID()}`,
        model: "claude-opus-4",
        tier: "3",
        providerFamily: "anthropic",
        runtimeKind: "claude-code-subagent",
        allowedSkillIds: "skill-1,skill-2",
        status: "active"
      }
    });

    // Persist the workflow run to the database for foreign key constraint
    const persistedRun = await db.workflowRun.create({
      data: {
        id: `run_${randomUUID()}`,
        definitionId: "def_test",
        definitionName: "test-workflow",
        version: "1.0.0",
        status: "running",
        currentStep: "step_1",
        startedAt: new Date(),
        updatedAt: new Date()
      }
    });

    const workflowRun: WorkflowRun = {
      id: persistedRun.id,
      definitionName: "test-workflow",
      version: "1.0.0",
      status: "running",
      currentStepId: "step_1",
      contextJson: {},
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Try to use a disallowed skill
    const agentStep: AgentStep = {
      type: "agent",
      id: "step_1",
      label: "Test Agent Step",
      agentId: agent.id,
      model: agent.model,
      providerFamily: "anthropic",
      runtimeKind: "claude-code-subagent",
      skillIds: ["skill-forbidden"],
      outputSchema: {} as never
    };

    const result = await executor.execute(db, workflowRun, agentStep);

    expect(result).toBeDefined();
    expect(result.type).toBe("step-failed");
    expect(result.reason).toContain("not allowed");
  });
});
