import { randomUUID } from "node:crypto";

import type {
  CreateKnowledgeEntryDraftInput,
  CreateKnowledgeSubjectDraftInput,
  KnowledgeWorkspace,
  UpdateKnowledgeEntryPatchInput,
  UpdateKnowledgeSubjectPatchInput
} from "@taxes/shared";
import {
  CreateKnowledgeEntryInputSchema,
  CreateKnowledgeSubjectInputSchema,
  KnowledgeWorkspaceSchema,
  UpdateKnowledgeEntryInputSchema,
  UpdateKnowledgeSubjectInputSchema
} from "@taxes/shared";
import type { Prisma } from "@taxes/db";

import { REPOSITORY_DOCS_ROOT } from "../config.js";
import { getKnowledgePrismaClient } from "../db/client.js";
import type { KnowledgePersistenceOptions } from "./context.js";
import { compareKnowledgeEntries, compareKnowledgeSubjects, mapKnowledgeEntry, mapKnowledgeSubject } from "./knowledge-mapping.js";
import {
  buildEntrySlug,
  buildKnowledgeSummary,
  buildSubjectSlug,
  ensureKnowledgeSubjectExists,
  KnowledgeNotFoundError,
  KNOWLEDGE_ENTRY_INCLUDE,
  normalizePrimaryHuman,
  serializeJson
} from "./knowledge-support.js";
import { syncRepositoryDocs, type RepositoryDocSyncResult } from "./repository-docs.js";

export { KnowledgeConflictError, KnowledgeNotFoundError } from "./knowledge-support.js";

export async function getKnowledgeWorkspace(options: KnowledgePersistenceOptions = {}): Promise<KnowledgeWorkspace> {
  const prisma = await getKnowledgePrismaClient(options.databaseUrl);
  const [subjectRecords, entryRecords] = await Promise.all([
    prisma.knowledgeSubject.findMany(),
    prisma.knowledgeEntry.findMany({
      include: KNOWLEDGE_ENTRY_INCLUDE
    })
  ]);
  const subjects = subjectRecords.toSorted(compareKnowledgeSubjects).map(mapKnowledgeSubject);
  const entries = entryRecords.toSorted(compareKnowledgeEntries).map(mapKnowledgeEntry);

  return KnowledgeWorkspaceSchema.parse({
    entries,
    generatedAt: new Date().toISOString(),
    localOnly: true,
    subjects,
    summary: buildKnowledgeSummary(entries, subjects)
  });
}

export async function createKnowledgeSubject(
  input: CreateKnowledgeSubjectDraftInput,
  options: KnowledgePersistenceOptions = {}
) {
  const prisma = await getKnowledgePrismaClient(options.databaseUrl);
  const parsedInput = CreateKnowledgeSubjectInputSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const subject = await transaction.knowledgeSubject.create({
      data: {
        id: randomUUID(),
        isPrimaryHuman: parsedInput.isPrimaryHuman,
        kind: parsedInput.kind,
        name: parsedInput.name,
        namespace: parsedInput.namespace,
        profileJson: parsedInput.profile === undefined ? null : serializeJson(parsedInput.profile),
        slug: buildSubjectSlug(parsedInput.name, parsedInput.slug),
        summary: parsedInput.summary ?? null
      }
    });

    if (subject.isPrimaryHuman) {
      await normalizePrimaryHuman(transaction, subject.id);
    }

    return mapKnowledgeSubject(subject);
  });
}

export async function updateKnowledgeSubject(
  subjectId: string,
  input: UpdateKnowledgeSubjectPatchInput,
  options: KnowledgePersistenceOptions = {}
) {
  const prisma = await getKnowledgePrismaClient(options.databaseUrl);
  const parsedInput = UpdateKnowledgeSubjectInputSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.knowledgeSubject.findUnique({
      where: {
        id: subjectId
      }
    });

    if (existing === null) {
      throw new KnowledgeNotFoundError(`Knowledge subject ${subjectId} was not found.`);
    }

    const subject = await transaction.knowledgeSubject.update({
      data: buildKnowledgeSubjectUpdateData(parsedInput),
      where: {
        id: subjectId
      }
    });

    if (subject.isPrimaryHuman) {
      await normalizePrimaryHuman(transaction, subject.id);
    }

    return mapKnowledgeSubject(subject);
  });
}

