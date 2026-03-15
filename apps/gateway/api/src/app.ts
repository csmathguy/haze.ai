import cors from "@fastify/cors";
import Fastify from "fastify";

import { registerTaxesPlugin } from "@taxes/api";
import { registerAuditPlugin } from "@taxes/audit-api";
import { registerCodeReviewPlugin, type CodeReviewService } from "@taxes/code-review-api";
import { registerKnowledgePlugin } from "@taxes/knowledge-api";
import { registerPlanPlugin } from "@taxes/plan-api";

import {
  AUDIT_DATABASE_URL,
  GATEWAY_CORS_ORIGINS,
  KNOWLEDGE_DATABASE_URL,
  PLANNING_DATABASE_URL,
  REPOSITORY_DOCS_ROOT,
  TAXES_DATABASE_URL
} from "./config.js";

export interface GatewayOptions {
  readonly auditDatabaseUrl?: string;
  readonly codeReviewService?: CodeReviewService;
  readonly knowledgeDatabaseUrl?: string;
  readonly knowledgeDocsRoot?: string;
  readonly planningDatabaseUrl?: string;
  readonly taxesDatabaseUrl?: string;
}

export async function buildGatewayApp(options: GatewayOptions = {}) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: GATEWAY_CORS_ORIGINS });

  // Single health endpoint covers all domains.
  app.get("/api/health", () => ({ localOnly: true, service: "gateway", status: "ok" }));

  await app.register(registerTaxesPlugin, {
    databaseUrl: options.taxesDatabaseUrl ?? TAXES_DATABASE_URL
  });
  await app.register(registerAuditPlugin, {
    databaseUrl: options.auditDatabaseUrl ?? AUDIT_DATABASE_URL
  });
  await app.register(registerPlanPlugin, {
    databaseUrl: options.planningDatabaseUrl ?? PLANNING_DATABASE_URL
  });
  await app.register(registerKnowledgePlugin, {
    databaseUrl: options.knowledgeDatabaseUrl ?? KNOWLEDGE_DATABASE_URL,
    docsRoot: options.knowledgeDocsRoot ?? REPOSITORY_DOCS_ROOT
  });
  await app.register(registerCodeReviewPlugin, {
    auditDatabaseUrl: options.auditDatabaseUrl ?? AUDIT_DATABASE_URL,
    ...(options.codeReviewService !== undefined ? { codeReviewService: options.codeReviewService } : {}),
    planningDatabaseUrl: options.planningDatabaseUrl ?? PLANNING_DATABASE_URL
  });

  return app;
}
