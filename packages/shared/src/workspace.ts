import { z } from "zod";

import { AssetLotSchema, BitcoinDispositionSchema, BitcoinLotSchema, BitcoinLotSelectionSchema, TaxScenarioSchema } from "./assets.js";
import { ReviewSeveritySchema } from "./common.js";
import type { DocumentKind, ImportedDocument } from "./documents.js";
import { DocumentKindSchema, ImportedDocumentSchema } from "./documents.js";
import { DataGapSchema, DocumentExtractionSchema } from "./extraction.js";
import { QuestionnairePromptSchema } from "./questionnaire.js";
import { HouseholdProfileSchema, TaxReturnDraftSchema } from "./tax-return.js";
import { BitcoinBasisProfileSchema, LedgerTransactionSchema, TransactionImportSessionSchema, TransferMatchSchema } from "./transactions.js";

export const ReviewTaskSchema = z.object({
  actionLabel: z.string().min(1),
  documentId: z.string().min(1).optional(),
  id: z.string().min(1),
  reason: z.string().min(1),
  severity: ReviewSeveritySchema,
  title: z.string().min(1)
});
export const FilingChecklistItemStatusSchema = z.enum(["present", "missing", "incomplete"]);
export const FilingReadinessStatusSchema = z.enum(["ready", "needs-documents", "needs-review"]);
export const FilingChecklistItemSchema = z.object({
  blocker: z.boolean(),
  expectedDocumentKinds: z.array(DocumentKindSchema),
  id: z.string().min(1),
  label: z.string().min(1),
  presentDocumentIds: z.array(z.string().min(1)),
  status: FilingChecklistItemStatusSchema
});
export const FilingChecklistSectionSchema = z.object({
  items: z.array(FilingChecklistItemSchema),
  jurisdiction: z.enum(["federal", "state"]),
  readiness: FilingReadinessStatusSchema
});
export const FilingReadinessChecklistSchema = z.object({
  differsByJurisdiction: z.boolean(),
  federal: FilingChecklistSectionSchema,
  filingStatus: HouseholdProfileSchema.shape.filingStatus,
  state: FilingChecklistSectionSchema,
  stateResidence: z.string().min(2),
  taxYear: HouseholdProfileSchema.shape.taxYear
});
export const WorkspaceSnapshotSchema = z.object({
  assetLots: z.array(AssetLotSchema),
  bitcoinDispositions: z.array(BitcoinDispositionSchema),
  dataGaps: z.array(DataGapSchema),
  documents: z.array(ImportedDocumentSchema),
  draft: TaxReturnDraftSchema,
  extractions: z.array(DocumentExtractionSchema),
  filingChecklist: FilingReadinessChecklistSchema,
  generatedAt: z.iso.datetime(),
  bitcoinBasis: BitcoinBasisProfileSchema,
  bitcoinLotSelections: z.array(BitcoinLotSelectionSchema),
  bitcoinLots: z.array(BitcoinLotSchema),
  household: HouseholdProfileSchema,
  importSessions: z.array(TransactionImportSessionSchema),
  localOnly: z.literal(true),
  questionnaire: z.array(QuestionnairePromptSchema),
  reviewQueue: z.array(ReviewTaskSchema),
  scenarios: z.array(TaxScenarioSchema),
  transferMatches: z.array(TransferMatchSchema),
  transactions: z.array(LedgerTransactionSchema)
});

export type ReviewTask = z.infer<typeof ReviewTaskSchema>;
export type WorkspaceSnapshot = z.infer<typeof WorkspaceSnapshotSchema>;
export type FilingReadinessChecklist = z.infer<typeof FilingReadinessChecklistSchema>;

interface ChecklistTemplateItem {
  readonly blocker?: boolean;
  readonly expectedDocumentKinds: readonly DocumentKind[];
  readonly id: string;
  readonly label: string;
  readonly matchesDocument?: (document: ImportedDocument) => boolean;
  readonly requiresDigitalAssets?: boolean;
}

