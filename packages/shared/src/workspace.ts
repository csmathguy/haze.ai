import { z } from "zod";

import { AssetLotSchema, TaxScenarioSchema } from "./assets.js";
import { ReviewSeveritySchema } from "./common.js";
import { ImportedDocumentSchema } from "./documents.js";
import { DataGapSchema, DocumentExtractionSchema } from "./extraction.js";
import { QuestionnairePromptSchema } from "./questionnaire.js";
import { HouseholdProfileSchema, TaxReturnDraftSchema } from "./tax-return.js";

export const ReviewTaskSchema = z.object({
  actionLabel: z.string().min(1),
  documentId: z.string().min(1).optional(),
  id: z.string().min(1),
  reason: z.string().min(1),
  severity: ReviewSeveritySchema,
  title: z.string().min(1)
});
export const WorkspaceSnapshotSchema = z.object({
  assetLots: z.array(AssetLotSchema),
  dataGaps: z.array(DataGapSchema),
  documents: z.array(ImportedDocumentSchema),
  draft: TaxReturnDraftSchema,
  extractions: z.array(DocumentExtractionSchema),
  generatedAt: z.iso.datetime(),
  household: HouseholdProfileSchema,
  localOnly: z.literal(true),
  questionnaire: z.array(QuestionnairePromptSchema),
  reviewQueue: z.array(ReviewTaskSchema),
  scenarios: z.array(TaxScenarioSchema)
});

export type ReviewTask = z.infer<typeof ReviewTaskSchema>;
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;

export function createReviewTasksFromDocuments(documents: WorkspaceSnapshot["documents"]): ReviewTask[] {
  return documents.flatMap((document) =>
    document.missingFacts.map((fact, index) => ({
      actionLabel: "Fill missing data",
      documentId: document.id,
      id: `${document.id}-${(index + 1).toString()}`,
      reason: fact.reason,
      severity: fact.severity,
      title: `${document.fileName}: ${fact.label}`
    }))
  );
}