export async function createKnowledgeEntry(
  input: CreateKnowledgeEntryDraftInput,
  options: KnowledgePersistenceOptions = {}
) {
  const prisma = await getKnowledgePrismaClient(options.databaseUrl);
  const parsedInput = CreateKnowledgeEntryInputSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    if (parsedInput.subjectId !== undefined) {
      await ensureKnowledgeSubjectExists(transaction, parsedInput.subjectId);
    }

    const entry = await transaction.knowledgeEntry.create({
      data: {
        contentJson: serializeJson(parsedInput.content),
        createdByKind: parsedInput.createdByKind,
        createdByName: parsedInput.createdByName ?? null,
        id: randomUUID(),
        importance: parsedInput.importance,
        kind: parsedInput.kind,
        namespace: parsedInput.namespace,
        origin: parsedInput.origin,
        slug: buildEntrySlug(parsedInput.title, parsedInput.slug),
        sourceTitle: parsedInput.sourceTitle ?? null,
        sourceUri: parsedInput.sourceUri ?? null,
        status: parsedInput.status,
        subjectId: parsedInput.subjectId ?? null,
        tagsJson: serializeJson(parsedInput.tags),
        title: parsedInput.title,
        visibility: parsedInput.visibility
      },
      include: KNOWLEDGE_ENTRY_INCLUDE
    });

    return mapKnowledgeEntry(entry);
  });
}

export async function updateKnowledgeEntry(
  entryId: string,
  input: UpdateKnowledgeEntryPatchInput,
  options: KnowledgePersistenceOptions = {}
) {
  const prisma = await getKnowledgePrismaClient(options.databaseUrl);
  const parsedInput = UpdateKnowledgeEntryInputSchema.parse(input);

  return prisma.$transaction(async (transaction) => {
    const existing = await transaction.knowledgeEntry.findUnique({
      where: {
        id: entryId
      }
    });

    if (existing === null) {
      throw new KnowledgeNotFoundError(`Knowledge entry ${entryId} was not found.`);
    }

    if (parsedInput.subjectId !== undefined && parsedInput.subjectId !== null) {
      await ensureKnowledgeSubjectExists(transaction, parsedInput.subjectId);
    }

    const entry = await transaction.knowledgeEntry.update({
      data: buildKnowledgeEntryUpdateData(parsedInput),
      include: KNOWLEDGE_ENTRY_INCLUDE,
      where: {
        id: entryId
      }
    });

    return mapKnowledgeEntry(entry);
  });
}

export async function importRepositoryKnowledge(options: KnowledgePersistenceOptions = {}): Promise<RepositoryDocSyncResult> {
  const prisma = await getKnowledgePrismaClient(options.databaseUrl);
  const docsRoot = options.docsRoot ?? REPOSITORY_DOCS_ROOT;

  return prisma.$transaction(async (transaction) => syncRepositoryDocs(transaction, docsRoot));
}

function buildKnowledgeSubjectUpdateData(
  input: ReturnType<typeof UpdateKnowledgeSubjectInputSchema.parse>
): Prisma.KnowledgeSubjectUpdateInput {
  return {
    ...(input.isPrimaryHuman === undefined ? {} : { isPrimaryHuman: input.isPrimaryHuman }),
    ...(input.name === undefined ? {} : { name: input.name }),
    ...(input.namespace === undefined ? {} : { namespace: input.namespace }),
    ...(input.profile === undefined ? {} : { profileJson: serializeJson(input.profile) }),
    ...(input.summary === undefined ? {} : { summary: input.summary })
  };
}

function buildKnowledgeEntryUpdateData(
  input: ReturnType<typeof UpdateKnowledgeEntryInputSchema.parse>
): Prisma.KnowledgeEntryUpdateInput {
  return {
    ...buildKnowledgeEntryScalarUpdate(input),
    ...buildKnowledgeSubjectRelationUpdate(input.subjectId),
    ...buildKnowledgeEntryMetadataUpdate(input)
  };
}

function buildKnowledgeEntryScalarUpdate(
  input: ReturnType<typeof UpdateKnowledgeEntryInputSchema.parse>
): Omit<Prisma.KnowledgeEntryUpdateInput, "subject"> {
  return {
    ...(input.content === undefined ? {} : { contentJson: serializeJson(input.content) }),
    ...(input.importance === undefined ? {} : { importance: input.importance }),
    ...(input.lastReviewedAt === undefined ? {} : { lastReviewedAt: input.lastReviewedAt }),
    ...(input.namespace === undefined ? {} : { namespace: input.namespace }),
    ...(input.sourceTitle === undefined ? {} : { sourceTitle: input.sourceTitle }),
    ...(input.sourceUri === undefined ? {} : { sourceUri: input.sourceUri }),
    ...(input.status === undefined ? {} : { status: input.status })
  };
}

function buildKnowledgeSubjectRelationUpdate(
  subjectId: ReturnType<typeof UpdateKnowledgeEntryInputSchema.parse>["subjectId"]
): Prisma.KnowledgeEntryUpdateInput {
  if (subjectId === undefined) {
    return {};
  }

  if (subjectId === null) {
    return {
      subject: {
        disconnect: true
      }
    };
  }

  return {
    subject: {
      connect: {
        id: subjectId
      }
    }
  };
}

function buildKnowledgeEntryMetadataUpdate(
  input: ReturnType<typeof UpdateKnowledgeEntryInputSchema.parse>
): Omit<Prisma.KnowledgeEntryUpdateInput, "subject"> {
  return {
    ...(input.tags === undefined ? {} : { tagsJson: serializeJson(input.tags) }),
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.visibility === undefined ? {} : { visibility: input.visibility })
  };
}
