import {
  AssetLotSchema,
  BitcoinBasisMethodSchema,
  BitcoinBasisProfileSchema,
  BitcoinDispositionSchema,
  BitcoinLotSelectionSchema,
  buildFilingReadinessChecklist,
  buildQuestionnairePrompts,
  createEmptyTaxReturnDraft,
  createReviewTasksFromDataGaps,
  DataGapSchema,
  deriveRequiredForms,
  DocumentExtractionSchema,
  HouseholdProfileSchema,
  LedgerTransactionSchema,
  makeUsd,
  TransactionImportSessionSchema,
  TransferMatchSchema,
  type WorkspaceSnapshot
} from "@taxes/shared";

import { getPrismaClient } from "../db/client.js";
import type { WorkspacePersistenceOptions } from "./context.js";
import {
  buildBitcoinDispositions,
  buildBitcoinLotSelections,
  buildBitcoinLots,
  createBitcoinLotSelectionReviewTasks,
} from "./bitcoin-lot-selection.js";
import { buildBitcoinScenarioTemplates } from "./bitcoin-scenarios.js";
import { listImportedDocuments } from "./document-store.js";
import {
  buildBitcoinBasisProfile,
  createBasisReviewTasks,
  createBitcoinBasisReviewTasks,
  createTransferReviewTasks,
  syncTransferMatches
} from "./transaction-reconciliation.js";

const HOUSEHOLD_PROFILE_ID = 1;

