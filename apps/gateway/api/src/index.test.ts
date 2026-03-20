import { mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildPrismaSqliteUrl, disconnectAllPrismaClients } from "@taxes/db";

import { buildGatewayApp } from "./app.js";
import { applyPendingMigrations } from "./db/migrations.js";

interface TestGatewayContext {
  auditDatabaseUrl: string;
  cleanup(): Promise<void>;
  knowledgeDatabaseUrl: string;
  planningDatabaseUrl: string;
  rootDirectory: string;
  taxesDatabaseUrl: string;
  workflowDatabaseUrl: string;
}

async function createTestGatewayContext(prefix: string): Promise<TestGatewayContext> {
  const rootDirectory = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));

  const taxesDatabaseUrl = buildPrismaSqliteUrl(path.join(rootDirectory, "taxes.test.db"));
  const auditDatabaseUrl = buildPrismaSqliteUrl(path.join(rootDirectory, "audit.test.db"));
  const planningDatabaseUrl = buildPrismaSqliteUrl(path.join(rootDirectory, "planning.test.db"));
  const knowledgeDatabaseUrl = buildPrismaSqliteUrl(path.join(rootDirectory, "knowledge.test.db"));
  const workflowDatabaseUrl = buildPrismaSqliteUrl(path.join(rootDirectory, "workflow.test.db"));

  await Promise.all([
    applyPendingMigrations(taxesDatabaseUrl),
    applyPendingMigrations(auditDatabaseUrl),
    applyPendingMigrations(planningDatabaseUrl),
    applyPendingMigrations(knowledgeDatabaseUrl),
    applyPendingMigrations(workflowDatabaseUrl)
  ]);

  return {
    auditDatabaseUrl,
    async cleanup() {
      await disconnectAllPrismaClients();
      await rm(rootDirectory, { force: true, recursive: true });
    },
    knowledgeDatabaseUrl,
    planningDatabaseUrl,
    rootDirectory,
    taxesDatabaseUrl,
    workflowDatabaseUrl
  };
}

describe("buildGatewayApp", () => {
  const contexts: TestGatewayContext[] = [];

  afterEach(async () => {
    await Promise.all(contexts.splice(0, contexts.length).map(async (ctx) => ctx.cleanup()));
  });

  it("exposes a local-only health endpoint", async () => {
    const ctx = await createTestGatewayContext("gateway-health");
    contexts.push(ctx);
    const app = await buildGatewayApp(ctx);
    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ localOnly: true, service: "gateway", status: "ok" });

    await app.close();
  });

  it("serves taxes workspace route", async () => {
    const ctx = await createTestGatewayContext("gateway-taxes");
    contexts.push(ctx);
    const app = await buildGatewayApp(ctx);
    const response = await app.inject({ method: "GET", url: "/api/workspace" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("snapshot");

    await app.close();
  });

  it("serves plan planning workspace route", async () => {
    const ctx = await createTestGatewayContext("gateway-plan");
    contexts.push(ctx);
    const app = await buildGatewayApp(ctx);
    const response = await app.inject({ method: "GET", url: "/api/planning/workspace" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("workspace");

    await app.close();
  });

  it("serves audit runs route", async () => {
    const ctx = await createTestGatewayContext("gateway-audit");
    contexts.push(ctx);
    const app = await buildGatewayApp(ctx);
    const response = await app.inject({ method: "GET", url: "/api/audit/runs" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("runs");

    await app.close();
  });

  it("serves knowledge workspace route", async () => {
    const ctx = await createTestGatewayContext("gateway-knowledge");
    contexts.push(ctx);
    const app = await buildGatewayApp(ctx);
    const response = await app.inject({ method: "GET", url: "/api/knowledge/workspace" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("workspace");

    await app.close();
  });

  it("serves code-review workspace route", async () => {
    const ctx = await createTestGatewayContext("gateway-code-review");
    contexts.push(ctx);
    const stubWorkspace = {
      generatedAt: new Date().toISOString(),
      localOnly: true as const,
      pullRequests: [],
      purpose: "test",
      repository: { name: "Taxes", owner: "csmathguy", url: "https://github.com/csmathguy/Taxes" },
      showingRecentFallback: false,
      title: "Code Review Studio",
      trustStatement: "test"
    };
    const app = await buildGatewayApp({
      ...ctx,
      codeReviewService: {
        getWorkspace: () => Promise.resolve(stubWorkspace),
        getPullRequestDetail: () => Promise.reject(new Error("not implemented"))
      }
    });
    const response = await app.inject({ method: "GET", url: "/api/code-review/workspace" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("workspace");

    await app.close();
  });

  it("serves workflow definitions route", async () => {
    const ctx = await createTestGatewayContext("gateway-workflow");
    contexts.push(ctx);
    const app = await buildGatewayApp(ctx);
    const response = await app.inject({ method: "GET", url: "/api/workflow/definitions" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("definitions");

    await app.close();
  });
});
