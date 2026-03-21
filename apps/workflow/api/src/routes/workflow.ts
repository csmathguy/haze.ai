import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getWorkflowPrismaClient } from "../db/client.js";
import * as agentService from "../services/agent-service.js";
import * as approvalService from "../services/approval-service.js";
import * as skillService from "../services/skill-service.js";
import * as workflowDefinitionService from "../services/workflow-definition-service.js";
import * as workflowRunService from "../services/workflow-run-service.js";

export interface WorkflowPersistenceOptions {
  readonly databaseUrl?: string;
  readonly pollIntervalMs?: number;
}

const AgentCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.string().optional(),
  tier: z.string().optional(),
  allowedSkillIds: z.string().optional(),
  version: z.string().optional(),
  metadata: z.string().optional()
});

const SkillCreateSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
  executionMode: z.string().optional(),
  permissions: z.string().optional()
});

const WorkflowDefinitionCreateSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  triggers: z.array(z.string().min(1)),
  definitionJson: z.record(z.string(), z.unknown())
});

const WorkflowRunCreateSchema = z.object({
  definitionName: z.string().min(1),
  input: z.unknown().optional()
});

const WorkflowRunSignalSchema = z.object({
  type: z.string().min(1),
  correlationKey: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

const WorkflowRunListParamsSchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50)
});

const RespondApprovalBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  respondedBy: z.string().min(1),
  notes: z.string().optional()
});

function registerDefinitionRoutes(app: FastifyInstance, databaseUrl?: string): void {
  app.post("/api/workflow/definitions", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rawBody = WorkflowDefinitionCreateSchema.parse(request.body);
      const body = { ...rawBody, ...(rawBody.description !== undefined ? { description: rawBody.description } : {}) } as typeof rawBody;
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const definition = await workflowDefinitionService.createDefinition(prisma, body);
        reply.code(201);
        return { definition };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request body", details: error.issues }; }
      throw error;
    }
  });

  app.get("/api/workflow/definitions", async () => {
    const prisma = await getWorkflowPrismaClient(databaseUrl);
    try { return { definitions: await workflowDefinitionService.listDefinitions(prisma) }; }
    finally { await prisma.$disconnect(); }
  });

  app.get("/api/workflow/definitions/:name", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name } = z.object({ name: z.string() }).parse(request.params);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const definition = await workflowDefinitionService.getDefinitionByName(prisma, name);
        if (!definition) { reply.code(404); return { error: "Definition not found" }; }
        return { definition };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request params", details: error.issues }; }
      throw error;
    }
  });
}

