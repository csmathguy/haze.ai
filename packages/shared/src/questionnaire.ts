import { z } from "zod";

import { TaxYearSchema } from "./common.js";
import type { DataGap } from "./extraction.js";
import type { DocumentKind, ImportedDocument } from "./documents.js";
import type { HouseholdProfile } from "./tax-return.js";

export const QuestionnaireCategorySchema = z.enum(["asset-lots", "compliance", "deductions", "household", "income", "optimization"]);
export const QuestionnaireResponseTypeSchema = z.enum(["boolean", "currency", "date", "select", "text"]);
export const QuestionnairePromptSchema = z.object({
  answeredAt: z.iso.datetime().optional(),
  category: QuestionnaireCategorySchema,
  currentValue: z.string().min(1).optional(),
  helpText: z.string().min(1),
  id: z.string().min(1),
  key: z.string().min(1),
  options: z.array(z.string().min(1)).optional(),
  required: z.boolean(),
  responseType: QuestionnaireResponseTypeSchema,
  sourceDocumentId: z.string().min(1).optional(),
  sourceGapId: z.string().min(1).optional(),
  taxYear: TaxYearSchema,
  title: z.string().min(1)
});

export type QuestionnairePrompt = z.infer<typeof QuestionnairePromptSchema>;

export interface QuestionnaireResponseRecord {
  answeredAt: string;
  promptKey: string;
  value: string;
}

export function buildQuestionnairePrompts(input: BuildQuestionnairePromptsInput): QuestionnairePrompt[] {
  const prompts = createDefaultPrompts(input.taxYear);

  if (input.household.hasDigitalAssets || hasCapitalGainsDocuments(input.documents)) {
    prompts.push(...createCapitalGainsPrompts(input.taxYear));
  }

  prompts.push(...createGapPrompts(input.gaps, input.taxYear));

  return applyResponses(prompts, input.responses);
}

interface BuildQuestionnairePromptsInput {
  documents: ImportedDocument[];
  gaps: DataGap[];
  household: HouseholdProfile;
  responses: QuestionnaireResponseRecord[];
  taxYear: number;
}

function createBasePrompt(input: BasePromptInput): QuestionnairePrompt {
  return {
    category: input.category,
    helpText: input.helpText,
    id: `prompt-${input.key}`,
    key: input.key,
    options: input.options,
    required: true,
    responseType: input.responseType,
    taxYear: input.taxYear,
    title: input.title
  };
}

function createDefaultPrompts(taxYear: number): QuestionnairePrompt[] {
  return [
    createBasePrompt({
      category: "household",
      helpText: "Confirm the filing status that should drive the 2025 return and downstream deduction logic.",
      key: "household-filing-status",
      options: ["single", "married-filing-jointly", "married-filing-separately", "head-of-household", "qualifying-surviving-spouse"],
      responseType: "select",
      taxYear,
      title: "Confirm filing status"
    }),
    createBasePrompt({
      category: "household",
      helpText: "Confirm the primary state residency used for state filing obligations and withholding reconciliation.",
      key: "household-state-residence",
      responseType: "text",
      taxYear,
      title: "Confirm state residence"
    }),
    createBasePrompt({
      category: "optimization",
      helpText: "Carryovers materially affect gain planning, lot selection, and the 2025 federal draft.",
      key: "optimization-capital-loss-carryover",
      responseType: "boolean",
      taxYear,
      title: "Do you have prior-year capital loss carryovers?"
    })
  ];
}

function createCapitalGainsPrompts(taxYear: number): QuestionnairePrompt[] {
  return [
    createBasePrompt({
      category: "asset-lots",
      helpText: "Identify whether additional statements, wallet exports, or manual lot reconciliation will be required.",
      key: "asset-lots-uncovered-basis",
      responseType: "boolean",
      taxYear,
      title: "Do any sales lack basis or acquisition date support?"
    }),
    createBasePrompt({
      category: "asset-lots",
      helpText: "Self-transfers frequently explain missing basis and should be matched before gain calculations are trusted.",
      key: "asset-lots-own-account-transfers",
      responseType: "boolean",
      taxYear,
      title: "Did you transfer assets between your own accounts or wallets?"
    }),
    createBasePrompt({
      category: "optimization",
      helpText: "Capture the planning preference so later scenario analysis has an explicit user baseline.",
      key: "optimization-lot-selection-preference",
      options: ["fifo", "highest-basis", "specific-identification"],
      responseType: "select",
      taxYear,
      title: "Preferred lot-selection strategy when records support it"
    })
  ];
}

function createGapPrompts(gaps: DataGap[], taxYear: number): QuestionnairePrompt[] {
  return gaps
    .filter((gap) => gap.status === "open" && gap.severity !== "info")
    .map((gap) => ({
      category: inferPromptCategory(gap.gapKind),
      helpText: gap.description,
      id: `prompt-${gap.id}`,
      key: `gap-${gap.key}`,
      required: true,
      responseType: "text",
      sourceDocumentId: gap.documentId,
      sourceGapId: gap.id,
      taxYear,
      title: gap.title
    }));
}

function applyResponses(
  prompts: QuestionnairePrompt[],
  responses: QuestionnaireResponseRecord[]
): QuestionnairePrompt[] {
  return prompts.map((prompt) => {
    const response = responses.find((candidate) => candidate.promptKey === prompt.key);

    return response === undefined
      ? prompt
      : {
          ...prompt,
          answeredAt: response.answeredAt,
          currentValue: response.value
        };
  });
}

interface BasePromptInput {
  category: z.infer<typeof QuestionnaireCategorySchema>;
  helpText: string;
  key: string;
  options?: string[]
  responseType: z.infer<typeof QuestionnaireResponseTypeSchema>;
  taxYear: number;
  title: string;
}

function hasCapitalGainsDocuments(documents: ImportedDocument[]): boolean {
  return documents.some((document) => isCapitalGainsDocument(document.kind));
}

function inferPromptCategory(gapKind: DataGap["gapKind"]): z.infer<typeof QuestionnaireCategorySchema> {
  switch (gapKind) {
    case "compliance-question":
      return "compliance";
    case "missing-tax-lot":
      return "asset-lots";
    case "optimization-input":
      return "optimization";
    case "document-classification":
    case "missing-source-field":
      return "income";
  }
}

function isCapitalGainsDocument(kind: DocumentKind): boolean {
  return kind === "1099-b" || kind === "1099-da" || kind === "brokerage-statement" || kind === "crypto-wallet-export";
}
