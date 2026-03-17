export {
  buildPrismaSqliteUrl,
  disconnectAllPrismaClients,
  disconnectPrismaClient,
  getPrismaClient,
  resolveDatabaseFilePath
} from "./client.js";
export type { PrismaClient } from "./client.js";

// Re-export Prisma namespace types from the generated client so consumers
// can import { Prisma } from "@taxes/db" instead of from "@prisma/client".
export { Prisma } from "./generated/prisma/client.js";

// Re-export workflow engine model types
export type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowStepRun,
  WorkflowEvent,
  WorkflowApproval,
  Agent,
  Skill,
  ExternalEventSource
} from "./generated/prisma/client.js";
