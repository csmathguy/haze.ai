import { randomUUID } from "node:crypto";

import {
  appendArtifactSummary,
  appendAuditEvent,
  appendDecisionSummary,
  appendFailureSummary,
  appendHandoffSummary,
  createEvent,
  createWorkflowSummary,
  ensureAuditPaths,
  getActiveRunId,
  getEventContextFields,
  readSummary,
  writeSummary,
  type AuditMetadata,
  type AuditMetadataValue
} from "./lib/audit.js";
import type {
  AuditArtifactSummary,
  AuditDecisionSummary,
  AuditFailureSeverity,
  AuditFailureStatus,
  AuditFailureSummary,
  AuditHandoffStatus,
  AuditHandoffSummary
} from "./lib/audit-records.js";

type CommandName = "artifact" | "decision" | "failure" | "handoff";
type WorkflowContext = Awaited<ReturnType<typeof loadWorkflowContext>>;

async function main(): Promise<void> {
  const [commandName, ...rawArgs] = process.argv.slice(2);

  if (!isCommandName(commandName)) {
    throw new Error("Expected one of: artifact, decision, failure, handoff");
  }

  const parsed = parseFlagPairs(rawArgs);
  const workflow = readRequiredString(parsed, "--workflow");
  const context = await loadWorkflowContext(workflow);
  const output = await COMMAND_HANDLERS[commandName](parsed, context);

  process.stdout.write(`${output}\n`);
}

async function getExistingRunId(workflow: string): Promise<string> {
  const runId = await getActiveRunId(workflow);

  if (runId === null) {
    throw new Error(`No active workflow found for "${workflow}". Run workflow:start first.`);
  }

  return runId;
}

function isCommandName(value: string | undefined): value is CommandName {
  return value === "artifact" || value === "decision" || value === "failure" || value === "handoff";
}

function buildDecisionSummary(parsed: Record<string, string[]>): AuditDecisionSummary {
  return {
    category: readRequiredString(parsed, "--category"),
    decisionId: randomUUID(),
    summary: readRequiredString(parsed, "--summary"),
    timestamp: new Date().toISOString(),
    ...(parsed["--execution-id"] === undefined ? {} : { executionId: readRequiredString(parsed, "--execution-id") }),
    ...(parsed["--metadata"] === undefined ? {} : { metadata: parseMetadataEntries(parsed["--metadata"]) }),
    ...(parsed["--option"] === undefined ? {} : { options: parsed["--option"] }),
    ...(parsed["--rationale"] === undefined ? {} : { rationale: readRequiredString(parsed, "--rationale") }),
    ...(parsed["--selected-option"] === undefined
      ? {}
      : { selectedOption: readRequiredString(parsed, "--selected-option") })
  };
}

function buildArtifactSummary(parsed: Record<string, string[]>): AuditArtifactSummary {
  return {
    artifactId: randomUUID(),
    artifactType: readRequiredString(parsed, "--type"),
    label: readRequiredString(parsed, "--label"),
    status: parsed["--status"]?.at(-1) ?? "created",
    timestamp: new Date().toISOString(),
    ...(parsed["--execution-id"] === undefined ? {} : { executionId: readRequiredString(parsed, "--execution-id") }),
    ...(parsed["--metadata"] === undefined ? {} : { metadata: parseMetadataEntries(parsed["--metadata"]) }),
    ...(parsed["--path"] === undefined ? {} : { path: readRequiredString(parsed, "--path") }),
    ...(parsed["--uri"] === undefined ? {} : { uri: readRequiredString(parsed, "--uri") })
  };
}

function buildFailureSummary(parsed: Record<string, string[]>): AuditFailureSummary {
  return {
    category: readRequiredString(parsed, "--category"),
    failureId: randomUUID(),
    retryable: parsed["--retryable"]?.at(-1) === "true",
    severity: readFailureSeverity(parsed),
    status: readFailureStatus(parsed),
    summary: readRequiredString(parsed, "--summary"),
    timestamp: new Date().toISOString(),
    ...(parsed["--detail"] === undefined ? {} : { detail: readRequiredString(parsed, "--detail") }),
    ...(parsed["--execution-id"] === undefined ? {} : { executionId: readRequiredString(parsed, "--execution-id") }),
    ...(parsed["--metadata"] === undefined ? {} : { metadata: parseMetadataEntries(parsed["--metadata"]) })
  };
}