const FEDERAL_CHECKLIST_ITEMS: readonly ChecklistTemplateItem[] = [
  {
    expectedDocumentKinds: ["w-2", "1099-int", "1099-div", "retirement-distribution", "schedule-k-1", "other-income"],
    id: "income-records",
    label: "Income source records"
  },
  {
    blocker: false,
    expectedDocumentKinds: ["1098", "charitable-contribution", "property-tax-statement"],
    id: "deduction-records",
    label: "Deduction support records"
  },
  {
    expectedDocumentKinds: ["1099-b", "1099-da", "brokerage-statement", "crypto-wallet-export"],
    id: "capital-activity-records",
    label: "Brokerage or digital-asset activity",
    requiresDigitalAssets: true
  },
  {
    expectedDocumentKinds: ["prior-year-return"],
    id: "prior-year-reference",
    label: "Prior-year federal reference return",
    matchesDocument: (document) => !/\bstate\b/iu.test(document.fileName)
  }
];

const STATE_CHECKLIST_ITEMS: readonly ChecklistTemplateItem[] = [
  {
    expectedDocumentKinds: ["w-2", "retirement-distribution", "schedule-k-1"],
    id: "state-income-records",
    label: "State income and withholding records"
  },
  {
    blocker: false,
    expectedDocumentKinds: ["property-tax-statement", "charitable-contribution"],
    id: "state-adjustment-records",
    label: "State adjustment and deduction records"
  },
  {
    expectedDocumentKinds: ["1099-da", "crypto-wallet-export"],
    id: "state-digital-asset-records",
    label: "State digital-asset support records",
    requiresDigitalAssets: true
  },
  {
    expectedDocumentKinds: ["prior-year-return"],
    id: "state-prior-year-reference",
    label: "Prior-year state reference return",
    matchesDocument: (document) => /\bstate\b/iu.test(document.fileName)
  }
];

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

export function buildFilingReadinessChecklist(input: {
  readonly documents: WorkspaceSnapshot["documents"];
  readonly household: WorkspaceSnapshot["household"];
}): FilingReadinessChecklist {
  const federalItems = buildChecklistItems(FEDERAL_CHECKLIST_ITEMS, input.documents, input.household.taxYear, input.household.hasDigitalAssets);
  const stateItems = buildChecklistItems(STATE_CHECKLIST_ITEMS, input.documents, input.household.taxYear, input.household.hasDigitalAssets);
  const federalReadiness = evaluateReadiness(federalItems);
  const stateReadiness = evaluateReadiness(stateItems);

  return {
    differsByJurisdiction: federalReadiness !== stateReadiness,
    federal: {
      items: federalItems,
      jurisdiction: "federal",
      readiness: federalReadiness
    },
    filingStatus: input.household.filingStatus,
    state: {
      items: stateItems,
      jurisdiction: "state",
      readiness: stateReadiness
    },
    stateResidence: input.household.stateResidence,
    taxYear: input.household.taxYear
  };
}

function buildChecklistItems(
  templates: readonly ChecklistTemplateItem[],
  documents: readonly ImportedDocument[],
  taxYear: number,
  hasDigitalAssets: boolean
): FilingReadinessChecklist["federal"]["items"] {
  return templates.map((template) => {
    const defaultBlocker = template.blocker ?? true;
    const isBlocker = template.requiresDigitalAssets === true ? hasDigitalAssets && defaultBlocker : defaultBlocker;
    const matchingDocuments = documents.filter((document) => {
      if (document.taxYear !== taxYear || !template.expectedDocumentKinds.includes(document.kind)) {
        return false;
      }

      return template.matchesDocument?.(document) ?? true;
    });

    return {
      blocker: isBlocker,
      expectedDocumentKinds: [...template.expectedDocumentKinds],
      id: template.id,
      label: template.label,
      presentDocumentIds: matchingDocuments.map((document) => document.id),
      status: deriveChecklistItemStatus(matchingDocuments)
    };
  });
}

function deriveChecklistItemStatus(documents: readonly ImportedDocument[]): z.infer<typeof FilingChecklistItemStatusSchema> {
  if (documents.length === 0) {
    return "missing";
  }

  if (documents.some((document) => document.status === "needs-review" || document.missingFacts.length > 0)) {
    return "incomplete";
  }

  return "present";
}

function evaluateReadiness(items: FilingReadinessChecklist["federal"]["items"]): z.infer<typeof FilingReadinessStatusSchema> {
  const blockingItems = items.filter((item) => item.blocker);

  if (blockingItems.some((item) => item.status === "missing")) {
    return "needs-documents";
  }

  if (blockingItems.some((item) => item.status === "incomplete")) {
    return "needs-review";
  }

  return "ready";
}
