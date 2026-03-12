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
});

function createMultipartFile(fileName: string): MultipartFile {
  return {
    file: Readable.from(["test file contents"]),
    filename: fileName,
    mimetype: "application/pdf"
  } as MultipartFile;
}
