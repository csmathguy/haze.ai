import { randomUUID } from "node:crypto";

import {
  BitcoinDispositionSchema,
  BitcoinLotSchema,
  BitcoinLotSelectionSchema,
  makeUsd,
  SaveBitcoinLotSelectionInputSchema,
  type BitcoinDisposition,
  type BitcoinLot,
  type BitcoinLotSelection,
  type LedgerTransaction,
  type ReviewTask,
  type SaveBitcoinLotSelectionInput
} from "@taxes/shared";
import type { PrismaClient } from "@taxes/db";

const RECOMMENDED_LOT_COUNT = 3;

export function buildBitcoinLots(input: {
  selections: readonly BitcoinLotSelection[];
  transactions: readonly LedgerTransaction[];
}): BitcoinLot[] {
  const selectionsByLotId = new Map<string, number>();

  for (const selection of input.selections) {
    selectionsByLotId.set(selection.lotId, (selectionsByLotId.get(selection.lotId) ?? 0) + parseQuantity(selection.quantity));
  }

  return input.transactions
    .filter((transaction) => isBitcoinAcquisition(transaction) && transaction.cashValue !== undefined)
    .map((transaction) => {
      const lotId = `btc-lot-${transaction.id}`;
      const quantity = parseQuantity(transaction.quantity);
      const usedQuantity = selectionsByLotId.get(lotId) ?? 0;
      const remainingQuantity = Math.max(quantity - usedQuantity, 0);

      return BitcoinLotSchema.parse({
        accountLabel: transaction.accountLabel,
        acquiredAt: transaction.occurredAt,
        costBasis: transaction.cashValue,
        id: lotId,
        quantity: formatQuantity(quantity),
        remainingQuantity: formatQuantity(remainingQuantity),
        sourceTransactionId: transaction.id
      });
    });
}

export function buildBitcoinLotSelections(
  selections: readonly {
    createdAt: Date;
    dispositionTransactionId: string;
    id: string;
    lotTransactionId: string;
    quantity: string;
    selectionMethod: string;
  }[]
): BitcoinLotSelection[] {
  return selections.map((selection) =>
    BitcoinLotSelectionSchema.parse({
      createdAt: selection.createdAt.toISOString(),
      dispositionTransactionId: selection.dispositionTransactionId,
      id: selection.id,
      lotId: `btc-lot-${selection.lotTransactionId}`,
      quantity: selection.quantity,
      selectionMethod: selection.selectionMethod
    })
  );
}

export function buildBitcoinDispositions(input: {
  lots: readonly BitcoinLot[];
  selections: readonly BitcoinLotSelection[];
  transactions: readonly LedgerTransaction[];
}): BitcoinDisposition[] {
  const selectedQuantityByDispositionId = new Map<string, number>();
  const selectedCostBasisByDispositionId = new Map<string, number>();
  const lotsById = new Map(input.lots.map((lot) => [lot.id, lot]));

  for (const selection of input.selections) {
    const lot = lotsById.get(selection.lotId);

    selectedQuantityByDispositionId.set(
      selection.dispositionTransactionId,
      (selectedQuantityByDispositionId.get(selection.dispositionTransactionId) ?? 0) + parseQuantity(selection.quantity)
    );

    if (lot !== undefined) {
      selectedCostBasisByDispositionId.set(
        selection.dispositionTransactionId,
        (selectedCostBasisByDispositionId.get(selection.dispositionTransactionId) ?? 0) +
          calculateAllocatedCostBasisInCents(lot, selection.quantity)
      );
    }
  }

  return input.transactions
    .filter(isBitcoinDisposition)
    .map((transaction) => {
      const quantity = parseQuantity(transaction.quantity);
      const selectedQuantity = selectedQuantityByDispositionId.get(transaction.id) ?? 0;
      const selectedCostBasisInCents = selectedCostBasisByDispositionId.get(transaction.id);
      const unassignedQuantity = Math.max(quantity - selectedQuantity, 0);
      const recommendedLotIds = input.lots
        .filter(
          (lot) =>
            parseQuantity(lot.remainingQuantity) > 0 &&
            Date.parse(lot.acquiredAt) <= Date.parse(transaction.occurredAt)
        )
        .sort((left, right) => compareLotsByBestTaxOutcome(left, right))
        .slice(0, RECOMMENDED_LOT_COUNT)
        .map((lot) => lot.id);

      return BitcoinDispositionSchema.parse({
        accountLabel: transaction.accountLabel,
        id: `btc-disposition-${transaction.id}`,
        occurredAt: transaction.occurredAt,
        ...(selectedCostBasisInCents === undefined ? {} : { assignedCostBasis: makeUsd(selectedCostBasisInCents) }),
        ...(transaction.cashValue === undefined ? {} : { proceeds: transaction.cashValue }),
        quantity: transaction.quantity,
        recommendedLotIds,
        ...(selectedCostBasisInCents === undefined || transaction.cashValue === undefined
          ? {}
          : { realizedGainOrLoss: makeUsd(transaction.cashValue.amountInCents - selectedCostBasisInCents) }),
        selectedQuantity: formatQuantity(selectedQuantity),
        sourceTransactionId: transaction.id,
        status: deriveDispositionStatus(recommendedLotIds.length, selectedQuantity, unassignedQuantity),
        unassignedQuantity: formatQuantity(unassignedQuantity)
      });
    });
}

