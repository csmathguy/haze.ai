import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import type { WorkspaceSnapshot } from "@taxes/shared";

import { buildApp } from "./app.js";
import { getPrismaClient } from "./db/client.js";
import type { TestWorkspaceContext } from "./test/database.js";
import { createTestWorkspaceContext } from "./test/database.js";

interface WorkspaceResponse {
  snapshot: WorkspaceSnapshot;
}

interface BitcoinFilingSummaryResponse {
  summary: {
    blockedRows: { sourceTransactionId: string }[];
    csvContent: string;
    readyRows: { dispositionTransactionId: string; lotId: string }[];
    warnings: string[];
  };
}

describe("buildApp", () => {
  const workspaces: TestWorkspaceContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("exposes a local-only health endpoint", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-health");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      localOnly: true,
      status: "ok"
    });

    await app.close();
  });

  it("returns the workspace snapshot envelope", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-workspace");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const response = await app.inject({
      method: "GET",
      url: "/api/workspace"
    });
    const payload: WorkspaceResponse = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.snapshot.assetLots).toEqual([]);
    expect(payload.snapshot.dataGaps).toEqual([]);
    expect(payload.snapshot.documents).toEqual([]);
    expect(payload.snapshot.extractions).toEqual([]);
    expect(payload.snapshot.localOnly).toBe(true);
    expect(payload.snapshot.questionnaire.length).toBeGreaterThan(0);
    expect(payload.snapshot.scenarios[0]?.id).toBe("scenario-fifo");

    await app.close();
  });

  it("creates a taxes workspace when started from the app workspace directory", async () => {
    const originalWorkingDirectory = process.cwd();
    const appWorkingDirectory = path.resolve(originalWorkingDirectory, "apps", "taxes", "api");

    process.chdir(appWorkingDirectory);

    try {
      const workspace = await createTestWorkspaceContext("taxes-build-app-cwd");
      workspaces.push(workspace);
      const app = await buildApp(workspace);
      const response = await app.inject({
        method: "GET",
        url: "/api/health"
      });

      expect(response.statusCode).toBe(200);
      await app.close();
    } finally {
      process.chdir(originalWorkingDirectory);
    }
  });

  it("persists questionnaire responses through the API", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-questionnaire");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        promptKey: "optimization-capital-loss-carryover",
        taxYear: 2025,
        value: "yes"
      },
      url: "/api/questionnaire-responses"
    });
    const workspaceResponse = await app.inject({
      method: "GET",
      url: "/api/workspace"
    });
    const payload: WorkspaceResponse = workspaceResponse.json();

    expect(saveResponse.statusCode).toBe(204);
    expect(payload.snapshot.questionnaire.find((prompt) => prompt.key === "optimization-capital-loss-carryover")).toEqual(
      expect.objectContaining({
        currentValue: "yes"
      })
    );

    await app.close();
  });

  it("persists BTC basis profile decisions through the API", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-bitcoin-basis");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        explanation: "All BTC remains in one wallet, so wallet-based tracking follows that carryforward.",
        method: "carryforward-single-wallet",
        taxYear: 2025
      },
      url: "/api/bitcoin-basis-profile"
    });
    const workspaceResponse = await app.inject({
      method: "GET",
      url: "/api/workspace"
    });
    const payload: WorkspaceResponse = workspaceResponse.json();

    expect(saveResponse.statusCode).toBe(204);
    expect(payload.snapshot.bitcoinBasis).toEqual(
      expect.objectContaining({
        explanation: "All BTC remains in one wallet, so wallet-based tracking follows that carryforward.",
        method: "carryforward-single-wallet"
      })
    );

    await app.close();
  });

  it("persists BTC lot picks through the API and reduces remaining lot quantity", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-bitcoin-lot-selection");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);
    await prisma.transactionImportSession.create({
      data: {
        id: "session-btc-api-lot-selection",
        sourceFileName: "btc-history.csv",
        sourceKind: "csv-upload",
        sourceLabel: "crypto-wallet-export",
        status: "completed",
        taxYear: 2025,
        transactionCount: 2
      }
    });
    await prisma.ledgerTransaction.createMany({
      data: [
        {
          accountLabel: "Cold storage",
          assetSymbol: "BTC",
          cashValueInCents: 180000,
          entryKind: "buy",
          id: "tx-btc-api-lot",
          importSessionId: "session-btc-api-lot-selection",
          occurredAt: new Date("2024-08-01T10:00:00.000Z"),
          quantity: "0.05000000",
          taxYear: 2025
        },
        {
          accountLabel: "Cold storage",
          assetSymbol: "BTC",
          cashValueInCents: 150000,
          entryKind: "sell",
          id: "tx-btc-api-disposal",
          importSessionId: "session-btc-api-lot-selection",
          occurredAt: new Date("2025-02-01T10:00:00.000Z"),
          quantity: "0.03000000",
          taxYear: 2025
        }
      ]
    });

    const app = await buildApp(workspace);
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        dispositionTransactionId: "tx-btc-api-disposal",
        lotId: "btc-lot-tx-btc-api-lot",
        quantity: "0.02000000",
        selectionMethod: "specific-identification",
        taxYear: 2025
      },
      url: "/api/bitcoin-lot-selections"
    });
    const workspaceResponse = await app.inject({
      method: "GET",
      url: "/api/workspace"
    });
    const payload: WorkspaceResponse = workspaceResponse.json();

    expect(saveResponse.statusCode).toBe(204);
    expect(payload.snapshot.bitcoinLotSelections).toEqual([
      expect.objectContaining({
        dispositionTransactionId: "tx-btc-api-disposal",
        lotId: "btc-lot-tx-btc-api-lot",
        quantity: "0.02"
      })
    ]);
    expect(payload.snapshot.bitcoinLots).toEqual([
      expect.objectContaining({
        remainingQuantity: "0.03",
        sourceTransactionId: "tx-btc-api-lot"
      })
    ]);
    expect(payload.snapshot.bitcoinDispositions).toEqual([
      expect.objectContaining({
        assignedCostBasis: {
          amountInCents: 72000,
          currencyCode: "USD"
        },
        realizedGainOrLoss: {
          amountInCents: 78000,
          currencyCode: "USD"
        },
        selectedQuantity: "0.02",
        sourceTransactionId: "tx-btc-api-disposal",
        unassignedQuantity: "0.01"
      })
    ]);
    expect(payload.snapshot.scenarios.find((scenario) => scenario.id === "scenario-specific-id")).toEqual(
      expect.objectContaining({
        estimatedFederalTax: {
          amountInCents: 18720,
          currencyCode: "USD"
        }
      })
    );
    expect(payload.snapshot.scenarios.find((scenario) => scenario.id === "scenario-fifo")).toEqual(
      expect.objectContaining({
        estimatedFederalTax: {
          amountInCents: 10080,
          currencyCode: "USD"
        }
      })
    );

    await app.close();
  });

  it("returns a BTC filing summary with ready rows and blocked rows", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-bitcoin-filing-summary");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);
    await prisma.transactionImportSession.create({
      data: {
        id: "session-btc-filing-summary",
        sourceFileName: "btc-history.csv",
        sourceKind: "csv-upload",
        sourceLabel: "crypto-wallet-export",
        status: "completed",
        taxYear: 2025,
        transactionCount: 2
      }
    });
    await prisma.ledgerTransaction.createMany({
      data: [
        {
          accountLabel: "Cold storage",
          assetSymbol: "BTC",
          cashValueInCents: 180000,
          entryKind: "buy",
          id: "tx-btc-summary-lot",
          importSessionId: "session-btc-filing-summary",
          occurredAt: new Date("2024-08-01T10:00:00.000Z"),
          quantity: "0.05000000",
          taxYear: 2025
        },
        {
          accountLabel: "Cold storage",
          assetSymbol: "BTC",
          cashValueInCents: 150000,
          entryKind: "sell",
          id: "tx-btc-summary-sale",
          importSessionId: "session-btc-filing-summary",
          occurredAt: new Date("2025-02-01T10:00:00.000Z"),
          quantity: "0.03000000",
          taxYear: 2025
        }
      ]
    });
    await prisma.bitcoinLotSelection.create({
      data: {
        dispositionTransactionId: "tx-btc-summary-sale",
        id: "btc-selection-summary-a",
        lotTransactionId: "tx-btc-summary-lot",
        quantity: "0.02000000",
        selectionMethod: "specific-identification",
        taxYear: 2025
      }
    });

    const app = await buildApp(workspace);
    const response = await app.inject({
      method: "GET",
      url: "/api/bitcoin-filing-summary"
    });
    const payload: BitcoinFilingSummaryResponse = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.summary.readyRows).toEqual([
      expect.objectContaining({
        dispositionTransactionId: "tx-btc-summary-sale",
        lotId: "btc-lot-tx-btc-summary-lot"
      })
    ]);
    expect(payload.summary.blockedRows).toEqual([
      expect.objectContaining({
        sourceTransactionId: "tx-btc-summary-sale"
      })
    ]);
    expect(payload.summary.csvContent).toContain("Disposition ID,Lot ID");
    expect(payload.summary.warnings).toContain("1 BTC filing row(s) remain blocked and are excluded from the export.");

    await app.close();
  });
});
