import cors from "@fastify/cors";
import Fastify from "fastify";

import { registerTaxesPlugin } from "@taxes/api";
import { registerAuditPlugin } from "@taxes/audit-api";
import { registerCodeReviewPlugin, type CodeReviewService } from "@taxes/code-review-api";
import { registerKnowledgePlugin } from "@taxes/knowledge-api";
import { registerPlanPlugin } from "@taxes/plan-api";
import { registerWorkflowPlugin } from "@taxes/workflow-api";

import {
  AUDIT_DATABASE_URL,
  GATEWAY_CORS_ORIGINS,
  KNOWLEDGE_DATABASE_URL,
  PLANNING_DATABASE_URL,
  REPOSITORY_DOCS_ROOT,
  TAXES_DATABASE_URL,
  WORKFLOW_DATABASE_URL
} from "./config.js";
import { registerWebhooksRoutes } from "./routes/webhooks.js";

export interface GatewayOptions {
  readonly auditDatabaseUrl?: string;
  readonly codeReviewService?: CodeReviewService;
  readonly githubWebhookSecret?: string;
  readonly knowledgeDatabaseUrl?: string;
  readonly knowledgeDocsRoot?: string;
  readonly planningDatabaseUrl?: string;
  readonly taxesDatabaseUrl?: string;
  readonly workflowDatabaseUrl?: string;
}

export async function buildGatewayApp(options: GatewayOptions = {}) {
  const auditDb = options.auditDatabaseUrl ?? AUDIT_DATABASE_URL;
  const knowledgeDb = options.knowledgeDatabaseUrl ?? KNOWLEDGE_DATABASE_URL;
  const planningDb = options.planningDatabaseUrl ?? PLANNING_DATABASE_URL;
  const taxesDb = options.taxesDatabaseUrl ?? TAXES_DATABASE_URL;
  const workflowDb = options.workflowDatabaseUrl ?? WORKFLOW_DATABASE_URL;
  const docsRoot = options.knowledgeDocsRoot ?? REPOSITORY_DOCS_ROOT;

  const app = Fastify({ logger: false });

  await app.register(cors, { origin: GATEWAY_CORS_ORIGINS });

  // Single health endpoint covers all domains.
  app.get("/api/health", () => ({ localOnly: true, service: "gateway", status: "ok" }));

  registerWebhooksRoutes(app, {
    databaseUrl: workflowDb,
    ...(options.githubWebhookSecret ? { githubWebhookSecret: options.githubWebhookSecret } : {})
  });
  await app.register(registerTaxesPlugin, { databaseUrl: taxesDb });
  await app.register(registerAuditPlugin, { databaseUrl: auditDb });
  await app.register(registerPlanPlugin, { databaseUrl: planningDb, workflowDatabaseUrl: workflowDb });
  await app.register(registerKnowledgePlugin, { databaseUrl: knowledgeDb, docsRoot });
  await app.register(registerCodeReviewPlugin, {
    auditDatabaseUrl: auditDb,
    ...(options.codeReviewService !== undefined ? { codeReviewService: options.codeReviewService } : {}),
    planningDatabaseUrl: planningDb
  });
  await app.register(registerWorkflowPlugin, { databaseUrl: workflowDb });

  return app;
}