export function summarizeBitcoinTaxScenario(input: {
  dispositions: readonly BitcoinDisposition[];
  lots?: readonly BitcoinLot[];
  method: "fifo" | "highest-basis" | "specific-identification";
}): {
  estimatedFederalTaxInCents: number;
  realizedLongTermGainInCents: number;
  realizedShortTermGainInCents: number;
} {
  const dispositions =
    input.method === "specific-identification" || input.lots === undefined
      ? input.dispositions
      : simulateScenarioDispositions(input.dispositions, input.lots, input.method);
  const totalGainOrLossInCents = dispositions.reduce(
    (total, disposition) => total + (disposition.realizedGainOrLoss?.amountInCents ?? 0),
    0
  );
  const estimatedFederalTaxInCents = totalGainOrLossInCents > 0 ? Math.round(totalGainOrLossInCents * 0.24) : 0;

  return {
    estimatedFederalTaxInCents,
    realizedLongTermGainInCents: input.method === "fifo" ? totalGainOrLossInCents : 0,
    realizedShortTermGainInCents: input.method === "fifo" ? 0 : totalGainOrLossInCents
  };
}

export function createBitcoinLotSelectionReviewTasks(dispositions: readonly BitcoinDisposition[]): ReviewTask[] {
  return dispositions
    .filter((disposition) => disposition.status === "ready-to-pick" || disposition.status === "partially-assigned")
    .map((disposition) => ({
      actionLabel: "Pick BTC lots",
      id: `review-${disposition.id}`,
      reason: `Assign BTC lots to cover the remaining ${disposition.unassignedQuantity} before gains are trusted.`,
      severity: "required",
      title: `BTC lot selection: ${disposition.sourceTransactionId}`
    }));
}

export async function saveBitcoinLotSelection(
  input: SaveBitcoinLotSelectionInput,
  prisma: PrismaClient,
  workspace: {
    lots: readonly BitcoinLot[];
    dispositions: readonly BitcoinDisposition[];
  }
): Promise<void> {
  const payload = SaveBitcoinLotSelectionInputSchema.parse(input);
  const selectedLot = workspace.lots.find((lot) => lot.id === payload.lotId);
  const selectedDisposition = workspace.dispositions.find(
    (disposition) => disposition.sourceTransactionId === payload.dispositionTransactionId
  );

  if (selectedLot === undefined) {
    throw new Error(`BTC lot ${payload.lotId} was not found.`);
  }

  if (selectedDisposition === undefined) {
    throw new Error(`BTC disposition ${payload.dispositionTransactionId} was not found.`);
  }

  const requestedQuantity = parseQuantity(payload.quantity);

  if (requestedQuantity <= 0) {
    throw new Error("BTC lot selection quantity must be greater than zero.");
  }

  if (requestedQuantity > parseQuantity(selectedLot.remainingQuantity)) {
    throw new Error("BTC lot selection exceeds the remaining quantity in that lot.");
  }

  if (requestedQuantity > parseQuantity(selectedDisposition.unassignedQuantity)) {
    throw new Error("BTC lot selection exceeds the remaining quantity for that disposition.");
  }

  await prisma.bitcoinLotSelection.create({
    data: {
      dispositionTransactionId: payload.dispositionTransactionId,
      id: randomUUID(),
      lotTransactionId: selectedLot.sourceTransactionId,
      quantity: formatQuantity(requestedQuantity),
      selectionMethod: payload.selectionMethod,
      taxYear: payload.taxYear
    }
  });
}

