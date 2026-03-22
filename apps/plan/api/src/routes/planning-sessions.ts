import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrismaClient } from "@taxes/db";

import type { PlanningPersistenceOptions } from "../services/context.js";

const StartPlanningSessionBodySchema = z.object({
  idea: z.string().min(1, "Idea is required"),
  projectKey: z.string().optional()
});

/**
 * POST /api/planning/sessions/start
 *
 * Creates a new planning workflow run for the PO interview pipeline.
 * Returns the new run ID so the caller can navigate to the workflow run detail page.
 */
export function registerPlanningSessionRoutes(
  app: FastifyInstance,
  options: PlanningPersistenceOptions
): void {
  app.post("/api/planning/sessions/start", async (request, reply) => {
    if (!options.workflowDatabaseUrl) {
      reply.code(503);
      return { error: "Workflow database not configured." };
    }

    let body: z.infer<typeof StartPlanningSessionBodySchema>;
    try {
      body = StartPlanningSessionBodySchema.parse(request.body);
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : "Invalid request body." };
    }

    const workflowDb = await getPrismaClient(options.workflowDatabaseUrl);

    // Look up the active "planning" workflow definition
    const definition = await workflowDb.workflowDefinition.findFirst({
      where: { name: "planning", status: "active" }
    });

    if (!definition) {
      reply.code(404);
      return { error: "Planning workflow definition not found. Ensure the workflow engine is running." };
    }

    const run = await workflowDb.workflowRun.create({
      data: {
        definitionId: definition.id,
        definitionName: "planning",
        version: definition.version,
        status: "pending",
        correlationId: `planning-session-${Date.now().toString()}`,
        contextJson: JSON.stringify({
          input: {
            idea: body.idea,
            projectKey: body.projectKey ?? "planning"
          }
        })
      }
    });

    reply.code(201);
    return { runId: run.id };
  });
}