function buildHandoffSummary(
  parsed: Record<string, string[]>,
  summary: { planRunId?: string; planStepId?: string; workItemId?: string }
): AuditHandoffSummary {
  return {
    handoffId: randomUUID(),
    sourceAgent: readRequiredString(parsed, "--source-agent"),
    status: readHandoffStatus(parsed),
    summary: readRequiredString(parsed, "--summary"),
    targetAgent: readRequiredString(parsed, "--target-agent"),
    timestamp: new Date().toISOString(),
    ...(parsed["--artifact-id"] === undefined ? {} : { artifactIds: parsed["--artifact-id"] }),
    ...(parsed["--detail"] === undefined ? {} : { detail: readRequiredString(parsed, "--detail") }),
    ...(parsed["--execution-id"] === undefined ? {} : { executionId: readRequiredString(parsed, "--execution-id") }),
    ...(parsed["--metadata"] === undefined ? {} : { metadata: parseMetadataEntries(parsed["--metadata"]) }),
    ...resolveOptionalContextField(parsed, "--plan-run-id", "planRunId", summary.planRunId),
    ...resolveOptionalContextField(parsed, "--plan-step-id", "planStepId", summary.planStepId),
    ...resolveOptionalContextField(parsed, "--work-item-id", "workItemId", summary.workItemId)
  };
}

function buildDecisionMetadata(decision: AuditDecisionSummary): AuditMetadata {
  return {
    category: decision.category,
    decisionId: decision.decisionId,
    ...(decision.executionId === undefined ? {} : { executionId: decision.executionId }),
    ...(decision.metadata === undefined ? {} : { metadata: decision.metadata }),
    ...(decision.options === undefined ? {} : { options: decision.options }),
    ...(decision.rationale === undefined ? {} : { rationale: decision.rationale }),
    ...(decision.selectedOption === undefined ? {} : { selectedOption: decision.selectedOption }),
    summary: decision.summary
  };
}

function buildArtifactMetadata(artifact: AuditArtifactSummary): AuditMetadata {
  return {
    artifactId: artifact.artifactId,
    artifactType: artifact.artifactType,
    label: artifact.label,
    status: artifact.status,
    ...(artifact.executionId === undefined ? {} : { executionId: artifact.executionId }),
    ...(artifact.metadata === undefined ? {} : { metadata: artifact.metadata }),
    ...(artifact.path === undefined ? {} : { path: artifact.path }),
    ...(artifact.uri === undefined ? {} : { uri: artifact.uri })
  };
}

function buildFailureMetadata(failure: AuditFailureSummary): AuditMetadata {
  return {
    category: failure.category,
    failureId: failure.failureId,
    retryable: failure.retryable,
    severity: failure.severity,
    status: failure.status,
    summary: failure.summary,
    ...(failure.detail === undefined ? {} : { detail: failure.detail }),
    ...(failure.executionId === undefined ? {} : { executionId: failure.executionId }),
    ...(failure.metadata === undefined ? {} : { metadata: failure.metadata })
  };
}

function buildHandoffMetadata(handoff: AuditHandoffSummary): AuditMetadata {
  return {
    handoffId: handoff.handoffId,
    sourceAgent: handoff.sourceAgent,
    status: handoff.status,
    summary: handoff.summary,
    targetAgent: handoff.targetAgent,
    ...(handoff.artifactIds === undefined ? {} : { artifactIds: handoff.artifactIds }),
    ...(handoff.detail === undefined ? {} : { detail: handoff.detail }),
    ...(handoff.executionId === undefined ? {} : { executionId: handoff.executionId }),
    ...(handoff.metadata === undefined ? {} : { metadata: handoff.metadata }),
    ...(handoff.planRunId === undefined ? {} : { planRunId: handoff.planRunId }),
    ...(handoff.planStepId === undefined ? {} : { planStepId: handoff.planStepId }),
    ...(handoff.workItemId === undefined ? {} : { workItemId: handoff.workItemId })
  };
}

function parseFlagPairs(rawArgs: string[]): Record<string, string[]> {
  const parsed: Record<string, string[]> = {};

  for (let index = 0; index < rawArgs.length; index += 1) {
    const key = rawArgs[index];

    if (key?.startsWith("--") !== true) {
      throw new Error("Arguments must be passed as --name value pairs.");
    }

    const value = rawArgs[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value after ${key}`);
    }

    parsed[key] = [...(parsed[key] ?? []), value];
    index += 1;
  }

  return parsed;
}

function readRequiredString(parsed: Record<string, string[]>, key: string): string {
  const value = parsed[key]?.at(-1);

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required argument ${key}`);
  }

  return value;
}

function readFailureSeverity(parsed: Record<string, string[]>): AuditFailureSeverity {
  const value = parsed["--severity"]?.at(-1) ?? "medium";

  if (value === "critical" || value === "high" || value === "low" || value === "medium") {
    return value;
  }

  throw new Error(`Unknown failure severity: ${value}`);
}

function readFailureStatus(parsed: Record<string, string[]>): AuditFailureStatus {
  const value = parsed["--status"]?.at(-1) ?? "open";

  if (value === "open" || value === "resolved") {
    return value;
  }

  throw new Error(`Unknown failure status: ${value}`);
}

