import {
  AssetLotSchema,
  createEmptyTaxReturnDraft,
  createReviewTasksFromDocuments,
  deriveRequiredForms,
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
  const household = HouseholdProfileSchema.parse({
    filingStatus: storedHousehold.filingStatus,
    hasDigitalAssets:
      storedHousehold.hasDigitalAssets ||
      documents.some((document) => document.kind === "1099-da" || document.kind === "crypto-wallet-export"),
    primaryTaxpayer: storedHousehold.primaryTaxpayer,
    stateResidence: storedHousehold.stateResidence,
    taxYear: storedHousehold.taxYear
  });
  const draft = createEmptyTaxReturnDraft(household.taxYear);

  draft.household = household;
  draft.requiredForms = deriveRequiredForms(documents);
  draft.notes = buildDraftNotes(documents);

  return {
    assetLots: assetLots.map((lot) =>
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
    ),
    documents,
    draft,
    generatedAt: new Date().toISOString(),
    household,
    localOnly: true,
    reviewQueue: createReviewTasksFromDocuments(documents),
    scenarios: buildScenarioTemplates()
  };
}

function buildDraftNotes(documents: WorkspaceSnapshot["documents"]): string[] {
  if (documents.length === 0) {
    return ["Upload tax documents to build the draft 1040 package and capital-gains review queue."];
  }

  return [
    `${documents.length.toString()} document(s) uploaded for review.`,
    "Line-item extraction, lot matching, and tax law modeling will be layered onto this scaffold next."
  ];
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
