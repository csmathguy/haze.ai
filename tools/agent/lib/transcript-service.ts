import { AUDIT_DATABASE_URL } from "../../../apps/audit/api/src/config.js";
import { getAuditPrismaClient } from "../../../apps/audit/api/src/db/client.js";
import { ensureAuditDatabaseReady } from "../../../apps/audit/api/src/db/migrations.js";

export interface TranscriptArtifactRecord {
  capturedAt: Date;
  filePath: string;
  id: string;
  lineCount: number | null;
  runId: string;
  workItemId: string | null;
}

export interface TranscriptArtifactInput {
  filePath: string;
  lineCount?: number;
  runId: string;
  workItemId?: string;
}

function resolveUrl(databaseUrl?: string): string {
  return databaseUrl ?? process.env.AUDIT_DATABASE_URL ?? AUDIT_DATABASE_URL;
}

/**
 * Persist a new TranscriptArtifact record for a completed workflow run.
 */
export async function createTranscriptArtifact(
  input: TranscriptArtifactInput,
  databaseUrl?: string
): Promise<void> {
  const url = resolveUrl(databaseUrl);

  await ensureAuditDatabaseReady(url);

  const prisma = await getAuditPrismaClient(url);

  await prisma.transcriptArtifact.create({
    data: {
      filePath: input.filePath,
      runId: input.runId,
      ...(input.lineCount === undefined ? {} : { lineCount: input.lineCount }),
      ...(input.workItemId === undefined ? {} : { workItemId: input.workItemId })
    }
  });
}

/**
 * Look up the TranscriptArtifact for a given workflow run ID.
 * Returns null if no transcript was captured for that run.
 */
export async function findTranscriptArtifact(
  runId: string,
  databaseUrl?: string
): Promise<TranscriptArtifactRecord | null> {
  const url = resolveUrl(databaseUrl);

  await ensureAuditDatabaseReady(url);

  const prisma = await getAuditPrismaClient(url);

  return prisma.transcriptArtifact.findUnique({
    where: { runId }
  });
}