function registerRunListAndCreateRoutes(app: FastifyInstance, databaseUrl?: string): void {
  app.post("/api/workflow/runs", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = WorkflowRunCreateSchema.parse(request.body);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const result = await workflowRunService.startRun(prisma, { definitionName: body.definitionName, ...(body.input !== undefined ? { input: body.input } : {}) });
        reply.code(201);
        return { run: result.run, effects: result.effects };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request body", details: error.issues }; }
      if (error instanceof Error && error.message.includes("not found")) { reply.code(404); return { error: error.message }; }
      throw error;
    }
  });

  app.get("/api/workflow/runs", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = WorkflowRunListParamsSchema.parse(request.query);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const runs = await workflowRunService.listRuns(prisma, { ...(params.status !== undefined ? { status: params.status } : {}), limit: params.limit });
        return { runs: runs.map(workflowRunService.formatRunForApi) };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid query parameters", details: error.issues }; }
      throw error;
    }
  });

  app.get("/api/workflow/runs/summary", async (request: FastifyRequest, reply: FastifyReply) => {
    const prisma = await getWorkflowPrismaClient(databaseUrl);
    try {
      const now = new Date();
      const stalledThresholdMs = 5 * 60 * 1000; // 5 minutes

      // Get all active runs (not completed/failed)
      const activeRuns = await prisma.workflowRun.findMany({
        where: {
          status: {
            in: ["pending", "running", "waiting"]
          }
        },
        include: {
          workflowStepRuns: {
            orderBy: { startedAt: "desc" },
            take: 1
          }
        },
        orderBy: { startedAt: "desc" },
        take: 100
      });

      // Get recent completed/failed runs (last 10)
      const recentRuns = await prisma.workflowRun.findMany({
        where: {
          status: {
            in: ["completed", "failed", "cancelled"]
          }
        },
        include: {
          workflowStepRuns: {
            orderBy: { startedAt: "desc" },
            take: 1
          }
        },
        orderBy: { completedAt: "desc" },
        take: 10
      });

      // Get all pending approvals
      const pendingApprovals = await prisma.workflowApproval.findMany({
        where: { status: "pending" }
      });

      // Count runs by status
      const counts = await Promise.all([
        prisma.workflowRun.count({ where: { status: "running" } }),
        prisma.workflowRun.count({ where: { status: "waiting" } }),
        prisma.workflowRun.count({ where: { status: "failed" } }),
        prisma.workflowRun.count({ where: { status: "completed" } })
      ]);

      const formatRun = (run: typeof activeRuns[0]) => {
        const lastStepRun = run.workflowStepRuns[0];
        const isStalled = run.status === "waiting" && (now.getTime() - new Date(run.updatedAt).getTime()) > stalledThresholdMs;
        const pendingApproval = pendingApprovals.find(a => a.runId === run.id);

        return {
          id: run.id,
          definitionName: run.definitionName,
          status: run.status,
          currentStep: run.currentStep ?? lastStepRun?.stepId ?? null,
          startedAt: run.startedAt.toISOString(),
          elapsedMs: now.getTime() - new Date(run.startedAt).getTime(),
          isStalled,
          pendingApprovalId: pendingApproval?.id ?? null
        };
      };

      return {
        counts: {
          running: counts[0],
          waiting: counts[1],
          failed: counts[2],
          completed: counts[3]
        },
        activeRuns: activeRuns.map(formatRun),
        recentRuns: recentRuns.map(formatRun)
      };
    } finally { await prisma.$disconnect(); }
  });
}

function registerRunDetailRoutes(app: FastifyInstance, databaseUrl?: string): void {
  app.get("/api/workflow/runs/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const run = await workflowRunService.getRun(prisma, id);
        if (!run) { reply.code(404); return { error: "Run not found" }; }
        return { run: workflowRunService.formatRunForApi(run) };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request params", details: error.issues }; }
      throw error;
    }
  });

  app.post("/api/workflow/runs/:id/signal", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = WorkflowRunSignalSchema.parse(request.body);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const result = await workflowRunService.signalRun(prisma, {
          runId: id,
          event: { type: body.type, ...(body.correlationKey !== undefined ? { correlationKey: body.correlationKey } : {}), ...(body.payload !== undefined ? { payload: body.payload } : {}) }
        });
        return { run: result.run, effects: result.effects };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request body or params", details: error.issues }; }
      if (error instanceof Error && error.message.includes("not found")) { reply.code(404); return { error: error.message }; }
      throw error;
    }
  });

  app.delete("/api/workflow/runs/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const result = await workflowRunService.cancelRun(prisma, id);
        return { run: result.run, effects: result.effects };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request params", details: error.issues }; }
      if (error instanceof Error && error.message.includes("not found")) { reply.code(404); return { error: error.message }; }
      throw error;
    }
  });
}

function registerStepRunRoutes(app: FastifyInstance, databaseUrl?: string): void {
  app.get("/api/workflow/runs/:runId/steps/:stepId", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { runId, stepId } = z.object({ runId: z.string(), stepId: z.string() }).parse(request.params);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const stepRun = await prisma.workflowStepRun.findFirst({
          where: { runId, stepId },
          orderBy: { startedAt: "desc" }
        });
        if (!stepRun) { reply.code(404); return { error: "Step run not found" }; }
        return { stepRun };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request params", details: error.issues }; }
      throw error;
    }
  });
}

