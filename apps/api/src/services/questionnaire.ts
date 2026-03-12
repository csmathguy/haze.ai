import { randomUUID } from "node:crypto";

import { getPrismaClient } from "../db/client.js";
import type { WorkspacePersistenceOptions } from "./context.js";

export interface SaveQuestionnaireResponseInput {
  promptKey: string;
  sourceDocumentId?: string;
  sourceGapId?: string;
  taxYear: number;
  value: string;
}

export async function saveQuestionnaireResponse(
  input: SaveQuestionnaireResponseInput,
  options: WorkspacePersistenceOptions = {}
): Promise<void> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const existingResponse = await prisma.questionnaireResponse.findFirst({
    orderBy: {
      answeredAt: "desc"
    },
    where: {
      promptKey: input.promptKey,
      taxYear: input.taxYear
    }
  });

  if (existingResponse === null) {
    await prisma.questionnaireResponse.create({
      data: {
        answeredAt: new Date(),
        id: randomUUID(),
        promptKey: input.promptKey,
        ...(input.sourceDocumentId === undefined ? {} : { sourceDocumentId: input.sourceDocumentId }),
        ...(input.sourceGapId === undefined ? {} : { sourceGapId: input.sourceGapId }),
        taxYear: input.taxYear,
        value: input.value
      }
    });
    return;
  }

  await prisma.questionnaireResponse.update({
    data: {
      answeredAt: new Date(),
      ...(input.sourceDocumentId === undefined ? {} : { sourceDocumentId: input.sourceDocumentId }),
      ...(input.sourceGapId === undefined ? {} : { sourceGapId: input.sourceGapId }),
      value: input.value
    },
    where: {
      id: existingResponse.id
    }
  });
}