function compareLotsByBestTaxOutcome(left: BitcoinLot, right: BitcoinLot): number {
  const leftPerUnit = left.costBasis.amountInCents / parseQuantity(left.quantity);
  const rightPerUnit = right.costBasis.amountInCents / parseQuantity(right.quantity);

  if (leftPerUnit !== rightPerUnit) {
    return rightPerUnit - leftPerUnit;
  }

  return Date.parse(left.acquiredAt) - Date.parse(right.acquiredAt);
}

function deriveDispositionStatus(
  recommendedLotCount: number,
  selectedQuantity: number,
  unassignedQuantity: number
): BitcoinDisposition["status"] {
  if (unassignedQuantity <= 0) {
    return "fully-assigned";
  }

  if (recommendedLotCount === 0) {
    return "blocked";
  }

  return selectedQuantity > 0 ? "partially-assigned" : "ready-to-pick";
}

function isBitcoinAcquisition(transaction: LedgerTransaction): boolean {
  return (
    transaction.assetSymbol === "BTC" &&
    (transaction.entryKind === "buy" || transaction.entryKind === "income" || transaction.entryKind === "receive")
  );
}

function isBitcoinDisposition(transaction: LedgerTransaction): boolean {
  return (
    transaction.assetSymbol === "BTC" &&
    (transaction.entryKind === "sell" || transaction.entryKind === "swap" || transaction.entryKind === "send")
  );
}

function parseQuantity(input: string): number {
  const parsed = Number(input);

  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid BTC quantity: ${input}`);
  }

  return parsed;
}

function formatQuantity(value: number): string {
  let normalized = value.toFixed(8);

  while (normalized.endsWith("0")) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.endsWith(".") ? normalized.slice(0, -1) : normalized;
}

function calculateAllocatedCostBasisInCents(lot: BitcoinLot, quantity: string): number {
  return Math.round((lot.costBasis.amountInCents / parseQuantity(lot.quantity)) * parseQuantity(quantity));
}

function simulateScenarioDispositions(
  dispositions: readonly BitcoinDisposition[],
  lots: readonly BitcoinLot[],
  method: "fifo" | "highest-basis"
): BitcoinDisposition[] {
  const simulatedLots = lots.map((lot) => ({
    ...lot,
    remainingQuantityValue: parseQuantity(lot.quantity)
  }));

  return dispositions.map((disposition) => {
    const requiredQuantity = parseQuantity(disposition.quantity);
    let remainingToAssign = requiredQuantity;
    let assignedCostBasisInCents = 0;
    const candidateLots = simulatedLots
      .filter((lot) => lot.remainingQuantityValue > 0 && Date.parse(lot.acquiredAt) <= Date.parse(disposition.occurredAt))
      .sort((left, right) => compareScenarioLots(left, right, method));

    for (const lot of candidateLots) {
      if (remainingToAssign <= 0) {
        break;
      }

      const selectedQuantity = Math.min(remainingToAssign, lot.remainingQuantityValue);
      assignedCostBasisInCents += calculateAllocatedCostBasisInCents(lot, formatQuantity(selectedQuantity));
      lot.remainingQuantityValue -= selectedQuantity;
      remainingToAssign -= selectedQuantity;
    }

    return BitcoinDispositionSchema.parse({
      ...disposition,
      ...(remainingToAssign > 0 ? {} : { assignedCostBasis: makeUsd(assignedCostBasisInCents) }),
      ...(remainingToAssign > 0 || disposition.proceeds === undefined
        ? {}
        : { realizedGainOrLoss: makeUsd(disposition.proceeds.amountInCents - assignedCostBasisInCents) }),
      recommendedLotIds: candidateLots.slice(0, RECOMMENDED_LOT_COUNT).map((lot) => lot.id),
      selectedQuantity: formatQuantity(requiredQuantity - remainingToAssign),
      status: deriveDispositionStatus(candidateLots.length, requiredQuantity - remainingToAssign, remainingToAssign),
      unassignedQuantity: formatQuantity(remainingToAssign)
    });
  });
}

function compareScenarioLots(
  left: BitcoinLot & { remainingQuantityValue: number },
  right: BitcoinLot & { remainingQuantityValue: number },
  method: "fifo" | "highest-basis"
): number {
  if (method === "fifo") {
    return Date.parse(left.acquiredAt) - Date.parse(right.acquiredAt);
  }

  return compareLotsByBestTaxOutcome(left, right);
}
