import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateWorkItemInputSchema,
  UpdateAcceptanceCriterionStatusInputSchema,
  UpdateWorkItemInputSchema,
  UpdateWorkItemTaskStatusInputSchema
} from "@taxes/shared";
import type { ZodType } from "zod";

import type { PlanningPersistenceOptions } from "../services/context.js";
import {
  createWorkItem,
  getPlanningWorkspace,
  PlanningNotFoundError,
  updateAcceptanceCriterionStatus,
  updateTaskStatus,
  updateWorkItem
} from "../services/planning.js";

export function registerPlanningRoutes(app: FastifyInstance, options: PlanningPersistenceOptions = {}): void {
  app.get("/api/planning/workspace", async () => ({
    workspace: await getPlanningWorkspace(options)
  }));

  app.post("/api/planning/work-items", async (request, reply) => {
    try {
      const input = readBody(request.body, CreateWorkItemInputSchema);
      const workItem = await createWorkItem(input, options);

      reply.code(201);
      return { workItem };
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.patch("/api/planning/work-items/:workItemId", async (request, reply) => {
    try {
      const input = readBody(request.body, UpdateWorkItemInputSchema);
      await updateWorkItem((request.params as { workItemId: string }).workItemId, input, options);

      reply.code(204);
      return await reply.send();
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.patch("/api/planning/work-items/:workItemId/tasks/:taskId", async (request, reply) => {
    try {
      const input = readBody(request.body, UpdateWorkItemTaskStatusInputSchema);
      const params = request.params as { taskId: string; workItemId: string };

      await updateTaskStatus(params.workItemId, params.taskId, input.status, options);
      reply.code(204);
      return await reply.send();
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.patch("/api/planning/work-items/:workItemId/acceptance-criteria/:criterionId", async (request, reply) => {
    try {
      const input = readBody(request.body, UpdateAcceptanceCriterionStatusInputSchema);
      const params = request.params as { criterionId: string; workItemId: string };

      await updateAcceptanceCriterionStatus(params.workItemId, params.criterionId, input.status, options);
      reply.code(204);
      return await reply.send();
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });
}

function readBody<T>(body: unknown, schema: ZodType<T>): T {
  return schema.parse(body);
}

function sendDomainError(reply: FastifyReply, error: unknown) {
  if (error instanceof PlanningNotFoundError) {
    reply.code(404);
    return { error: error.message };
  }

  reply.code(400);
  return {
    error: error instanceof Error ? error.message : "Invalid planning request."
  };
}
