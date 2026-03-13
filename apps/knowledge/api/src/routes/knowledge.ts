import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CreateKnowledgeEntryInputSchema,
  CreateKnowledgeSubjectInputSchema,
  UpdateKnowledgeEntryInputSchema,
  UpdateKnowledgeSubjectInputSchema
} from "@taxes/shared";
import type { ZodType } from "zod";

import type { KnowledgePersistenceOptions } from "../services/context.js";
import {
  createKnowledgeEntry,
  createKnowledgeSubject,
  getKnowledgeWorkspace,
  importRepositoryKnowledge,
  KnowledgeConflictError,
  KnowledgeNotFoundError,
  updateKnowledgeEntry,
  updateKnowledgeSubject
} from "../services/knowledge.js";

export function registerKnowledgeRoutes(app: FastifyInstance, options: KnowledgePersistenceOptions = {}): void {
  app.get("/api/knowledge/workspace", async () => ({
    workspace: await getKnowledgeWorkspace(options)
  }));

  app.post("/api/knowledge/subjects", async (request, reply) => {
    try {
      const input = readBody(request.body, CreateKnowledgeSubjectInputSchema);
      const subject = await createKnowledgeSubject(input, options);

      reply.code(201);
      return { subject };
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.patch("/api/knowledge/subjects/:subjectId", async (request, reply) => {
    try {
      const input = readBody(request.body, UpdateKnowledgeSubjectInputSchema);
      const subject = await updateKnowledgeSubject((request.params as { subjectId: string }).subjectId, input, options);

      return { subject };
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.post("/api/knowledge/entries", async (request, reply) => {
    try {
      const input = readBody(request.body, CreateKnowledgeEntryInputSchema);
      const entry = await createKnowledgeEntry(input, options);

      reply.code(201);
      return { entry };
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.patch("/api/knowledge/entries/:entryId", async (request, reply) => {
    try {
      const input = readBody(request.body, UpdateKnowledgeEntryInputSchema);
      const entry = await updateKnowledgeEntry((request.params as { entryId: string }).entryId, input, options);

      return { entry };
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });

  app.post("/api/knowledge/bootstrap/repository-docs", async (_request, reply) => {
    try {
      const sync = await importRepositoryKnowledge(options);

      reply.code(202);
      return { sync };
    } catch (error) {
      return sendDomainError(reply, error);
    }
  });
}

function readBody<T>(body: unknown, schema: ZodType<T>): T {
  return schema.parse(body);
}

function sendDomainError(reply: FastifyReply, error: unknown) {
  if (error instanceof KnowledgeConflictError) {
    reply.code(409);
    return { error: error.message };
  }

  if (error instanceof KnowledgeNotFoundError) {
    reply.code(404);
    return { error: error.message };
  }

  reply.code(400);
  return {
    error: error instanceof Error ? error.message : "Invalid knowledge request."
  };
}
