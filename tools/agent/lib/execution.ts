import { randomUUID } from "node:crypto";

import {
  appendAuditEvent,
  appendExecutionSummary,
  clearActiveExecution,
  createEvent,
  setActiveExecution,
  type ActiveExecutionRecord,
  type AuditEvent,
  type AuditExecutionKind,
  type AuditExecutionSummary,
  type AuditMetadata,
  type AuditPaths,
  type AuditSummary,
  type WorkflowStatus,
  writeSummary
} from "./audit.js";

export interface AuditRunContext {
  paths: AuditPaths;
  runId: string;
  summary: AuditSummary;
  workflow: string;
}

export interface StartExecutionInput {
  command?: string[];
  kind: AuditExecutionKind;
  metadata?: AuditMetadata;
  name: string;
  parentExecutionId?: string;
  step?: string;
}

export interface StartedExecution extends StartExecutionInput, ActiveExecutionRecord {}

export interface EndExecutionInput {
  command?: string[];
  error?: unknown;
  exitCode?: number;
  logFile?: string;
  metadata?: AuditMetadata;
  status: WorkflowStatus;
}

export async function startExecution(
  context: AuditRunContext,
  input: StartExecutionInput
): Promise<StartedExecution> {
  const startedAt = new Date().toISOString();
  const started: StartedExecution = {
    ...input,
    executionId: randomUUID(),
    startedAt
  };

  await appendAuditEvent(
    context.paths,
    createExecutionEvent(context, started, "execution-start", {
      ...(input.command === undefined ? {} : { command: input.command }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
      status: "running"
    })
  );
  await setActiveExecution(context.workflow, toActiveExecutionRecord(started));

  return started;
}

export async function endExecution(
  context: AuditRunContext,
  started: StartedExecution,
  input: EndExecutionInput
): Promise<AuditExecutionSummary> {
  const durationMs = Date.now() - Date.parse(started.startedAt);
  const execution = createExecutionSummary(started, input, durationMs);

  await appendAuditEvent(
    context.paths,
    createExecutionEvent(context, started, "execution-end", createExecutionEndFields(execution))
  );

  appendExecutionSummary(context.summary, execution);
  await writeSummary(context.paths, context.summary);
  await clearActiveExecution(context.workflow, started.executionId);

  return execution;
}

export async function runAuditedExecution<T>(
  context: AuditRunContext,
  input: StartExecutionInput,
  callback: (execution: StartedExecution) => Promise<T>
): Promise<T> {
  const started = await startExecution(context, input);

  try {
    const result = await callback(started);
    await endExecution(context, started, {
      status: "success"
    });
    return result;
  } catch (error) {
    await endExecution(context, started, {
      error,
      status: "failed"
    });
    throw error;
  }
}

function createExecutionEvent(
  context: AuditRunContext,
  started: StartedExecution,
  eventType: AuditEvent["eventType"],
  fields: Partial<AuditEvent>
): AuditEvent {
  return createEvent(context.runId, context.workflow, eventType, {
    executionId: started.executionId,
    executionKind: started.kind,
    executionName: started.name,
    ...(started.command === undefined ? {} : { command: started.command }),
    ...(started.parentExecutionId === undefined ? {} : { parentExecutionId: started.parentExecutionId }),
    ...(started.step === undefined ? {} : { step: started.step }),
    ...fields
  });
}

function mergeMetadata(base?: AuditMetadata, extra?: AuditMetadata): AuditMetadata | undefined {
  if (base === undefined && extra === undefined) {
    return undefined;
  }

  return {
    ...(base ?? {}),
    ...(extra ?? {})
  };
}

function createExecutionSummary(
  started: StartedExecution,
  input: EndExecutionInput,
  durationMs: number
): AuditExecutionSummary {
  const errorFields = toErrorFields(input.error);
  const mergedMetadata = mergeMetadata(started.metadata, input.metadata);
  const command = input.command ?? started.command;

  return {
    durationMs,
    executionId: started.executionId,
    kind: started.kind,
    name: started.name,
    startedAt: started.startedAt,
    status: input.status,
    ...(command === undefined ? {} : { command }),
    ...(mergedMetadata === undefined ? {} : { metadata: mergedMetadata }),
    ...(started.parentExecutionId === undefined ? {} : { parentExecutionId: started.parentExecutionId }),
    ...(started.step === undefined ? {} : { step: started.step }),
    ...(input.exitCode === undefined ? {} : { exitCode: input.exitCode }),
    ...(input.logFile === undefined ? {} : { logFile: input.logFile }),
    ...(errorFields.errorMessage === undefined ? {} : { errorMessage: errorFields.errorMessage }),
    ...(errorFields.errorName === undefined ? {} : { errorName: errorFields.errorName })
  };
}

function createExecutionEndFields(execution: AuditExecutionSummary): Partial<AuditEvent> {
  return {
    durationMs: execution.durationMs,
    status: execution.status,
    ...(execution.command === undefined ? {} : { command: execution.command }),
    ...(execution.errorMessage === undefined ? {} : { errorMessage: execution.errorMessage }),
    ...(execution.errorName === undefined ? {} : { errorName: execution.errorName }),
    ...(execution.exitCode === undefined ? {} : { exitCode: execution.exitCode }),
    ...(execution.logFile === undefined ? {} : { logFile: execution.logFile }),
    ...(execution.metadata === undefined ? {} : { metadata: execution.metadata })
  };
}

function toActiveExecutionRecord(started: StartedExecution): ActiveExecutionRecord {
  return {
    executionId: started.executionId,
    kind: started.kind,
    name: started.name,
    startedAt: started.startedAt,
    ...(started.command === undefined ? {} : { command: started.command }),
    ...(started.metadata === undefined ? {} : { metadata: started.metadata }),
    ...(started.parentExecutionId === undefined ? {} : { parentExecutionId: started.parentExecutionId }),
    ...(started.step === undefined ? {} : { step: started.step })
  };
}

function toErrorFields(error: unknown): Pick<AuditExecutionSummary, "errorMessage" | "errorName"> {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name
    };
  }

  if (error === undefined) {
    return {};
  }

  return {
    errorMessage: serializeUnknownError(error),
    errorName: "NonErrorThrown"
  };
}

function serializeUnknownError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "boolean" || typeof error === "number" || typeof error === "bigint") {
    return String(error);
  }

  if (error === null) {
    return "null";
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Non-stringifiable thrown value";
  }
}