function registerRunRoutes(app: FastifyInstance, databaseUrl?: string): void {
  registerRunListAndCreateRoutes(app, databaseUrl);
  registerRunDetailRoutes(app, databaseUrl);
  registerStepRunRoutes(app, databaseUrl);
}

function registerEventRoutes(app: FastifyInstance, databaseUrl?: string): void {
  app.get("/api/workflow/events", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = z.object({
        runId: z.string().optional(),
        limit: z.coerce.number().int().positive().default(50)
      }).parse(request.query);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const events = await prisma.workflowEvent.findMany({
          where: params.runId ? { correlationId: params.runId } : {},
          orderBy: { occurredAt: "desc" },
          take: params.limit
        });
        return { events };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid query parameters", details: error.issues }; }
      throw error;
    }
  });
}

function registerAgentRoutes(app: FastifyInstance, databaseUrl?: string): void {
  app.get("/api/workflow/agents", async () => {
    const prisma = await getWorkflowPrismaClient(databaseUrl);
    try { return { agents: await agentService.listAgents(prisma) }; }
    finally { await prisma.$disconnect(); }
  });

  app.post("/api/workflow/agents", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = AgentCreateSchema.parse(request.body);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try { const agent = await agentService.createAgent(prisma, body); reply.code(201); return { agent }; }
      finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request body", details: error.issues }; }
      throw error;
    }
  });

  app.get("/api/workflow/agents/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const agent = await agentService.getAgent(prisma, id);
        if (!agent) { reply.code(404); return { error: "Agent not found" }; }
        return { agent };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request params", details: error.issues }; }
      throw error;
    }
  });
}

function registerSkillRoutes(app: FastifyInstance, databaseUrl?: string): void {
  app.get("/api/workflow/skills", async () => {
    const prisma = await getWorkflowPrismaClient(databaseUrl);
    try { return { skills: await skillService.listSkills(prisma) }; }
    finally { await prisma.$disconnect(); }
  });

  app.post("/api/workflow/skills", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = SkillCreateSchema.parse(request.body);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try { const skill = await skillService.createSkill(prisma, body); reply.code(201); return { skill }; }
      finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request body", details: error.issues }; }
      throw error;
    }
  });

  app.get("/api/workflow/skills/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const skill = await skillService.getSkill(prisma, id);
        if (!skill) { reply.code(404); return { error: "Skill not found" }; }
        return { skill };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request params", details: error.issues }; }
      throw error;
    }
  });
}

function registerApprovalRoutes(app: FastifyInstance, databaseUrl?: string): void {
  app.get("/api/workflow/approvals", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { runId } = z.object({ runId: z.string().optional() }).parse(request.query);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const approvals = runId !== undefined
          ? await approvalService.listPendingApprovalsByRun(prisma, runId)
          : await approvalService.listPendingApprovals(prisma);
        return { approvals };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid query parameters", details: error.issues }; }
      throw error;
    }
  });

  app.post("/api/workflow/approvals/:id/respond", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = RespondApprovalBodySchema.parse(request.body);
      const prisma = await getWorkflowPrismaClient(databaseUrl);
      try {
        const approval = await approvalService.respondToApproval(prisma, id, {
          decision: body.decision,
          respondedBy: body.respondedBy,
          notes: body.notes
        });
        reply.code(200);
        return { approval };
      } finally { await prisma.$disconnect(); }
    } catch (error) {
      if (error instanceof z.ZodError) { reply.code(400); return { error: "Invalid request", details: error.issues }; }
      throw error;
    }
  });
}

export function registerWorkflowRoutes(app: FastifyInstance, options?: { databaseUrl?: string | undefined }): void {
  const db = options?.databaseUrl;
  registerDefinitionRoutes(app, db);
  registerRunRoutes(app, db);
  registerEventRoutes(app, db);
  registerAgentRoutes(app, db);
  registerSkillRoutes(app, db);
  registerApprovalRoutes(app, db);
}
