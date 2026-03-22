import { afterEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "../db/client.js";
import type { TestWorkspaceContext } from "../test/database.js";
import { createTestWorkspaceContext } from "../test/database.js";
import { getWorkspaceSnapshot } from "./workspace.js";

describe("workspace BTC basis transition", () => {
  const workspaces: TestWorkspaceContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("requires a BTC wallet-basis transition record when 2025 activity depends on pre-2025 holdings", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-btc-transition-pending");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);

    await prisma.transactionImportSession.create({
      data: {
        id: "session-btc-transition-pending",
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
          accountLabel: "Coinbase",
          assetSymbol: "BTC",
          cashValueInCents: 120000,
          entryKind: "buy",
          id: "tx-btc-pre-2025-buy",
          importSessionId: "session-btc-transition-pending",
          occurredAt: new Date("2024-10-01T10:00:00.000Z"),
          quantity: "0.050",
          taxYear: 2025
        },
        {
          accountLabel: "Coinbase",
          assetSymbol: "BTC",
          cashValueInCents: 80000,
          entryKind: "sell",
          id: "tx-btc-2025-sell",
          importSessionId: "session-btc-transition-pending",
          occurredAt: new Date("2025-02-10T10:00:00.000Z"),
          quantity: "0.020",
          taxYear: 2025
        }
      ]
    });

    const snapshot = await getWorkspaceSnapshot(workspace);
    const transitionTask = snapshot.reviewQueue.find((task) => task.id === "review-btc-basis-2025");

    expect(snapshot.bitcoinBasis).toEqual(
      expect.objectContaining({
        accounts: ["Coinbase"],
        hasPost2024Activity: true,
        hasPre2025Holdings: true,
        method: "undocumented",
        transitionStatus: "pending-history"
      })
    );
    expect(transitionTask).toEqual(
      expect.objectContaining({
        actionLabel: "Record BTC basis method",
        severity: "required"
      })
    );
  });

  it("blocks BTC wallet-basis carryforward assumptions when pre-2025 holdings span multiple accounts", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-btc-transition-blocked");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);

    await prisma.bitcoinTaxConfiguration.create({
      data: {
        assetSymbol: "BTC",
        explanation: "Treat all pre-2025 BTC as carried forward into a single wallet.",
        taxYear: 2025,
        transitionMethod: "carryforward-single-wallet"
      }
    });
    await prisma.transactionImportSession.create({
      data: {
        id: "session-btc-transition-blocked",
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
          accountLabel: "Coinbase",
          assetSymbol: "BTC",
          cashValueInCents: 120000,
          entryKind: "buy",
          id: "tx-btc-pre-2025-coinbase",
          importSessionId: "session-btc-transition-blocked",
          occurredAt: new Date("2024-09-01T10:00:00.000Z"),
          quantity: "0.050",
          taxYear: 2025
        },
        {
          accountLabel: "Ledger",
          assetSymbol: "BTC",
          cashValueInCents: 95000,
          entryKind: "receive",
          id: "tx-btc-pre-2025-ledger",
          importSessionId: "session-btc-transition-blocked",
          occurredAt: new Date("2024-11-01T10:00:00.000Z"),
          quantity: "0.030",
          taxYear: 2025
        },
        {
          accountLabel: "Ledger",
          assetSymbol: "BTC",
          cashValueInCents: 70000,
          entryKind: "sell",
          id: "tx-btc-2025-ledger-sell",
          importSessionId: "session-btc-transition-blocked",
          occurredAt: new Date("2025-02-10T10:00:00.000Z"),
          quantity: "0.020",
          taxYear: 2025
        }
      ]
    });

    const snapshot = await getWorkspaceSnapshot(workspace);
    const transitionTask = snapshot.reviewQueue.find((task) => task.id === "review-btc-basis-blocked-2025");

    expect(snapshot.bitcoinBasis).toEqual(
      expect.objectContaining({
        accounts: ["Coinbase", "Ledger"],
        method: "carryforward-single-wallet",
        transitionStatus: "blocked"
      })
    );
    expect(transitionTask).toEqual(
      expect.objectContaining({
        actionLabel: "Escalate BTC basis review",
        severity: "required"
      })
    );
  });
});