function readHandoffStatus(parsed: Record<string, string[]>): AuditHandoffStatus {
  const value = parsed["--status"]?.at(-1) ?? "pending";

  if (value === "accepted" || value === "blocked" || value === "cancelled" || value === "completed" || value === "pending") {
    return value;
  }

  throw new Error(`Unknown handoff status: ${value}`);
}

function parseMetadataEntries(entries: string[]): AuditMetadata {
  return Object.fromEntries(
    entries.map((entry) => {
      const separatorIndex = entry.indexOf("=");

      if (separatorIndex <= 0) {
        throw new Error(`Metadata entries must use key=value form. Received "${entry}".`);
      }

      const key = entry.slice(0, separatorIndex);
      const rawValue = entry.slice(separatorIndex + 1);

      return [key, parseMetadataValue(rawValue)];
    })
  );
}

function parseMetadataValue(value: string): AuditMetadataValue {
  let parsed: AuditMetadataValue = value;

  if (value === "true") {
    parsed = true;
  }

  if (value === "false") {
    parsed = false;
  }

  if (value === "null") {
    parsed = null;
  }

  const numericValue = Number(value);

  if (!Number.isNaN(numericValue) && value.trim().length > 0) {
    parsed = numericValue;
  }

  return parsed;
}

async function loadWorkflowContext(workflow: string) {
  const runId = await getExistingRunId(workflow);
  const paths = await ensureAuditPaths(runId);
  const summary = (await readSummary(paths)) ?? createWorkflowSummary(runId, workflow);

  return {
    paths,
    runId,
    summary,
    workflow
  };
}

const COMMAND_HANDLERS: Record<CommandName, (parsed: Record<string, string[]>, context: WorkflowContext) => Promise<string>> = {
  artifact: async (parsed, context) => {
    const artifact = buildArtifactSummary(parsed);

    appendArtifactSummary(context.summary, artifact);
    await persistTypedRecord(context, {
      eventType: "artifact-recorded",
      metadata: buildArtifactMetadata(artifact),
      ...(artifact.executionId === undefined ? {} : { executionId: artifact.executionId })
    });
    return artifact.artifactId;
  },
  decision: async (parsed, context) => {
    const decision = buildDecisionSummary(parsed);

    appendDecisionSummary(context.summary, decision);
    await persistTypedRecord(context, {
      eventType: "decision-recorded",
      metadata: buildDecisionMetadata(decision),
      ...(decision.executionId === undefined ? {} : { executionId: decision.executionId })
    });
    return decision.decisionId;
  },
  failure: async (parsed, context) => {
    const failure = buildFailureSummary(parsed);

    appendFailureSummary(context.summary, failure);
    await persistTypedRecord(context, {
      eventType: "failure-recorded",
      metadata: buildFailureMetadata(failure),
      ...(failure.executionId === undefined ? {} : { executionId: failure.executionId })
    });
    return failure.failureId;
  },
  handoff: async (parsed, context) => {
    const handoff = buildHandoffSummary(parsed, context.summary);

    appendHandoffSummary(context.summary, handoff);
    await persistTypedRecord(context, {
      eventType: "handoff-recorded",
      metadata: buildHandoffMetadata(handoff),
      ...(handoff.executionId === undefined ? {} : { executionId: handoff.executionId }),
      ...(handoff.planRunId === undefined ? {} : { planRunId: handoff.planRunId }),
      ...(handoff.planStepId === undefined ? {} : { planStepId: handoff.planStepId }),
      ...(handoff.workItemId === undefined ? {} : { workItemId: handoff.workItemId })
    });
    return handoff.handoffId;
  }
};

async function persistTypedRecord(
  context: WorkflowContext,
  event: {
    eventType: "artifact-recorded" | "decision-recorded" | "failure-recorded" | "handoff-recorded";
    executionId?: string;
    metadata: AuditMetadata;
    planRunId?: string;
    planStepId?: string;
    workItemId?: string;
  }
): Promise<void> {
  await appendAuditEvent(
    context.paths,
    createEvent(context.runId, context.workflow, event.eventType, {
      ...getEventContextFields(context.summary),
      ...(event.executionId === undefined ? {} : { executionId: event.executionId }),
      ...(event.planRunId === undefined ? {} : { planRunId: event.planRunId }),
      ...(event.planStepId === undefined ? {} : { planStepId: event.planStepId }),
      ...(event.workItemId === undefined ? {} : { workItemId: event.workItemId }),
      metadata: event.metadata,
      status: context.summary.status
    })
  );
  await writeSummary(context.paths, context.summary);
}

function resolveOptionalContextField(
  parsed: Record<string, string[]>,
  flag: "--plan-run-id" | "--plan-step-id" | "--work-item-id",
  field: "planRunId" | "planStepId" | "workItemId",
  fallback: string | undefined
) {
  const value = parsed[flag] === undefined ? fallback : readRequiredString(parsed, flag);

  return value === undefined ? {} : { [field]: value };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
