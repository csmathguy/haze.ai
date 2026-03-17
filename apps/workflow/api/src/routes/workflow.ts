import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import { getWorkflowPrismaClient } from "../db/client.js";

export interface WorkflowPersistenceOptions {
  readonly databaseUrl?: string;
  readonly pollIntervalMs?: number;  // default 1000, set to 0 to disable
}

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
    return registerWorkflowEventsRoute(request, reply);
  });

  // Agents
  app.get("/api/workflow/agents", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.post("/api/workflow/agents", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.get("/api/workflow/agents/:id", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });

  // Skills
  app.get("/api/workflow/skills", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.post("/api/workflow/skills", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
  });
  app.get("/api/workflow/skills/:id", async (_request, reply) => {
    reply.code(501);
    return notImplemented();
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

// ============================================================================
// Workflow Events Route Handler
// ============================================================================

async function registerWorkflowEventsRoute(request: FastifyRequest, reply: FastifyReply) {
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      return { error: "Invalid query parameters", details: error.errors };
    }
    throw error;
  }
}
