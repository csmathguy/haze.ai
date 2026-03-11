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
import type { Prisma } from "@prisma/client";

import { getPrismaClient } from "../db/client.js";
import type { WorkspacePersistenceOptions } from "./context.js";
import { ensureWorkspacePaths, sanitizeFileName } from "./storage.js";

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

    return mapImportedDocument(savedDocument);
  } catch (error) {
    await rm(storedFilePath, { force: true });
    throw error;
  }
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
