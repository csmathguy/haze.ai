import { Readable } from "node:stream";

import type { MultipartFile } from "@fastify/multipart";
import { afterEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "../db/client.js";
import type { TestWorkspaceContext } from "../test/database.js";
import { createTestWorkspaceContext } from "../test/database.js";
import { saveUploadedDocument } from "./document-store.js";
import { saveQuestionnaireResponse } from "./questionnaire.js";
import { getWorkspaceSnapshot } from "./workspace.js";

describe("getWorkspaceSnapshot", () => {
  const workspaces: TestWorkspaceContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("starts with a local-only empty workspace when no documents exist", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-empty");
    workspaces.push(workspace);
    const snapshot = await getWorkspaceSnapshot(workspace);

    expect(snapshot.localOnly).toBe(true);
    expect(snapshot.dataGaps).toEqual([]);
    expect(snapshot.documents).toEqual([]);
    expect(snapshot.extractions).toEqual([]);
    expect(snapshot.bitcoinBasis.transitionStatus).toBe("not-needed");
    expect(snapshot.importSessions).toEqual([]);
    expect(snapshot.questionnaire.length).toBeGreaterThan(0);
    expect(snapshot.reviewQueue).toEqual([]);
    expect(snapshot.transferMatches).toEqual([]);
    expect(snapshot.transactions).toEqual([]);
    expect(snapshot.draft.requiredForms).toEqual(["1040"]);
    expect(snapshot.filingChecklist.taxYear).toBe(snapshot.household.taxYear);
    expect(snapshot.filingChecklist.federal.readiness).toBe("needs-documents");
    expect(snapshot.filingChecklist.state.readiness).toBe("needs-documents");
    expect(snapshot.filingChecklist.federal.items.find((item) => item.id === "income-records")?.status).toBe("missing");
    expect(snapshot.filingChecklist.federal.items.find((item) => item.id === "prior-year-reference")?.status).toBe("missing");
  });

  it("elevates digital-asset forms and review tasks when crypto exports are present", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-digital-asset");
    workspaces.push(workspace);

    await saveUploadedDocument(createMultipartFile("coinbase-wallet-export.csv"), 2025, workspace);
    await saveQuestionnaireResponse(
      {
        promptKey: "optimization-lot-selection-preference",
        taxYear: 2025,
        value: "highest-basis"
      },
      workspace
    );

    const snapshot = await getWorkspaceSnapshot(workspace);

    expect(snapshot.household.hasDigitalAssets).toBe(true);
    expect(snapshot.dataGaps.length).toBeGreaterThan(0);
    expect(snapshot.draft.requiredForms).toEqual(["1040", "schedule-d", "form-8949"]);
    expect(snapshot.importSessions).toEqual([
      expect.objectContaining({
        sourceDocumentId: snapshot.documents[0]?.id,
        status: "staged",
        transactionCount: 0
      })
    ]);
    expect(snapshot.extractions).toEqual([
      expect.objectContaining({
        documentId: snapshot.documents[0]?.id,
        extractorKey: "intake/crypto-wallet-export",
        status: "pending"
      })
    ]);
    expect(snapshot.questionnaire.find((prompt) => prompt.key === "optimization-lot-selection-preference")?.currentValue).toBe(
      "highest-basis"
    );
    expect(snapshot.reviewQueue.length).toBeGreaterThan(0);
    expect(snapshot.transferMatches).toEqual([]);
    expect(snapshot.transactions).toEqual([]);
    expect(snapshot.filingChecklist.federal.items.find((item) => item.id === "capital-activity-records")?.blocker).toBe(true);
    expect(snapshot.filingChecklist.federal.items.find((item) => item.id === "capital-activity-records")?.status).toBe(
      "incomplete"
    );
    expect(snapshot.filingChecklist.federal.readiness).toBe("needs-documents");
  });

  it("flags when federal and state readiness differ", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-readiness-diff");
    workspaces.push(workspace);

    await saveUploadedDocument(createMultipartFile("2025-W2-employer.pdf"), 2025, workspace);
    await saveUploadedDocument(createMultipartFile("2024-1040-federal-reference.pdf"), 2025, workspace);

    const snapshot = await getWorkspaceSnapshot(workspace);

    expect(snapshot.filingChecklist.federal.readiness).toBe("needs-review");
    expect(snapshot.filingChecklist.state.readiness).toBe("needs-documents");
    expect(snapshot.filingChecklist.differsByJurisdiction).toBe(true);
  });

  it("matches likely self-transfers across accounts and keeps them out of the unresolved review queue", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-transfer-match");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);

    await prisma.transactionImportSession.create({
      data: {
        id: "session-transfer-match",
        sourceFileName: "wallet-history.csv",
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
          entryKind: "transfer-out",
          id: "tx-transfer-out",
          importSessionId: "session-transfer-match",
          occurredAt: new Date("2025-02-01T12:00:00.000Z"),
          quantity: "0.125",
          taxYear: 2025
        },
        {
          accountLabel: "Ledger",
          assetSymbol: "BTC",
          entryKind: "transfer-in",
          id: "tx-transfer-in",
          importSessionId: "session-transfer-match",
          occurredAt: new Date("2025-02-01T12:07:00.000Z"),
          quantity: "0.125",
          taxYear: 2025
        }
      ]
    });

    const snapshot = await getWorkspaceSnapshot(workspace);

    expect(snapshot.transferMatches).toEqual([
      expect.objectContaining({
        inboundTransactionId: "tx-transfer-in",
        outboundTransactionId: "tx-transfer-out",
        status: "matched"
      })
    ]);
    expect(snapshot.reviewQueue.find((task) => task.id.includes("tx-transfer-out"))).toBeUndefined();
  });

  it("creates a review task when a transfer-out remains unmatched", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-transfer-unmatched");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);

    await prisma.transactionImportSession.create({
      data: {
        id: "session-transfer-unmatched",
        sourceFileName: "wallet-history.csv",
        sourceKind: "csv-upload",
        sourceLabel: "crypto-wallet-export",
        status: "completed",
        taxYear: 2025,
        transactionCount: 1
      }
    });
    await prisma.ledgerTransaction.create({
      data: {
        accountLabel: "Coinbase",
        assetSymbol: "BTC",
        entryKind: "transfer-out",
        id: "tx-transfer-out-unmatched",
        importSessionId: "session-transfer-unmatched",
        occurredAt: new Date("2025-03-01T09:30:00.000Z"),
        quantity: "0.25",
        taxYear: 2025
      }
    });

    const snapshot = await getWorkspaceSnapshot(workspace);

    expect(snapshot.transferMatches).toEqual([
      expect.objectContaining({
        outboundTransactionId: "tx-transfer-out-unmatched",
        status: "unmatched"
      })
    ]);
    const transferReviewTask = snapshot.reviewQueue.find((task) => task.actionLabel === "Resolve transfer");

    expect(transferReviewTask).toBeDefined();
    expect(transferReviewTask?.reason).toContain("match");
    expect(transferReviewTask?.title).toContain("Transfer review");
  });

  it("creates required basis review tasks when acquisitions and dispositions lack basis support", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-basis-review");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);

    await prisma.transactionImportSession.create({
      data: {
        id: "session-basis-review",
        sourceFileName: "wallet-history.csv",
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
          entryKind: "buy",
          id: "tx-basis-buy-missing",
          importSessionId: "session-basis-review",
          occurredAt: new Date("2025-01-10T10:00:00.000Z"),
          quantity: "0.025",
          taxYear: 2025
        },
        {
          accountLabel: "Coinbase",
          assetSymbol: "BTC",
          entryKind: "sell",
          id: "tx-basis-sell-missing",
          importSessionId: "session-basis-review",
          occurredAt: new Date("2025-02-10T10:00:00.000Z"),
          quantity: "0.010",
          taxYear: 2025
        }
      ]
    });

    const snapshot = await getWorkspaceSnapshot(workspace);
    const basisTasks = snapshot.reviewQueue.filter((task) => task.actionLabel === "Resolve cost basis");

    expect(basisTasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "review-basis-tx-basis-buy-missing",
          severity: "required"
        }),
        expect.objectContaining({
          id: "review-disposal-basis-tx-basis-sell-missing",
          severity: "required"
        })
      ])
    );
  });

  it("does not create basis review tasks when acquisition value support is present", async () => {
    const workspace = await createTestWorkspaceContext("taxes-workspace-basis-supported");
    workspaces.push(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);

    await prisma.transactionImportSession.create({
      data: {
        id: "session-basis-supported",
        sourceFileName: "wallet-history.csv",
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
          cashValueInCents: 90000,
          entryKind: "buy",
          id: "tx-basis-buy-supported",
          importSessionId: "session-basis-supported",
          occurredAt: new Date("2025-01-10T10:00:00.000Z"),
          quantity: "0.025",
          taxYear: 2025
        },
        {
          accountLabel: "Coinbase",
          assetSymbol: "BTC",
          cashValueInCents: 35000,
          entryKind: "sell",
          id: "tx-basis-sell-supported",
          importSessionId: "session-basis-supported",
          occurredAt: new Date("2025-02-10T10:00:00.000Z"),
          quantity: "0.010",
          taxYear: 2025
        }
      ]
    });

    const snapshot = await getWorkspaceSnapshot(workspace);
    const basisTasks = snapshot.reviewQueue.filter((task) => task.actionLabel === "Resolve cost basis");

    expect(basisTasks).toEqual([]);
    expect(snapshot.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assetSymbol: "BTC",
          cashValue: {
            amountInCents: 90000,
            currencyCode: "USD"
          },
          id: "tx-basis-buy-supported"
        })
      ])
    );
  });

});

function createMultipartFile(fileName: string): MultipartFile {
  return {
    file: Readable.from(["test file contents"]),
    filename: fileName,
    mimetype: "text/csv"
  } as MultipartFile;
}
