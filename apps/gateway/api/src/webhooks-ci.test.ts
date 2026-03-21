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

describe("GitHub CI webhook events", () => {
  const contexts: TestGatewayContext[] = [];

  afterEach(async () => {
    await Promise.all(contexts.splice(0, contexts.length).map(async (ctx) => ctx.cleanup()));
  });

  it("accepts workflow_run completed event with valid signature and stores CI event", async () => {
    const ctx = await createTestGatewayContext("gateway-workflow-run");
    contexts.push(ctx);

    const secret = "test-secret-ci";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "completed",
      workflow_run: {
        id: 123456,
        name: "CI",
        head_branch: "feature/plan-192",
        head_sha: "abc123def456",
        conclusion: "success",
        status: "completed"
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
        "x-github-event": "workflow_run",
        "x-hub-signature-256": signature,
        "content-type": "application/json"
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(202);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const responseBody = response.json() as { id: string; type: string };
    expect(responseBody.type).toBe("github.workflow_run.success");

    const prisma = await getWorkflowPrismaClient(ctx.workflowDatabaseUrl);
    try {
      const event = await prisma.workflowEvent.findUnique({
        where: { id: responseBody.id }
      });
      expect(event).toBeDefined();
      expect(event?.type).toBe("github.workflow_run.success");
      expect(event?.source).toBe("github");
      expect(event?.correlationId).toBe("PLAN-192");
    } finally {
      await prisma.$disconnect();
    }

    await app.close();
  });

  it("correlates workflow_run to commit SHA when branch doesn't match PLAN pattern", async () => {
    const ctx = await createTestGatewayContext("gateway-workflow-run-sha");
    contexts.push(ctx);

    const secret = "test-secret-ci-sha";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "completed",
      workflow_run: {
        id: 123457,
        name: "CI",
        head_branch: "main",
        head_sha: "abc123def457",
        conclusion: "failure",
        status: "completed"
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
        "x-github-event": "workflow_run",
        "x-hub-signature-256": signature,
        "content-type": "application/json"
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(202);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const responseBody = response.json() as { id: string; type: string };
    expect(responseBody.type).toBe("github.workflow_run.failure");

    const prisma = await getWorkflowPrismaClient(ctx.workflowDatabaseUrl);
    try {
      const event = await prisma.workflowEvent.findUnique({
        where: { id: responseBody.id }
      });
      expect(event).toBeDefined();
      expect(event?.correlationId).toBe("csmathguy/Taxes@abc123def457");
    } finally {
      await prisma.$disconnect();
    }

    await app.close();
  });

  it("accepts check_suite completed event with valid signature", async () => {
    const ctx = await createTestGatewayContext("gateway-check-suite");
    contexts.push(ctx);

    const secret = "test-secret-check-suite";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "completed",
      check_suite: {
        id: 234567,
        head_branch: "feature/plan-150",
        head_sha: "def456abc123",
        conclusion: "success",
        status: "completed"
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
        "x-github-event": "check_suite",
        "x-hub-signature-256": signature,
        "content-type": "application/json"
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(202);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const responseBody = response.json() as { id: string; type: string };
    expect(responseBody.type).toBe("github.check_suite.success");

    const prisma = await getWorkflowPrismaClient(ctx.workflowDatabaseUrl);
    try {
      const event = await prisma.workflowEvent.findUnique({
        where: { id: responseBody.id }
      });
      expect(event).toBeDefined();
      expect(event?.correlationId).toBe("PLAN-150");
    } finally {
      await prisma.$disconnect();
    }

    await app.close();
  });

  it("accepts check_run completed event with valid signature", async () => {
    const ctx = await createTestGatewayContext("gateway-check-run");
    contexts.push(ctx);

    const secret = "test-secret-check-run";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "completed",
      check_run: {
        id: 345678,
        name: "test-suite",
        head_branch: "feature/plan-199",
        head_sha: "ghi789jkl012",
        conclusion: "failure",
        status: "completed"
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
        "x-github-event": "check_run",
        "x-hub-signature-256": signature,
        "content-type": "application/json"
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(202);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const responseBody = response.json() as { id: string; type: string };
    expect(responseBody.type).toBe("github.check_run.failure");

    const prisma = await getWorkflowPrismaClient(ctx.workflowDatabaseUrl);
    try {
      const event = await prisma.workflowEvent.findUnique({
        where: { id: responseBody.id }
      });
      expect(event).toBeDefined();
      expect(event?.correlationId).toBe("PLAN-199");
    } finally {
      await prisma.$disconnect();
    }

    await app.close();
  });

  it("rejects CI event with invalid signature (401)", async () => {
    const ctx = await createTestGatewayContext("gateway-ci-invalid-sig");
    contexts.push(ctx);

    const secret = "test-secret-invalid";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "completed",
      workflow_run: {
        id: 999999,
        name: "CI",
        head_branch: "feature/plan-191",
        head_sha: "xyz999",
        conclusion: "success",
        status: "completed"
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
        "x-github-event": "workflow_run",
        "x-hub-signature-256": "sha256=invalid_signature",
        "content-type": "application/json"
      },
      payload: JSON.stringify(payload)
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toHaveProperty("error");

    await app.close();
  });

  it("handles CI event with null branch gracefully", async () => {
    const ctx = await createTestGatewayContext("gateway-ci-null-branch");
    contexts.push(ctx);

    const secret = "test-secret-null-branch";
    const app = await buildGatewayApp({ ...ctx, githubWebhookSecret: secret });

    const payload = {
      action: "completed",
      workflow_run: {
        id: 888888,
        name: "CI",
        head_branch: null,
        head_sha: "nullbranchsha",
        conclusion: "success",
        status: "completed"
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
        "x-github-event": "workflow_run",
        "x-hub-signature-256": signature,
        "content-type": "application/json"
      },
      payload: rawBody
    });

    expect(response.statusCode).toBe(202);
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const responseBody = response.json() as { id: string; type: string };
    expect(responseBody.type).toBe("github.workflow_run.success");

    const prisma = await getWorkflowPrismaClient(ctx.workflowDatabaseUrl);
    try {
      const event = await prisma.workflowEvent.findUnique({
        where: { id: responseBody.id }
      });
      expect(event).toBeDefined();
      expect(event?.correlationId).toBe("csmathguy/Taxes@nullbranchsha");
    } finally {
      await prisma.$disconnect();
    }

    await app.close();
  });
});
