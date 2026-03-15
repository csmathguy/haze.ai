import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { buildPrismaSqliteUrl } from "@taxes/db";

export const GATEWAY_HOST = process.env.GATEWAY_HOST ?? "127.0.0.1";
export const GATEWAY_PORT = Number(process.env.GATEWAY_PORT ?? "3000");

export const GATEWAY_CORS_ORIGINS = [
  "http://localhost:5100", // shell (PLAN-95)
  "http://localhost:5173", // taxes/web
  "http://localhost:5174", // audit/web
  "http://localhost:5175", // plan/web
  "http://localhost:5177", // knowledge/web
  "http://localhost:5178", // code-review/web
  `http://${GATEWAY_HOST}:5100`,
  `http://${GATEWAY_HOST}:5173`,
  `http://${GATEWAY_HOST}:5174`,
  `http://${GATEWAY_HOST}:5175`,
  `http://${GATEWAY_HOST}:5177`,
  `http://${GATEWAY_HOST}:5178`
];

export const TAXES_DATABASE_URL =
  process.env.DATABASE_URL ?? "file:./data/sqlite/taxes.db";

export const PLANNING_DATABASE_URL =
  process.env.PLANNING_DATABASE_URL ??
  buildPrismaSqliteUrl(path.join(os.homedir(), ".taxes", "planning", "sqlite", "planning.db"));

export const AUDIT_DATABASE_URL =
  process.env.AUDIT_DATABASE_URL ??
  buildPrismaSqliteUrl(path.join(os.homedir(), ".taxes", "audit", "sqlite", "audit.db"));

export const KNOWLEDGE_DATABASE_URL =
  process.env.KNOWLEDGE_DATABASE_URL ??
  buildPrismaSqliteUrl(path.join(os.homedir(), ".taxes", "knowledge", "sqlite", "knowledge.db"));

export const REPOSITORY_DOCS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../docs"
);
