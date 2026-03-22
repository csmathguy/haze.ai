import type { BitcoinDisposition, BitcoinLot, BitcoinLotSelection, Money, WorkspaceSnapshot } from "@taxes/shared";

export interface BitcoinFilingSummaryRow {
  readonly accountLabel: string;
  readonly acquiredAt: string;
  readonly costBasis: Money;
  readonly disposedAt: string;
  readonly dispositionTransactionId: string;
  readonly gainOrLoss: Money;
  readonly lotId: string;
  readonly proceeds: Money;
  readonly quantity: string;
  readonly term: "long-term" | "short-term";
}

export interface BitcoinFilingBlockedRow {
  readonly accountLabel: string;
  readonly disposedAt: string;
  readonly quantity: string;
  readonly reason: string;
  readonly sourceTransactionId: string;
}

export interface BitcoinFilingSummary {
  readonly blockedRows: BitcoinFilingBlockedRow[];
  readonly csvContent: string;
  readonly csvFileName: string;
  readonly generatedAt: string;
  readonly readyRows: BitcoinFilingSummaryRow[];
  readonly taxYear: number;
  readonly warnings: string[];
}

export function buildBitcoinFilingSummary(snapshot: Pick<
  WorkspaceSnapshot,
  "bitcoinBasis" | "bitcoinDispositions" | "bitcoinLotSelections" | "bitcoinLots" | "generatedAt" | "household"
>): BitcoinFilingSummary {
  const lotsById = new Map(snapshot.bitcoinLots.map((lot) => [lot.id, lot]));
  const dispositionsByTransactionId = new Map(snapshot.bitcoinDispositions.map((disposition) => [disposition.sourceTransactionId, disposition]));
  const readyRows = snapshot.bitcoinLotSelections.flatMap((selection) =>
    buildReadyRow(selection, lotsById.get(selection.lotId), dispositionsByTransactionId.get(selection.dispositionTransactionId))
  );
  const blockedRows = snapshot.bitcoinDispositions.flatMap(buildBlockedRows);
  const warnings = buildWarnings(snapshot, blockedRows.length);

  return {
    blockedRows,
    csvContent: buildCsvContent(readyRows),
    csvFileName: `btc-filing-summary-${snapshot.household.taxYear.toString()}.csv`,
    generatedAt: snapshot.generatedAt,
    readyRows,
    taxYear: snapshot.household.taxYear,
    warnings
  };
}

function buildReadyRow(
  selection: BitcoinLotSelection,
  lot: BitcoinLot | undefined,
  disposition: BitcoinDisposition | undefined
): BitcoinFilingSummaryRow[] {
  if (lot === undefined || disposition?.proceeds === undefined) {
    return [];
  }

  const allocatedCostBasis = allocateMoney(lot.costBasis, lot.quantity, selection.quantity);
  const allocatedProceeds = allocateMoney(disposition.proceeds, disposition.quantity, selection.quantity);

  return [
    {
      accountLabel: disposition.accountLabel,
      acquiredAt: lot.acquiredAt,
      costBasis: allocatedCostBasis,
      disposedAt: disposition.occurredAt,
      dispositionTransactionId: disposition.sourceTransactionId,
      gainOrLoss: {
        amountInCents: allocatedProceeds.amountInCents - allocatedCostBasis.amountInCents,
        currencyCode: "USD"
      },
      lotId: lot.id,
      proceeds: allocatedProceeds,
      quantity: normalizeQuantity(selection.quantity),
      term: deriveHoldingTerm(lot.acquiredAt, disposition.occurredAt)
    }
  ];
}

function buildBlockedRows(disposition: BitcoinDisposition): BitcoinFilingBlockedRow[] {
  if (Number(disposition.unassignedQuantity) <= 0) {
    return [];
  }

  return [
    {
      accountLabel: disposition.accountLabel,
      disposedAt: disposition.occurredAt,
      quantity: normalizeQuantity(disposition.unassignedQuantity),
      reason: "BTC disposition still has unassigned quantity.",
      sourceTransactionId: disposition.sourceTransactionId
    }
  ];
}

function buildWarnings(
  snapshot: Pick<WorkspaceSnapshot, "bitcoinBasis">,
  blockedRowCount: number
): string[] {
  const warnings: string[] = [];

  if (snapshot.bitcoinBasis.transitionStatus !== "ready" && snapshot.bitcoinBasis.transitionStatus !== "not-needed") {
    warnings.push(
      `BTC basis transition status is ${snapshot.bitcoinBasis.transitionStatus}. ${snapshot.bitcoinBasis.explanation}`
    );
  }

  if (blockedRowCount > 0) {
    warnings.push(`${blockedRowCount.toString()} BTC filing row(s) remain blocked and are excluded from the export.`);
  }

  return warnings;
}

function buildCsvContent(rows: readonly BitcoinFilingSummaryRow[]): string {
  const header = "Acquired,Disposed,Quantity BTC,Proceeds USD,Cost Basis USD,Gain/Loss USD,Term,Account,Disposition ID,Lot ID";
  const lines = rows.map((row) =>
    [
      formatDateOnly(row.acquiredAt),
      formatDateOnly(row.disposedAt),
      row.quantity,
      formatUsd(row.proceeds),
      formatUsd(row.costBasis),
      formatUsd(row.gainOrLoss),
      row.term,
      escapeCsv(row.accountLabel),
      escapeCsv(row.dispositionTransactionId),
      escapeCsv(row.lotId)
    ].join(",")
  );

  return [header, ...lines].join("\n");
}

function deriveHoldingTerm(acquiredAt: string, disposedAt: string): "long-term" | "short-term" {
  const heldMs = Date.parse(disposedAt) - Date.parse(acquiredAt);
  return heldMs > 365 * 24 * 60 * 60 * 1000 ? "long-term" : "short-term";
}

function allocateMoney(total: Money, totalQuantity: string, selectedQuantity: string): Money {
  return {
    amountInCents: Math.round((total.amountInCents / Number(totalQuantity)) * Number(selectedQuantity)),
    currencyCode: total.currencyCode
  };
}

function normalizeQuantity(quantity: string): string {
  return Number(quantity).toString();
}

function formatUsd(value: Money): string {
  return (value.amountInCents / 100).toFixed(2);
}

function formatDateOnly(value: string): string {
  return value.slice(0, 10);
}

function escapeCsv(value: string): string {
  return value.includes(",") ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}
