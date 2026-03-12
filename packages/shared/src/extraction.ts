import { z } from "zod";

import { ReviewSeveritySchema } from "./common.js";

export const ExtractionStatusSchema = z.enum(["completed", "failed", "needs-review", "pending"]);
export const ExtractedFieldValueTypeSchema = z.enum(["boolean", "currency", "date", "identifier", "integer", "percentage", "quantity", "text"]);
export const TaxRelevanceSchema = z.enum(["informational", "optimization", "required"]);
export const DataGapKindSchema = z.enum(["compliance-question", "document-classification", "missing-source-field", "missing-tax-lot", "optimization-input"]);
export const DataGapStatusSchema = z.enum(["open", "resolved"]);

export const ExtractedFieldSchema = z.object({
  confidence: z.enum(["high", "low", "medium"]),
  id: z.string().min(1),
  isMissing: z.boolean(),
  key: z.string().min(1),
  label: z.string().min(1),
  normalizedValue: z.string().min(1).optional(),
  provenanceHint: z.string().min(1).optional(),
  rawValue: z.string().min(1),
  sourceDocumentId: z.string().min(1),
  sourcePage: z.number().int().positive().optional(),
  taxRelevance: TaxRelevanceSchema,
  valueType: ExtractedFieldValueTypeSchema
});
export const DocumentExtractionSchema = z.object({
  createdAt: z.iso.datetime(),
  documentId: z.string().min(1),
  extractorKey: z.string().min(1),
  fields: z.array(ExtractedFieldSchema),
  id: z.string().min(1),
  parsedAt: z.iso.datetime().optional(),
  status: ExtractionStatusSchema,
  statusMessage: z.string().min(1).optional(),
  updatedAt: z.iso.datetime()
});
export const DataGapSchema = z.object({
  description: z.string().min(1),
  documentId: z.string().min(1).optional(),
  extractedFieldId: z.string().min(1).optional(),
  gapKind: DataGapKindSchema,
  id: z.string().min(1),
  key: z.string().min(1),
  severity: ReviewSeveritySchema,
  status: DataGapStatusSchema,
  title: z.string().min(1)
});

export type DataGap = z.infer<typeof DataGapSchema>;
export type DocumentExtraction = z.infer<typeof DocumentExtractionSchema>;
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;
export type TaxRelevance = z.infer<typeof TaxRelevanceSchema>;

export function createReviewTasksFromDataGaps(gaps: DataGap[]) {
  return gaps
    .filter((gap) => gap.status === "open")
    .map((gap) => ({
      actionLabel: gap.gapKind === "optimization-input" ? "Review optimization input" : "Resolve data gap",
      documentId: gap.documentId,
      id: gap.id,
      reason: gap.description,
      severity: gap.severity,
      title: gap.title
    }));
}
