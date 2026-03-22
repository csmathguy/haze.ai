import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import * as path from "node:path";

import {
  buildDocumentMissingFacts,
  inferDocumentKindFromFileName,
  ImportedDocumentSchema,
  type ImportedDocument
} from "@taxes/shared";
import type { MultipartFile } from "@fastify/multipart";
import type { Prisma, PrismaClient } from "@taxes/db";

import { getPrismaClient } from "../db/client.js";
import type { WorkspacePersistenceOptions } from "./context.js";
import { ensureWorkspacePaths, sanitizeFileName } from "./storage.js";
import { importLedgerTransactionsFromCsv } from "./transaction-import.js";

const importedDocumentInclude = {
  missingFacts: {
    orderBy: {
      sequence: "asc"
    }
  }
} as const;

type ImportedDocumentRecord = Prisma.ImportedDocumentGetPayload<{
  include: typeof importedDocumentInclude;
}>;

export async function listImportedDocuments(options: WorkspacePersistenceOptions = {}): Promise<ImportedDocument[]> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const documents = await prisma.importedDocument.findMany({
    include: importedDocumentInclude,
    orderBy: {
      importedAt: "desc"
    }
  });

  return documents.map(mapImportedDocument);
}

export async function saveUploadedDocument(
  upload: MultipartFile,
  taxYear: number,
  options: WorkspacePersistenceOptions = {}
): Promise<ImportedDocument> {
  const paths = await ensureWorkspacePaths(options.rootDirectory);
  const prisma = await getPrismaClient(options.databaseUrl);
  const id = randomUUID();
  const safeFileName = sanitizeFileName(upload.filename);
  const storedFileName = `${id}-${safeFileName}`;
  const storedFilePath = path.join(paths.uploadsDir, storedFileName);

  await pipeline(upload.file, createWriteStream(storedFilePath));

  try {
    const storedFileStats = await stat(storedFilePath);
    const document = createImportedDocument({
      fileName: upload.filename,
      fileSizeBytes: storedFileStats.size,
      id,
      mimeType: upload.mimetype,
      taxYear
    });
    const savedDocument = await prisma.importedDocument.create({
      data: {
        fileName: document.fileName,
        fileSizeBytes: document.fileSizeBytes,
        id: document.id,
        importedAt: new Date(document.importedAt),
        kind: document.kind,
        mimeType: document.mimeType,
        missingFacts: {
          create: document.missingFacts.map((fact, index) => ({
            id: `${document.id}-missing-${(index + 1).toString()}`,
            key: fact.key,
            label: fact.label,
            reason: fact.reason,
            sequence: index,
            severity: fact.severity
          }))
        },
        status: document.status,
        storedFileName,
        taxYear: document.taxYear
      },
      include: importedDocumentInclude
    });
    await seedDocumentIntakeArtifacts(prisma, document, storedFilePath);

    return mapImportedDocument(savedDocument);
  } catch (error) {
    await rm(storedFilePath, { force: true });
    throw error;
  }
}

async function seedDocumentIntakeArtifacts(prisma: PrismaClient, document: ImportedDocument, storedFilePath: string): Promise<void> {
  await prisma.documentExtraction.create({
    data: {
      documentId: document.id,
      extractorKey: inferExtractorKey(document),
      id: `${document.id}-extraction`,
      status: "pending",
      statusMessage: inferExtractionStatusMessage(document)
    }
  });
  await prisma.dataGap.createMany({
    data: document.missingFacts.map((fact, index) => ({
      description: fact.reason,
      documentId: document.id,
      gapKind: inferGapKind(document.kind, fact.key),
      id: `${document.id}-gap-${(index + 1).toString()}`,
      key: fact.key,
      severity: fact.severity,
      status: "open",
      title: `${document.fileName}: ${fact.label}`
    }))
  });

  if (supportsTransactionImports(document.kind)) {
    const importSessionId = `${document.id}-import-session`;

    await prisma.transactionImportSession.create({
      data: {
        id: importSessionId,
        sourceDocumentId: document.id,
        sourceFileName: document.fileName,
        sourceKind: inferTransactionImportSourceKind(document.mimeType),
        sourceLabel: document.kind,
        status: "staged",
        taxYear: document.taxYear,
        transactionCount: 0
      }
    });

    if (document.mimeType.includes("csv")) {
      await importLedgerTransactionsFromCsv({
        defaultAccountLabel: deriveAccountLabel(document.fileName),
        documentId: document.id,
        filePath: storedFilePath,
        importSessionId,
        prisma,
        taxYear: document.taxYear
      });
    }
  }
}

function deriveAccountLabel(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, "").replace(/[-_]+/gu, " ").trim();
}

function inferExtractionStatusMessage(document: ImportedDocument): string {
  if (document.mimeType.includes("csv")) {
    return "CSV and tabular extraction can be layered in with a local parser adapter for this document family.";
  }

  return "Document queued for local extraction modeling. A parser adapter has not been implemented for this format yet.";
}

function inferExtractorKey(document: ImportedDocument): string {
  return `intake/${document.kind}`;
}

function inferTransactionImportSourceKind(documentMimeType: string): "csv-upload" | "document-upload" {
  return documentMimeType.includes("csv") ? "csv-upload" : "document-upload";
}

function inferGapKind(documentKind: ImportedDocument["kind"], factKey: string): "document-classification" | "missing-source-field" | "missing-tax-lot" {
  if (factKey === "document-classification" || factKey === "field-mapping-review") {
    return "document-classification";
  }

  if (
    documentKind === "1099-b" ||
    documentKind === "1099-da" ||
    documentKind === "brokerage-statement" ||
    documentKind === "crypto-wallet-export"
  ) {
    return "missing-tax-lot";
  }

  return "missing-source-field";
}

interface CreateImportedDocumentInput {
  fileName: string;
  fileSizeBytes: number;
  id: string;
  mimeType: string;
  taxYear: number;
}

function createImportedDocument(input: CreateImportedDocumentInput): ImportedDocument {
  const kind = inferDocumentKindFromFileName(input.fileName);

  return {
    fileName: input.fileName,
    fileSizeBytes: input.fileSizeBytes,
    id: input.id,
    importedAt: new Date().toISOString(),
    kind,
    mimeType: input.mimeType,
    missingFacts: buildDocumentMissingFacts(kind).map((label) => ({
      key: label.toLowerCase().replace(/\s+/gu, "-"),
      label,
      reason: `${label} is needed before return preparation and lot optimization can be trusted.`,
      severity: "required"
    })),
    status: kind === "unknown" ? "needs-review" : "imported",
    taxYear: input.taxYear
  };
}

function supportsTransactionImports(documentKind: ImportedDocument["kind"]): boolean {
  return (
    documentKind === "1099-b" ||
    documentKind === "1099-da" ||
    documentKind === "brokerage-statement" ||
    documentKind === "crypto-wallet-export"
  );
}

function mapImportedDocument(document: ImportedDocumentRecord): ImportedDocument {
  return ImportedDocumentSchema.parse({
    fileName: document.fileName,
    fileSizeBytes: document.fileSizeBytes,
    id: document.id,
    importedAt: document.importedAt.toISOString(),
    kind: document.kind,
    mimeType: document.mimeType,
    missingFacts: document.missingFacts.map((fact) => ({
      key: fact.key,
      label: fact.label,
      reason: fact.reason,
      severity: fact.severity
    })),
    status: document.status,
    taxYear: document.taxYear
  });
}
