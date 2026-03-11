import { z } from "zod";

import { makeUsd, MoneySchema, TaxYearSchema } from "./common.js";
import type { DocumentKind, ImportedDocument } from "./documents.js";

export const FilingStatusSchema = z.enum([
  "single",
  "married-filing-jointly",
  "married-filing-separately",
  "head-of-household",
  "qualifying-surviving-spouse"
]);
export const TaxFormKeySchema = z.enum(["1040", "schedule-1", "schedule-b", "schedule-d", "form-8949"]);
export const IncomeCategorySchema = z.enum([
  "wages",
  "taxable-interest",
  "ordinary-dividends",
  "qualified-dividends",
  "capital-gains",
  "retirement-distribution",
  "digital-asset-income",
  "other"
]);
export const DeductionCategorySchema = z.enum([
  "standard",
  "state-local-tax",
  "mortgage-interest",
  "charitable-cash",
  "charitable-noncash",
  "property-tax",
  "other"
]);
export const HouseholdProfileSchema = z.object({
  filingStatus: FilingStatusSchema,
  hasDigitalAssets: z.boolean(),
  primaryTaxpayer: z.string().min(1),
  stateResidence: z.string().min(2),
  taxYear: TaxYearSchema
});
export const IncomeItemSchema = z.object({
  amount: MoneySchema,
  category: IncomeCategorySchema,
  id: z.string().min(1),
  label: z.string().min(1),
  sourceDocumentId: z.string().min(1).optional()
});
export const DeductionItemSchema = z.object({
  amount: MoneySchema,
  category: DeductionCategorySchema,
  id: z.string().min(1),
  label: z.string().min(1),
  sourceDocumentId: z.string().min(1).optional()
});
export const TaxReturnDraftSchema = z.object({
  deductionItems: z.array(DeductionItemSchema),
  household: HouseholdProfileSchema,
  incomeItems: z.array(IncomeItemSchema),
  notes: z.array(z.string()),
  requiredForms: z.array(TaxFormKeySchema)
});

export type DeductionItem = z.infer<typeof DeductionItemSchema>;
export type HouseholdProfile = z.infer<typeof HouseholdProfileSchema>;
export type IncomeItem = z.infer<typeof IncomeItemSchema>;
export type TaxFormKey = z.infer<typeof TaxFormKeySchema>;
export type TaxReturnDraft = z.infer<typeof TaxReturnDraftSchema>;

const FORM_MAP: Readonly<Record<DocumentKind, readonly TaxFormKey[]>> = {
  "1098": ["1040"],
  "1099-b": ["1040", "schedule-d", "form-8949"],
  "1099-da": ["1040", "schedule-d", "form-8949"],
  "1099-div": ["1040", "schedule-b"],
  "1099-int": ["1040", "schedule-b"],
  "brokerage-statement": ["1040", "schedule-d", "form-8949"],
  "charitable-contribution": ["1040", "schedule-1"],
  "crypto-wallet-export": ["1040", "schedule-d", "form-8949"],
  "other-income": ["1040", "schedule-1"],
  "property-tax-statement": ["1040", "schedule-1"],
  "retirement-distribution": ["1040"],
  "schedule-k-1": ["1040", "schedule-1"],
  "unknown": ["1040"],
  "w-2": ["1040"]
};

export function deriveRequiredForms(documents: ImportedDocument[]): TaxFormKey[] {
  const forms = new Set<TaxFormKey>();

  for (const document of documents) {
    for (const form of FORM_MAP[document.kind]) {
      forms.add(form);
    }
  }

  if (documents.length === 0) {
    forms.add("1040");
  }

  return [...forms];
}

export function createEmptyTaxReturnDraft(taxYear: number): TaxReturnDraft {
  return {
    deductionItems: [],
    household: {
      filingStatus: "single",
      hasDigitalAssets: false,
      primaryTaxpayer: "Local workspace owner",
      stateResidence: "NY",
      taxYear
    },
    incomeItems: [],
    notes: ["Review imported source documents before filing."],
    requiredForms: ["1040"]
  };
}

export function createIncomeItem(id: string, label: string, category: IncomeItem["category"], amountInCents: number): IncomeItem {
  return {
    amount: makeUsd(amountInCents),
    category,
    id,
    label
  };
}
