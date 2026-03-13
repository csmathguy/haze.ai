import type { Prisma } from "@prisma/client";

import { stringifyJson } from "./audit-serialization.js";
import type {
  AuditMetadata,
  AuditSyncArtifactSummary,
  AuditSyncDecisionSummary,
  AuditSyncEvent,
  AuditSyncFailureSummary
} from "./audit-sync-contract.js";

export async function syncTypedRecordFromEvent(
  transaction: Prisma.TransactionClient,
  event: AuditSyncEvent
): Promise<void> {
  if (event.metadata === undefined) {
    return;
  }

  if (event.eventType === "decision-recorded") {
    const decision = toDecisionSummary(event);

    await transaction.auditDecisionRecord.upsert({
      create: buildDecisionCreateInput(event.runId, decision),
      update: buildDecisionUpdateInput(decision),
      where: {
        id: decision.decisionId
      }
    });
  }

  if (event.eventType === "artifact-recorded") {
    const artifact = toArtifactSummary(event);

    await transaction.auditArtifactRecord.upsert({
      create: buildArtifactCreateInput(event.runId, artifact),
      update: buildArtifactUpdateInput(artifact),
      where: {
        id: artifact.artifactId
      }
    });
  }

  if (event.eventType === "failure-recorded") {
    const failure = toFailureSummary(event);

    await transaction.auditFailureRecord.upsert({
      create: buildFailureCreateInput(event.runId, failure),
      update: buildFailureUpdateInput(failure),
      where: {
        id: failure.failureId
      }
    });
  }
}

export function buildDecisionCreateInput(
  runId: string,
  decision: AuditSyncDecisionSummary
): Prisma.AuditDecisionRecordUncheckedCreateInput {
  return {
    category: decision.category,
    executionId: decision.executionId ?? null,
    id: decision.decisionId,
    metadataJson: stringifyJson(decision.metadata),
    optionsJson: stringifyJson(decision.options),
    rationale: decision.rationale ?? null,
    runId,
    selectedOption: decision.selectedOption ?? null,
    summary: decision.summary,
    timestamp: new Date(decision.timestamp)
  };
}

export function buildDecisionUpdateInput(
  decision: AuditSyncDecisionSummary
): Prisma.AuditDecisionRecordUncheckedUpdateInput {
  return compactUpdate({
    category: decision.category,
    executionId: decision.executionId,
    metadataJson: optionalJson(decision.metadata),
    optionsJson: optionalJson(decision.options),
    rationale: decision.rationale,
    selectedOption: decision.selectedOption,
    summary: decision.summary,
    timestamp: new Date(decision.timestamp)
  }) as Prisma.AuditDecisionRecordUncheckedUpdateInput;
}

export function buildArtifactCreateInput(
  runId: string,
  artifact: AuditSyncArtifactSummary
): Prisma.AuditArtifactRecordUncheckedCreateInput {
  return {
    artifactType: artifact.artifactType,
    executionId: artifact.executionId ?? null,
    id: artifact.artifactId,
    label: artifact.label,
    metadataJson: stringifyJson(artifact.metadata),
    path: artifact.path ?? null,
    runId,
    status: artifact.status,
    timestamp: new Date(artifact.timestamp),
    uri: artifact.uri ?? null
  };
}

export function buildArtifactUpdateInput(
  artifact: AuditSyncArtifactSummary
): Prisma.AuditArtifactRecordUncheckedUpdateInput {
  return compactUpdate({
    artifactType: artifact.artifactType,
    executionId: artifact.executionId,
    label: artifact.label,
    metadataJson: optionalJson(artifact.metadata),
    path: artifact.path,
    status: artifact.status,
    timestamp: new Date(artifact.timestamp),
    uri: artifact.uri
  }) as Prisma.AuditArtifactRecordUncheckedUpdateInput;
}

export function buildFailureCreateInput(
  runId: string,
  failure: AuditSyncFailureSummary
): Prisma.AuditFailureRecordUncheckedCreateInput {
  return {
    category: failure.category,
    detail: failure.detail ?? null,
    executionId: failure.executionId ?? null,
    id: failure.failureId,
    metadataJson: stringifyJson(failure.metadata),
    retryable: failure.retryable,
    runId,
    severity: failure.severity,
    status: failure.status,
    summary: failure.summary,
    timestamp: new Date(failure.timestamp)
  };
}

