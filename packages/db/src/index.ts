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
