import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { WorkspacePersistenceOptions } from "../services/context.js";
import { saveQuestionnaireResponse } from "../services/questionnaire.js";

const SaveQuestionnaireResponseSchema = z.object({
  promptKey: z.string().min(1),
  sourceDocumentId: z.string().min(1).optional(),
  sourceGapId: z.string().min(1).optional(),
  taxYear: z.number().int().min(2000).max(2100),
  value: z.string().trim().min(1)
});

export function registerQuestionnaireRoutes(app: FastifyInstance, options: WorkspacePersistenceOptions = {}): void {
  app.post("/api/questionnaire-responses", async (request, reply) => {
    const payload = SaveQuestionnaireResponseSchema.parse(request.body);

    await saveQuestionnaireResponse(
      {
        promptKey: payload.promptKey,
        ...(payload.sourceDocumentId === undefined ? {} : { sourceDocumentId: payload.sourceDocumentId }),
        ...(payload.sourceGapId === undefined ? {} : { sourceGapId: payload.sourceGapId }),
        taxYear: payload.taxYear,
        value: payload.value
      },
      options
    );

    return reply.code(204).send();
  });
}