export function buildFailureUpdateInput(
  failure: AuditSyncFailureSummary
): Prisma.AuditFailureRecordUncheckedUpdateInput {
  return compactUpdate({
    category: failure.category,
    detail: failure.detail,
    executionId: failure.executionId,
    metadataJson: optionalJson(failure.metadata),
    retryable: failure.retryable,
    severity: failure.severity,
    status: failure.status,
    summary: failure.summary,
    timestamp: new Date(failure.timestamp)
  }) as Prisma.AuditFailureRecordUncheckedUpdateInput;
}

function toDecisionSummary(event: AuditSyncEvent): AuditSyncDecisionSummary {
  const metadata = getNestedAuditMetadata(event);
  const options = getStringArrayMetadata(event, "options");
  const rationale = getStringMetadata(event, "rationale");
  const selectedOption = getStringMetadata(event, "selectedOption");

  return {
    category: readStringMetadata(event, "category"),
    decisionId: readStringMetadata(event, "decisionId"),
    summary: readStringMetadata(event, "summary"),
    timestamp: event.timestamp,
    ...(event.executionId === undefined ? {} : { executionId: event.executionId }),
    ...(metadata === undefined ? {} : { metadata }),
    ...(options === undefined ? {} : { options }),
    ...(rationale === undefined ? {} : { rationale }),
    ...(selectedOption === undefined ? {} : { selectedOption })
  };
}

function toArtifactSummary(event: AuditSyncEvent): AuditSyncArtifactSummary {
  const metadata = getNestedAuditMetadata(event);
  const artifactPath = getStringMetadata(event, "path");
  const uri = getStringMetadata(event, "uri");

  return {
    artifactId: readStringMetadata(event, "artifactId"),
    artifactType: readStringMetadata(event, "artifactType"),
    label: readStringMetadata(event, "label"),
    status: readStringMetadata(event, "status"),
    timestamp: event.timestamp,
    ...(event.executionId === undefined ? {} : { executionId: event.executionId }),
    ...(metadata === undefined ? {} : { metadata }),
    ...(artifactPath === undefined ? {} : { path: artifactPath }),
    ...(uri === undefined ? {} : { uri })
  };
}

function toFailureSummary(event: AuditSyncEvent): AuditSyncFailureSummary {
  const detail = getStringMetadata(event, "detail");
  const metadata = getNestedAuditMetadata(event);

  return {
    category: readStringMetadata(event, "category"),
    failureId: readStringMetadata(event, "failureId"),
    retryable: event.metadata?.retryable === true,
    severity: readFailureSeverityMetadata(event),
    status: readFailureStatusMetadata(event),
    summary: readStringMetadata(event, "summary"),
    timestamp: event.timestamp,
    ...(detail === undefined ? {} : { detail }),
    ...(event.executionId === undefined ? {} : { executionId: event.executionId }),
    ...(metadata === undefined ? {} : { metadata })
  };
}

function compactUpdate(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function optionalJson(value: unknown): string | undefined {
  return stringifyJson(value) ?? undefined;
}

function readStringMetadata(event: AuditSyncEvent, key: string): string {
  const value = event.metadata?.[key];

  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Expected ${event.eventType} metadata to include a string "${key}".`);
  }

  return value;
}

function readFailureSeverityMetadata(event: AuditSyncEvent): AuditSyncFailureSummary["severity"] {
  const value = readStringMetadata(event, "severity");

  if (value === "critical" || value === "high" || value === "low" || value === "medium") {
    return value;
  }

  throw new Error(`Unknown failure severity: ${value}`);
}

function readFailureStatusMetadata(event: AuditSyncEvent): AuditSyncFailureSummary["status"] {
  const value = readStringMetadata(event, "status");

  if (value === "open" || value === "resolved") {
    return value;
  }

  throw new Error(`Unknown failure status: ${value}`);
}

function getStringMetadata(event: AuditSyncEvent, key: string): string | undefined {
  const value = event.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function getStringArrayMetadata(event: AuditSyncEvent, key: string): string[] | undefined {
  if (!Array.isArray(event.metadata?.[key])) {
    return undefined;
  }

  const value = event.metadata[key] as unknown[];
  return value.every((entry) => typeof entry === "string") ? value : undefined;
}

function getNestedAuditMetadata(event: AuditSyncEvent): AuditMetadata | undefined {
  return hasMetadataObject(event) ? event.metadata.metadata : undefined;
}

function hasMetadataObject(event: AuditSyncEvent): event is AuditSyncEvent & { metadata: AuditMetadata & { metadata: AuditMetadata } } {
  return typeof event.metadata?.metadata === "object" && event.metadata.metadata !== null && !Array.isArray(event.metadata.metadata);
}
