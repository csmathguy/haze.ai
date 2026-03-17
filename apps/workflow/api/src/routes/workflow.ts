import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getWorkflowPrismaClient } from "../db/client.js";
import * as agentService from "../services/agent-service.js";
import * as skillService from "../services/skill-service.js";

export interface WorkflowPersistenceOptions {
  readonly databaseUrl?: string;
  readonly pollIntervalMs?: number;
}

// ============================================================================
// Zod Schemas for Agent CRUD
// ============================================================================

const AgentCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.string().optional(),
  tier: z.string().optional(),
  allowedSkillIds: z.string().optional(),
  version: z.string().optional(),
  metadata: z.string().optional()
});

const AgentUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  model: z.string().optional(),
  tier: z.string().optional(),
  allowedSkillIds: z.string().optional(),
  version: z.string().optional(),
  metadata: z.string().optional(),
  status: z.string().optional()
});

// ============================================================================
// Zod Schemas for Skill CRUD
// ============================================================================

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

const SkillUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  version: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
  executionMode: z.string().optional(),
  permissions: z.string().optional(),
  status: z.string().optional()
});

function notImplemented() {
  return { error: "not implemented" };
}

export function registerWorkflowRoutes(app: FastifyInstance): void {
  // Workflow Definitions
  app.post("/api/workflow/definitions", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.get("/api/workflow/definitions", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.get("/api/workflow/definitions/:name", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });

  // Workflow Runs
  app.post("/api/workflow/runs", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.get("/api/workflow/runs", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.get("/api/workflow/runs/:id", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.post("/api/workflow/runs/:id/signal", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.delete("/api/workflow/runs/:id", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });

  // Workflow Events
  app.get("/api/workflow/events", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = z.object({
        runId: z.string().optional(),
        limit: z.coerce.number().int().positive().default(50)
      }).parse(request.query);

      const prisma = await getWorkflowPrismaClient();
      try {
        const events = await prisma.workflowEvent.findMany({
          where: params.runId ? { correlationId: params.runId } : {},
          orderBy: { occurredAt: "desc" },
          take: params.limit
        });

        return { events };
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400);
        return { error: "Invalid query parameters", details: error.issues };
      }
      throw error;
    }
  });

  // Agents
  app.get("/api/workflow/agents", async (request: FastifyRequest, reply: FastifyReply) => {
    const prisma = await getWorkflowPrismaClient();
    try {
      const agents = await agentService.listAgents(prisma);
      return { agents };
    } finally {
      await prisma.$disconnect();
    }
  });

  app.post("/api/workflow/agents", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = AgentCreateSchema.parse(request.body);
      const prisma = await getWorkflowPrismaClient();
      try {
        const agent = await agentService.createAgent(prisma, body);
        reply.code(201);
        return { agent };
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400);
        return { error: "Invalid request body", details: error.issues };
      }
      throw error;
    }
  });

  app.get("/api/workflow/agents/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const prisma = await getWorkflowPrismaClient();
      try {
        const agent = await agentService.getAgent(prisma, params.id);
        if (!agent) {
          reply.code(404);
          return { error: "Agent not found" };
        }
        return { agent };
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400);
        return { error: "Invalid request params", details: error.issues };
      }
      throw error;
    }
  });

  // Skills
  app.get("/api/workflow/skills", async (request: FastifyRequest, reply: FastifyReply) => {
    const prisma = await getWorkflowPrismaClient();
    try {
      const skills = await skillService.listSkills(prisma);
      return { skills };
    } finally {
      await prisma.$disconnect();
    }
  });

  app.post("/api/workflow/skills", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = SkillCreateSchema.parse(request.body);
      const prisma = await getWorkflowPrismaClient();
      try {
        const skill = await skillService.createSkill(prisma, body);
        reply.code(201);
        return { skill };
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400);
        return { error: "Invalid request body", details: error.issues };
      }
      throw error;
    }
  });

  app.get("/api/workflow/skills/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = z.object({ id: z.string() }).parse(request.params);
      const prisma = await getWorkflowPrismaClient();
      try {
        const skill = await skillService.getSkill(prisma, params.id);
        if (!skill) {
          reply.code(404);
          return { error: "Skill not found" };
        }
        return { skill };
      } finally {
        await prisma.$disconnect();
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        reply.code(400);
        return { error: "Invalid request params", details: error.issues };
      }
      throw error;
    }
  });

  // Approvals
  app.get("/api/workflow/approvals", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.post("/api/workflow/approvals/:id/respond", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
}
