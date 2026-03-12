import {
  AssetLotSchema,
  buildQuestionnairePrompts,
  createEmptyTaxReturnDraft,
  createReviewTasksFromDataGaps,
  DataGapSchema,
  deriveRequiredForms,
  DocumentExtractionSchema,
  HouseholdProfileSchema,
  makeUsd,
  type TaxScenario,
  type WorkspaceSnapshot
} from "@taxes/shared";

import { getPrismaClient } from "../db/client.js";
import type { WorkspacePersistenceOptions } from "./context.js";
import { listImportedDocuments } from "./document-store.js";

const HOUSEHOLD_PROFILE_ID = 1;

export async function getWorkspaceSnapshot(options: WorkspacePersistenceOptions = {}): Promise<WorkspaceSnapshot> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const documents = await listImportedDocuments(options);
  const activeTaxYear = inferActiveTaxYear();
  const state = await loadWorkspaceState(prisma, activeTaxYear);
  const household = buildHouseholdProfile(state.storedHousehold, documents);
  const parsedGaps = mapDataGaps(state.gaps);
  const draft = buildDraft(documents, household);

  return {
    assetLots: mapAssetLots(state.assetLots),
    dataGaps: parsedGaps,
    documents,
    draft,
    extractions: mapDocumentExtractions(state.extractions),
    generatedAt: new Date().toISOString(),
    household,
    localOnly: true,
    questionnaire: buildQuestionnairePrompts({
      documents,
      gaps: parsedGaps,
      household,
      responses: mapQuestionnaireResponses(state.questionnaireResponses),
      taxYear: household.taxYear
    }),
    reviewQueue: createReviewTasksFromDataGaps(parsedGaps),
    scenarios: buildScenarioTemplates()
  };
}