export async function getWorkspaceSnapshot(options: WorkspacePersistenceOptions = {}): Promise<WorkspaceSnapshot> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const documents = await listImportedDocuments(options);
  const activeTaxYear = inferActiveTaxYear();
  const state = await loadWorkspaceState(prisma, activeTaxYear);
  const household = buildHouseholdProfile(state.storedHousehold, documents);
  const parsedGaps = mapDataGaps(state.gaps);
  const draft = buildDraft(documents, household);
  const parsedTransactions = mapLedgerTransactions(state.transactions);
  const bitcoinLotSelections = mapBitcoinLotSelections(state.bitcoinLotSelections);
  const originalBitcoinLots = buildBitcoinLots({
    selections: [],
    transactions: parsedTransactions
  });
  const bitcoinLots = buildBitcoinLots({
    selections: bitcoinLotSelections,
    transactions: parsedTransactions
  });
  const bitcoinDispositions = buildBitcoinDispositions({
    lots: bitcoinLots,
    selections: bitcoinLotSelections,
    transactions: parsedTransactions
  });
  const transferMatches = await syncTransferMatches(prisma, parsedTransactions, activeTaxYear);
  const bitcoinBasis = mapBitcoinBasisProfile(state.bitcoinTaxConfiguration, parsedTransactions, activeTaxYear);

  return {
    assetLots: mapAssetLots(state.assetLots),
    bitcoinBasis,
    bitcoinDispositions: mapBitcoinDispositions(bitcoinDispositions),
    bitcoinLotSelections,
    bitcoinLots,
    dataGaps: parsedGaps,
    documents,
    draft,
    extractions: mapDocumentExtractions(state.extractions),
    filingChecklist: buildFilingReadinessChecklist({
      documents,
      household
    }),
    generatedAt: new Date().toISOString(),
    household,
    importSessions: mapImportSessions(state.importSessions),
    localOnly: true,
    questionnaire: buildQuestionnairePrompts({
      documents,
      gaps: parsedGaps,
      household,
      responses: mapQuestionnaireResponses(state.questionnaireResponses),
      taxYear: household.taxYear
    }),
    reviewQueue: [
      ...createReviewTasksFromDataGaps(parsedGaps),
      ...createTransferReviewTasks(transferMatches),
      ...createBasisReviewTasks(parsedTransactions),
      ...createBitcoinBasisReviewTasks(bitcoinBasis),
      ...createBitcoinLotSelectionReviewTasks(bitcoinDispositions)
    ],
    scenarios: buildBitcoinScenarioTemplates(bitcoinDispositions, originalBitcoinLots),
    transferMatches: mapTransferMatches(transferMatches),
    transactions: parsedTransactions
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
  const importSessions = await prisma.transactionImportSession.findMany({
    orderBy: {
      createdAt: "desc"
    }
  });
  const bitcoinTaxConfiguration = await prisma.bitcoinTaxConfiguration.upsert({
    create: createDefaultBitcoinTaxConfiguration(activeTaxYear),
    update: {},
    where: {
      taxYear: activeTaxYear
    }
  });
  const bitcoinLotSelections = await prisma.bitcoinLotSelection.findMany({
    orderBy: {
      createdAt: "asc"
    },
    where: {
      taxYear: activeTaxYear
    }
  });
  const transactions = await prisma.ledgerTransaction.findMany({
    orderBy: {
      occurredAt: "desc"
    }
  });

  return {
    assetLots,
    bitcoinTaxConfiguration,
    bitcoinLotSelections,
    extractions,
    gaps,
    importSessions,
    questionnaireResponses,
    transactions,
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

function mapImportSessions(importSessions: WorkspaceState["importSessions"]) {
  return importSessions.map((session) =>
    TransactionImportSessionSchema.parse({
      createdAt: session.createdAt.toISOString(),
      id: session.id,
      sourceDocumentId: session.sourceDocumentId ?? undefined,
      sourceFileName: session.sourceFileName,
      sourceKind: session.sourceKind,
      sourceLabel: session.sourceLabel,
      status: session.status,
      taxYear: session.taxYear,
      transactionCount: session.transactionCount,
      updatedAt: session.updatedAt.toISOString()
    })
  );
}

function mapBitcoinBasisProfile(
  bitcoinTaxConfiguration: WorkspaceState["bitcoinTaxConfiguration"],
  transactions: readonly ReturnType<typeof LedgerTransactionSchema.parse>[],
  activeTaxYear: number
) {
  return BitcoinBasisProfileSchema.parse(
    buildBitcoinBasisProfile({
      explanation: bitcoinTaxConfiguration.explanation,
      method: BitcoinBasisMethodSchema.parse(bitcoinTaxConfiguration.transitionMethod),
      recordedAt: bitcoinTaxConfiguration.recordedAt.toISOString(),
      taxYear: activeTaxYear,
      transactions,
      updatedAt: bitcoinTaxConfiguration.updatedAt.toISOString()
    })
  );
}

function mapBitcoinDispositions(dispositions: ReturnType<typeof buildBitcoinDispositions>) {
  return dispositions.map((disposition) => BitcoinDispositionSchema.parse(disposition));
}

function mapBitcoinLotSelections(bitcoinLotSelections: WorkspaceState["bitcoinLotSelections"]) {
  return buildBitcoinLotSelections(bitcoinLotSelections).map((selection) => BitcoinLotSelectionSchema.parse(selection));
}

function mapLedgerTransactions(transactions: WorkspaceState["transactions"]) {
  return transactions.map((transaction) =>
    LedgerTransactionSchema.parse({
      accountLabel: transaction.accountLabel,
      assetSymbol: transaction.assetSymbol,
      ...(typeof transaction.cashValueInCents !== "number"
        ? {}
        : { cashValue: makeUsd(transaction.cashValueInCents) }),
      entryKind: transaction.entryKind,
      id: transaction.id,
      importSessionId: transaction.importSessionId,
      occurredAt: transaction.occurredAt.toISOString(),
      quantity: transaction.quantity,
      sourceDocumentId: transaction.sourceDocumentId ?? undefined,
      taxYear: transaction.taxYear
    })
  );
}

function mapTransferMatches(matches: Awaited<ReturnType<typeof syncTransferMatches>>) {
  return matches.map((match) =>
    TransferMatchSchema.parse({
      confidence: match.confidence,
      id: match.id,
      inboundTransactionId: match.inboundTransactionId,
      notes: match.notes,
      outboundTransactionId: match.outboundTransactionId,
      status: match.status,
      taxYear: match.taxYear
    })
  );
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

function createDefaultBitcoinTaxConfiguration(taxYear: number) {
  return {
    assetSymbol: "BTC",
    explanation: "No BTC wallet-basis transition method has been recorded yet.",
    recordedAt: new Date(),
    taxYear,
    transitionMethod: "undocumented"
  };
}

type WorkspaceState = Awaited<ReturnType<typeof loadWorkspaceState>>;
