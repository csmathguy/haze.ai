import { afterEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "../db/client.js";
import type { TestWorkspaceContext } from "../test/database.js";
import { createTestWorkspaceContext } from "../test/database.js";
import { getWorkspaceSnapshot } from "./workspace.js";

describe("workspace BTC lot selection", () => {
  const workspaces: TestWorkspaceContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("derives BTC lots and unresolved dispositions from imported ledger history", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-btc-lot-selection");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);

    await prisma.transactionImportSession.create({
      data: {
        id: "session-btc-lot-selection",
        sourceFileName: "btc-history.csv",
        sourceKind: "csv-upload",
        sourceLabel: "crypto-wallet-export",
        status: "completed",
        taxYear: 2025,
        transactionCount: 3
      }
    });
    await prisma.ledgerTransaction.createMany({
      data: [
        {
          accountLabel: "Cold storage",
          assetSymbol: "BTC",
          cashValueInCents: 180000,
          entryKind: "buy",
          id: "tx-btc-lot-a",
          importSessionId: "session-btc-lot-selection",
          occurredAt: new Date("2024-08-01T10:00:00.000Z"),
          quantity: "0.05000000",
          taxYear: 2025
        },
        {
          accountLabel: "Robinhood",
          assetSymbol: "BTC",
          cashValueInCents: 260000,
          entryKind: "buy",
          id: "tx-btc-lot-b",
          importSessionId: "session-btc-lot-selection",
          occurredAt: new Date("2024-12-01T10:00:00.000Z"),
          quantity: "0.04000000",
          taxYear: 2025
        },
        {
          accountLabel: "Cold storage",
          assetSymbol: "BTC",
          cashValueInCents: 150000,
          entryKind: "sell",
          id: "tx-btc-disposal-a",
          importSessionId: "session-btc-lot-selection",
          occurredAt: new Date("2025-02-01T10:00:00.000Z"),
          quantity: "0.03000000",
          taxYear: 2025
        }
      ]
    });

    const snapshot = await getWorkspaceSnapshot(workspace);

    expect(snapshot.bitcoinLots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountLabel: "Cold storage",
          remainingQuantity: "0.05",
          sourceTransactionId: "tx-btc-lot-a"
        }),
        expect.objectContaining({
          accountLabel: "Robinhood",
          remainingQuantity: "0.04",
          sourceTransactionId: "tx-btc-lot-b"
        })
      ])
    );
    expect(snapshot.bitcoinDispositions).toEqual([
      expect.objectContaining({
        recommendedLotIds: ["btc-lot-tx-btc-lot-b", "btc-lot-tx-btc-lot-a"],
        sourceTransactionId: "tx-btc-disposal-a",
        status: "ready-to-pick",
        unassignedQuantity: "0.03"
      })
    ]);
    expect(snapshot.reviewQueue.find((task) => task.actionLabel === "Pick BTC lots")).toEqual(
      expect.objectContaining({
        severity: "required"
      })
    );
  });
});