async function loadWorkspaceState(prisma: Awaited<ReturnType<typeof getPrismaClient>>, activeTaxYear: number) {
  const storedHousehold = await prisma.householdProfile.upsert({
    create: createDefaultHousehold(activeTaxYear),
    update: {},
    where: {
      id: HOUSEHOLD_PROFILE_ID
    }
  });
  const assetLots = await prisma.assetLot.findMany({
    orderBy: [{ assetKey: "asc" }, { acquiredOn: "asc" }]
  });
  const extractions = await prisma.documentExtraction.findMany({
    include: {
      fields: {
        orderBy: {
          key: "asc"
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
  const gaps = await prisma.dataGap.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "asc" }]
  });
  const questionnaireResponses = await prisma.questionnaireResponse.findMany({
    orderBy: {
      answeredAt: "desc"
    },
    where: {
      taxYear: activeTaxYear
    }
  });

  return {
    assetLots,
    extractions,
    gaps,
    questionnaireResponses,
    storedHousehold
  };
}

function buildDraftNotes(documents: WorkspaceSnapshot["documents"]): string[] {
  if (documents.length === 0) {
    return ["Upload tax documents to build the draft 1040 package and capital-gains review queue."];
  }

  return [
    `${documents.length.toString()} document(s) uploaded for review.`,
    "Structured extraction records, questionnaire prompts, and lot-reconciliation gaps are now part of the local workspace model."
  ];
}

function buildDraft(documents: WorkspaceSnapshot["documents"], household: WorkspaceSnapshot["household"]) {
  const draft = createEmptyTaxReturnDraft(household.taxYear);

  draft.household = household;
  draft.requiredForms = deriveRequiredForms(documents);
  draft.notes = buildDraftNotes(documents);

  return draft;
}

function buildHouseholdProfile(storedHousehold: WorkspaceState["storedHousehold"], documents: WorkspaceSnapshot["documents"]) {
  return HouseholdProfileSchema.parse({
    filingStatus: storedHousehold.filingStatus,
    hasDigitalAssets:
      storedHousehold.hasDigitalAssets ||
      documents.some((document) => document.kind === "1099-da" || document.kind === "crypto-wallet-export"),
    primaryTaxpayer: storedHousehold.primaryTaxpayer,
    stateResidence: storedHousehold.stateResidence,
    taxYear: storedHousehold.taxYear
  });
}

function mapAssetLots(assetLots: WorkspaceState["assetLots"]) {
  return assetLots.map((lot) =>
    AssetLotSchema.parse({
      accountName: lot.accountName,
      acquiredOn: lot.acquiredOn,
      assetKey: lot.assetKey,
      assetKind: lot.assetKind,
      costBasis: makeUsd(lot.costBasisInCents),
      displayName: lot.displayName,
      holdingTerm: lot.holdingTerm,
      id: lot.id,
      quantity: lot.quantity,
      sourceDocumentId: lot.sourceDocumentId ?? undefined
    })
  );
}

function mapDataGaps(gaps: WorkspaceState["gaps"]) {
  return gaps.map((gap) =>
    DataGapSchema.parse({
      description: gap.description,
      documentId: gap.documentId ?? undefined,
      extractedFieldId: gap.extractedFieldId ?? undefined,
      gapKind: gap.gapKind,
      id: gap.id,
      key: gap.key,
      severity: gap.severity,
      status: gap.status,
      title: gap.title
    })
  );
}

function mapDocumentExtractions(extractions: WorkspaceState["extractions"]) {
  return extractions.map((extraction) =>
    DocumentExtractionSchema.parse({
      createdAt: extraction.createdAt.toISOString(),
      documentId: extraction.documentId,
      extractorKey: extraction.extractorKey,
      fields: extraction.fields.map((field) => ({
        confidence: field.confidence,
        id: field.id,
        isMissing: field.isMissing,
        key: field.key,
        label: field.label,
        normalizedValue: field.normalizedValue ?? undefined,
        provenanceHint: field.provenanceHint ?? undefined,
        rawValue: field.rawValue,
        sourceDocumentId: field.documentId,
        sourcePage: field.sourcePage ?? undefined,
        taxRelevance: field.taxRelevance,
        valueType: field.valueType
      })),
      id: extraction.id,
      parsedAt: extraction.parsedAt?.toISOString(),
      status: extraction.status,
      statusMessage: extraction.statusMessage ?? undefined,
      updatedAt: extraction.updatedAt.toISOString()
    })
  );
}

function mapQuestionnaireResponses(questionnaireResponses: WorkspaceState["questionnaireResponses"]) {
  return questionnaireResponses.map((response) => ({
    answeredAt: response.answeredAt.toISOString(),
    promptKey: response.promptKey,
    value: response.value
  }));
}

function buildScenarioTemplates(): TaxScenario[] {
  return [
    {
      description: "Baseline comparison using FIFO disposal assumptions.",
      estimatedFederalTax: makeUsd(0),
      id: "scenario-fifo",
      lotSelectionMethod: "fifo",
      name: "FIFO baseline",
      realizedLongTermGain: makeUsd(0),
      realizedShortTermGain: makeUsd(0)
    },
    {
      description: "Prioritize higher basis lots when specific identification is available.",
      estimatedFederalTax: makeUsd(0),
      id: "scenario-high-basis",
      lotSelectionMethod: "highest-basis",
      name: "High basis focus",
      realizedLongTermGain: makeUsd(0),
      realizedShortTermGain: makeUsd(0)
    },
    {
      description: "User-directed lot selection once all acquisition data is reconciled.",
      estimatedFederalTax: makeUsd(0),
      id: "scenario-specific-id",
      lotSelectionMethod: "specific-identification",
      name: "Specific identification",
      realizedLongTermGain: makeUsd(0),
      realizedShortTermGain: makeUsd(0)
    }
  ];
}

function inferActiveTaxYear(now: Date = new Date()): number {
  return now.getMonth() <= 5 ? now.getFullYear() - 1 : now.getFullYear();
}

function createDefaultHousehold(taxYear: number) {
  return {
    filingStatus: "single",
    hasDigitalAssets: false,
    id: HOUSEHOLD_PROFILE_ID,
    primaryTaxpayer: "Local workspace owner",
    stateResidence: "NY",
    taxYear
  };
}

type WorkspaceState = Awaited<ReturnType<typeof loadWorkspaceState>>;
