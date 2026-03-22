import { describe, expect, it } from "vitest";
import type { WorkspaceSnapshot } from "@taxes/shared";

import { buildBitcoinFilingSummary } from "./bitcoin-filing-summary.js";

function createWorkspaceSnapshot(overrides: Partial<WorkspaceSnapshot>): WorkspaceSnapshot {
  return {
    assetLots: [],
    bitcoinBasis: {
      accounts: [],
      assetSymbol: "BTC",
      effectiveDate: "2025-01-01",
      explanation: "Wallet-based tracking is recorded.",
      hasPost2024Activity: true,
      hasPre2025Holdings: true,
      method: "wallet-based-tracking",
      recordedAt: "2026-03-22T18:00:00.000Z",
      taxYear: 2025,
      transitionStatus: "ready",
      updatedAt: "2026-03-22T18:00:00.000Z"
    },
    bitcoinDispositions: [],
    bitcoinLotSelections: [],
    bitcoinLots: [],
    dataGaps: [],
    documents: [],
    draft: {
      deductionItems: [],
      household: {
        filingStatus: "single",
        hasDigitalAssets: true,
        primaryTaxpayer: "Local owner",
        stateResidence: "NY",
        taxYear: 2025
      },
      incomeItems: [],
      notes: [],
      requiredForms: ["1040", "schedule-d", "form-8949"]
    },
    extractions: [],
    filingChecklist: {
      differsByJurisdiction: false,
      federal: { items: [], jurisdiction: "federal", readiness: "needs-review" },
      filingStatus: "single",
      state: { items: [], jurisdiction: "state", readiness: "needs-review" },
      stateResidence: "NY",
      taxYear: 2025
    },
    generatedAt: "2026-03-22T18:00:00.000Z",
    household: {
      filingStatus: "single",
      hasDigitalAssets: true,
      primaryTaxpayer: "Local owner",
      stateResidence: "NY",
      taxYear: 2025
    },
    importSessions: [],
    localOnly: true,
    questionnaire: [],
    reviewQueue: [],
    scenarios: [],
    transferMatches: [],
    transactions: [],
    ...overrides
  };
}

describe("buildBitcoinFilingSummary", () => {
  it("creates form-8949 style BTC rows from selected lots", () => {
    const summary = buildBitcoinFilingSummary(
      createWorkspaceSnapshot({
        bitcoinDispositions: [
          {
            accountLabel: "Cold storage",
            assignedCostBasis: { amountInCents: 72000, currencyCode: "USD" },
            id: "btc-disposition-sale-a",
            occurredAt: "2025-02-01T10:00:00.000Z",
            proceeds: { amountInCents: 150000, currencyCode: "USD" },
            quantity: "0.03",
            recommendedLotIds: ["btc-lot-a"],
            realizedGainOrLoss: { amountInCents: 78000, currencyCode: "USD" },
            selectedQuantity: "0.02",
            sourceTransactionId: "tx-sale-a",
            status: "partially-assigned",
            unassignedQuantity: "0.01"
          }
        ],
        bitcoinLotSelections: [
          {
            createdAt: "2026-03-22T18:00:00.000Z",
            dispositionTransactionId: "tx-sale-a",
            id: "selection-a",
            lotId: "btc-lot-a",
            quantity: "0.02",
            selectionMethod: "specific-identification"
          }
        ],
        bitcoinLots: [
          {
            accountLabel: "Cold storage",
            acquiredAt: "2024-08-01T10:00:00.000Z",
            costBasis: { amountInCents: 180000, currencyCode: "USD" },
            id: "btc-lot-a",
            quantity: "0.05",
            remainingQuantity: "0.03",
            sourceTransactionId: "tx-buy-a"
          }
        ]
      })
    );

    expect(summary.readyRows).toEqual([
      expect.objectContaining({
        acquiredAt: "2024-08-01T10:00:00.000Z",
        costBasis: { amountInCents: 72000, currencyCode: "USD" },
        disposedAt: "2025-02-01T10:00:00.000Z",
        gainOrLoss: { amountInCents: 28000, currencyCode: "USD" },
        proceeds: { amountInCents: 100000, currencyCode: "USD" },
        quantity: "0.02",
        term: "short-term"
      })
    ]);
    expect(summary.blockedRows).toEqual([
      expect.objectContaining({
        quantity: "0.01",
        reason: "BTC disposition still has unassigned quantity.",
        sourceTransactionId: "tx-sale-a"
      })
    ]);
    expect(summary.csvContent).toContain("Acquired,Disposed,Quantity BTC,Proceeds USD,Cost Basis USD,Gain/Loss USD,Term,Account,Disposition ID,Lot ID");
    expect(summary.csvContent).toContain("2024-08-01,2025-02-01,0.02,1000.00,720.00,280.00,short-term,Cold storage,tx-sale-a,btc-lot-a");
  });

  it("surfaces basis-transition and missing-lot warnings separately from ready rows", () => {
    const summary = buildBitcoinFilingSummary(
      createWorkspaceSnapshot({
        bitcoinBasis: {
          accounts: [],
          assetSymbol: "BTC",
          effectiveDate: "2025-01-01",
          explanation: "Transition method still needs review.",
          hasPost2024Activity: true,
          hasPre2025Holdings: true,
          method: "undocumented",
          recordedAt: "2026-03-22T18:00:00.000Z",
          taxYear: 2025,
          transitionStatus: "pending-history",
          updatedAt: "2026-03-22T18:00:00.000Z"
        },
        bitcoinDispositions: [
          {
            accountLabel: "Robinhood",
            id: "btc-disposition-sale-b",
            occurredAt: "2025-03-01T10:00:00.000Z",
            proceeds: { amountInCents: 50000, currencyCode: "USD" },
            quantity: "0.01",
            recommendedLotIds: [],
            selectedQuantity: "0",
            sourceTransactionId: "tx-sale-b",
            status: "blocked",
            unassignedQuantity: "0.01"
          }
        ]
      })
    );

    expect(summary.readyRows).toEqual([]);
    expect(summary.blockedRows).toEqual([
      expect.objectContaining({
        quantity: "0.01",
        reason: "BTC disposition still has unassigned quantity.",
        sourceTransactionId: "tx-sale-b"
      })
    ]);
    expect(summary.warnings).toContain("BTC basis transition status is pending-history. Transition method still needs review.");
    expect(summary.warnings).toContain("1 BTC filing row(s) remain blocked and are excluded from the export.");
  });
});
