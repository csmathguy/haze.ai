import { Readable } from "node:stream";

import type { MultipartFile } from "@fastify/multipart";
import { afterEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "../db/client.js";
import type { TestWorkspaceContext } from "../test/database.js";
import { createTestWorkspaceContext } from "../test/database.js";
import { listImportedDocuments, saveUploadedDocument } from "./document-store.js";

describe("document-store", () => {
  const workspaces: TestWorkspaceContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("persists imported document metadata in the local workspace", async () => {
    const workspace = await createTestWorkspaceContext("taxes-document-store");
    workspaces.push(workspace);

    const storedDocument = await saveUploadedDocument(createMultipartFile("2025-W2.pdf"), 2025, workspace);
    const listedDocuments = await listImportedDocuments(workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);
    const extractions = await prisma.documentExtraction.findMany({
      where: {
        documentId: storedDocument.id
      }
    });
    const gaps = await prisma.dataGap.findMany({
      orderBy: {
        key: "asc"
      },
      where: {
        documentId: storedDocument.id
      }
    });

    expect(storedDocument.kind).toBe("w-2");
    expect(storedDocument.fileSizeBytes).toBeGreaterThan(0);
    expect(listedDocuments).toHaveLength(1);
    expect(listedDocuments[0]?.missingFacts[0]?.label).toBe("state withholding reconciliation");
    expect(extractions).toEqual([
      expect.objectContaining({
        documentId: storedDocument.id,
        extractorKey: "intake/w-2",
        status: "pending"
      })
    ]);
    expect(gaps).toHaveLength(storedDocument.missingFacts.length);
    expect(gaps[0]).toEqual(
      expect.objectContaining({
        documentId: storedDocument.id,
        gapKind: "missing-source-field",
        status: "open"
      })
    );
  });

  it("imports transaction rows from a crypto csv upload into the ledger", async () => {
    const workspace = await createTestWorkspaceContext("taxes-document-store-csv");
    workspaces.push(workspace);

    const storedDocument = await saveUploadedDocument(
      createMultipartFile(
        "coinbase-wallet-export.csv",
        "Timestamp,Type,Asset,Quantity,Account\n2025-02-01T12:00:00.000Z,Transfer Out,BTC,0.125,Coinbase\n2025-02-01T12:07:00.000Z,Transfer In,BTC,0.125,Ledger\n",
        "text/csv"
      ),
      2025,
      workspace
    );
    const prisma = await getPrismaClient(workspace.databaseUrl);
    const importSessions = await prisma.transactionImportSession.findMany({
      where: {
        sourceDocumentId: storedDocument.id
      }
    });
    const transactions = await prisma.ledgerTransaction.findMany({
      orderBy: {
        occurredAt: "asc"
      },
      where: {
        sourceDocumentId: storedDocument.id
      }
    });

    expect(importSessions).toEqual([
      expect.objectContaining({
        sourceDocumentId: storedDocument.id,
        status: "completed",
        transactionCount: 2
      })
    ]);
    expect(transactions).toEqual([
      expect.objectContaining({
        accountLabel: "Coinbase",
        assetSymbol: "BTC",
        entryKind: "transfer-out",
        quantity: "0.125"
      }),
      expect.objectContaining({
        accountLabel: "Ledger",
        assetSymbol: "BTC",
        entryKind: "transfer-in",
        quantity: "0.125"
      })
    ]);
  });

  it("supports exchange-style csv headers without an explicit account column", async () => {
    const workspace = await createTestWorkspaceContext("taxes-document-store-exchange-csv");
    workspaces.push(workspace);

    const storedDocument = await saveUploadedDocument(
      createMultipartFile(
        "coinbase-2025.csv",
        "Timestamp,Transaction Type,Asset,Quantity Transacted\n2025-01-15T14:30:00.000Z,Buy,BTC,0.015\n2025-01-18T09:10:00.000Z,Withdrawal,BTC,0.010\n",
        "text/csv"
      ),
      2025,
      workspace
    );
    const prisma = await getPrismaClient(workspace.databaseUrl);
    const transactions = await prisma.ledgerTransaction.findMany({
      orderBy: {
        occurredAt: "asc"
      },
      where: {
        sourceDocumentId: storedDocument.id
      }
    });

    expect(transactions).toEqual([
      expect.objectContaining({
        accountLabel: "coinbase 2025",
        assetSymbol: "BTC",
        entryKind: "buy",
        quantity: "0.015"
      }),
      expect.objectContaining({
        accountLabel: "coinbase 2025",
        assetSymbol: "BTC",
        entryKind: "transfer-out",
        quantity: "0.010"
      })
    ]);
  });

  it("persists imported cash values from exchange-style csv rows", async () => {
    const workspace = await createTestWorkspaceContext("taxes-document-store-cash-value");
    workspaces.push(workspace);

    const storedDocument = await saveUploadedDocument(
      createMultipartFile(
        "coinbase-proceeds-2025.csv",
        "Timestamp,Transaction Type,Asset,Quantity Transacted,Subtotal\n2025-01-15T14:30:00.000Z,Buy,BTC,0.015,$450.25\n2025-01-18T09:10:00.000Z,Sell,BTC,0.010,$325.10\n",
        "text/csv"
      ),
      2025,
      workspace
    );
    const prisma = await getPrismaClient(workspace.databaseUrl);
    const transactions = await prisma.ledgerTransaction.findMany({
      orderBy: {
        occurredAt: "asc"
      },
      where: {
        sourceDocumentId: storedDocument.id
      }
    });

    expect(transactions).toEqual([
      expect.objectContaining({
        assetSymbol: "BTC",
        cashValueInCents: 45025,
        entryKind: "buy",
        quantity: "0.015"
      }),
      expect.objectContaining({
        assetSymbol: "BTC",
        cashValueInCents: 32510,
        entryKind: "sell",
        quantity: "0.010"
      })
    ]);
  });
});

function createMultipartFile(fileName: string, contents = "test file contents", mimetype = "application/pdf"): MultipartFile {
  return {
    file: Readable.from([contents]),
    filename: fileName,
    mimetype
  } as MultipartFile;
}
