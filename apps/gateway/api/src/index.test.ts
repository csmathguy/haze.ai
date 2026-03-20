import { mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildPrismaSqliteUrl, disconnectAllPrismaClients } from "@taxes/db";

import { getWorkflowPrismaClient } from "./db/client.js";
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

  it("accepts GitHub webhook with valid signature and stores PR merged event", async () => {
    const ctx = await createTestGatewayContext("gateway-webhooks");
    contexts.push(ctx);

    const secret = "test-secret-123";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "merged",
      pull_request: {
        number: 42,
        title: "Add feature",
        body: "This PR adds a feature",
        merged: true
      },
      repository: {
        name: "Taxes",
        owner: { login: "csmathguy" }
      }
    };

    const rawBody = JSON.stringify(payload);
    const crypto = await import("node:crypto");
    const signature = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "x-github-event": "pull_request",
        "x-hub-signature-256": signature,
        "content-type": "application/json"
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(202);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const responseBody = response.json() as { id: string; type: string };
    expect(responseBody.id).toBeDefined();
    expect(responseBody.type).toBe("github.pull_request.merged");

    // Verify event was persisted
    const prisma = await getWorkflowPrismaClient(ctx.workflowDatabaseUrl);
    try {
      const event = await prisma.workflowEvent.findUnique({
        where: { id: responseBody.id }
      });
      expect(event).toBeDefined();
      expect(event?.type).toBe("github.pull_request.merged");
      expect(event?.source).toBe("github");
      expect(event?.correlationId).toBe("csmathguy/Taxes#42");
      expect(event?.payload).toBe(rawBody);
    } finally {
      await prisma.$disconnect();
    }

    await app.close();
  });

  it("rejects GitHub webhook with invalid signature (401)", async () => {
    const ctx = await createTestGatewayContext("gateway-webhooks-invalid");
    contexts.push(ctx);

    const secret = "test-secret-123";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "opened",
      pull_request: {
        number: 43,
        title: "Bad PR"
      },
      repository: {
        name: "Taxes",
        owner: { login: "csmathguy" }
      }
    };

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "x-github-event": "pull_request",
        "x-hub-signature-256": "sha256=invalid_signature_here",
        "content-type": "application/json"
      },
      payload: JSON.stringify(payload)
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toHaveProperty("error");

    await app.close();
  });

  it("stores unknown event types for forward compatibility", async () => {
    const ctx = await createTestGatewayContext("gateway-webhooks-unknown");
    contexts.push(ctx);

    const secret = "test-secret-456";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "created",
      data: { someKey: "someValue" }
    };

    const rawBody = JSON.stringify(payload);
    const crypto = await import("node:crypto");
    const signature = `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "x-github-event": "workflow_run",
        "x-hub-signature-256": signature,
        "content-type": "application/json"
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(202);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const responseBody = response.json() as { type: string };
    expect(responseBody.type).toBe("github.unknown");

    await app.close();
  });

  it("returns 401 when signature is missing and secret is configured", async () => {
    const ctx = await createTestGatewayContext("gateway-webhooks-no-sig");
    contexts.push(ctx);

    const secret = "test-secret-789";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = { action: "opened" };

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "x-github-event": "pull_request",
        "content-type": "application/json"
      },
      payload: JSON.stringify(payload)
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("accepts webhook without signature verification when secret is not configured", async () => {
    const ctx = await createTestGatewayContext("gateway-webhooks-no-secret");
    contexts.push(ctx);

    const app = await buildGatewayApp(ctx);

    const payload = {
      action: "closed",
      pull_request: {
        number: 44,
        title: "Closed PR"
      },
      repository: {
        name: "Taxes",
        owner: { login: "csmathguy" }
      }
    };

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/github",
      headers: {
        "x-github-event": "pull_request",
        "content-type": "application/json"
      },
      payload: JSON.stringify(payload)
    });

    expect(response.statusCode).toBe(202);

    await app.close();
  });
});
