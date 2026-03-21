import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@taxes/db";
import { z } from "zod";

import { getWorkflowPrismaClient } from "../db/client.js";
import { GitHubCiFailedHandler } from "../services/github-ci-failed-handler.js";

declare global {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export interface WebhooksRouteOptions {
  readonly databaseUrl?: string;
  readonly githubWebhookSecret?: string;
}

const GitHubPullRequestPayloadSchema = z.object({
  action: z.string(),
  pull_request: z
    .object({
      number: z.number(),
      title: z.string(),
      body: z.string().optional(),
      merged: z.boolean().optional()
    })
    .optional(),
  repository: z
    .object({
      name: z.string(),
      owner: z.object({
        login: z.string()
      })
    })
    .optional()
});

const GitHubPushPayloadSchema = z.object({
  ref: z.string(),
  repository: z
    .object({
      name: z.string(),
      owner: z.object({
        login: z.string()
      })
    })
    .optional()
});

const GitHubWorkflowRunPayloadSchema = z.object({
  action: z.string(),
  workflow_run: z
    .object({
      id: z.number(),
      name: z.string(),
      head_branch: z.string().nullable(),
      head_sha: z.string(),
      conclusion: z.string().nullable(),
      status: z.string(),
      html_url: z.string().optional(),
      pull_requests: z
        .array(
          z.object({
            number: z.number()
          })
        )
        .optional()
    })
    .optional(),
  repository: z
    .object({
      name: z.string(),
      owner: z.object({
        login: z.string()
      })
    })
    .optional()
});

const GitHubCheckSuitePayloadSchema = z.object({
  action: z.string(),
  check_suite: z
    .object({
      id: z.number(),
      head_branch: z.string().nullable(),
      head_sha: z.string(),
      conclusion: z.string().nullable(),
      status: z.string()
    })
    .optional(),
  repository: z
    .object({
      name: z.string(),
      owner: z.object({
        login: z.string()
      })
    })
    .optional()
});

const GitHubCheckRunPayloadSchema = z.object({
  action: z.string(),
  check_run: z
    .object({
      id: z.number(),
      name: z.string(),
      head_branch: z.string().nullable(),
      head_sha: z.string(),
      conclusion: z.string().nullable(),
      status: z.string(),
      html_url: z.string().optional(),
      pull_requests: z
        .array(
          z.object({
            number: z.number()
          })
        )
        .optional()
    })
    .optional(),
  repository: z
    .object({
      name: z.string(),
      owner: z.object({
        login: z.string()
      })
    })
    .optional()
});

interface WebhookVerifyResult {
  valid: boolean;
  error?: string;
}

interface WebhookEventData {
  type: string;
  correlationId?: string;
  ciFailureData?: {
    prNumber: number;
    jobName: string;
    logsUrl: string;
  };
}

function extractPlanReferenceFromBranch(branchName: string | null | undefined): string | undefined {
  if (!branchName) {
    return undefined;
  }

  const pattern = /PLAN-(\d+)/i;
  const match = pattern.exec(branchName);
  if (!match) {
    return undefined;
  }

  const planNum = match[1];
  return planNum !== undefined ? `PLAN-${planNum}` : undefined;
}

function buildCiCorrelationId(owner: string, repo: string, sha: string, branch: string | null): string {
  const planRef = extractPlanReferenceFromBranch(branch);
  return planRef ?? `${owner}/${repo}@${sha}`;
}

function extractPrNumber(
  pullRequests: Array<{ number: number }> | undefined
): number | undefined {
  if (!pullRequests || pullRequests.length === 0) {
    return undefined;
  }
  const firstPr = pullRequests[0];
  return firstPr?.number;
}

function verifySignature(secret: string, signature: string | undefined, rawBody: string): WebhookVerifyResult {
  if (!signature) {
    return { valid: false, error: "Missing x-hub-signature-256 header" };
  }

  if (!rawBody) {
    return { valid: false, error: "Could not verify signature" };
  }

  const expectedSignature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  const lengthMatch = signatureBuffer.length === expectedBuffer.length;
  const timingSafeMatch =
    lengthMatch && timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!timingSafeMatch) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

function parsePullRequestEvent(payload: unknown): WebhookEventData {
  const parsed = GitHubPullRequestPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { type: "github.unknown" };
  }

  const { action, pull_request, repository } = parsed.data;
  const type = `github.pull_request.${action}`;

  if (pull_request && repository) {
    const { login: owner } = repository.owner;
    const correlationId = `${owner}/${repository.name}#${String(pull_request.number)}`;
    return { type, correlationId };
  }

  return { type };
}

function parsePushEvent(payload: unknown): WebhookEventData {
  const parsed = GitHubPushPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { type: "github.unknown" };
  }

  const { repository } = parsed.data;
  if (repository) {
    return { type: "github.push", correlationId: `${repository.owner.login}/${repository.name}` };
  }

  return { type: "github.push" };
}

function parseWorkflowRunEvent(payload: unknown): WebhookEventData {
  const parsed = GitHubWorkflowRunPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { type: "github.unknown" };
  }

  const { workflow_run, repository } = parsed.data;
  const conclusion = workflow_run?.conclusion ?? "unknown";
  const type = `github.workflow_run.${conclusion}`;

  if (workflow_run && repository) {
    const correlationId = buildCiCorrelationId(
      repository.owner.login, repository.name,
      workflow_run.head_sha, workflow_run.head_branch
    );

    // Check if this is a CI failure that should be emitted as github.ci.failed
    if (conclusion === "failure" && workflow_run.status === "completed") {
      const prNumber = extractPrNumber(workflow_run.pull_requests);
      const logsUrl = workflow_run.html_url ?? `${repository.owner.login}/${repository.name}`;
      if (prNumber && logsUrl) {
        return {
          type: "github.ci.failed",
          correlationId,
          ciFailureData: {
            prNumber,
            jobName: workflow_run.name,
            logsUrl
          }
        };
      }
    }

    return { type, correlationId };
  }

  return { type };
}

function parseCheckSuiteEvent(payload: unknown): WebhookEventData {
  const parsed = GitHubCheckSuitePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { type: "github.unknown" };
  }

  const { check_suite, repository } = parsed.data;
  const conclusion = check_suite?.conclusion ?? "unknown";
  const type = `github.check_suite.${conclusion}`;

  if (check_suite && repository) {
    const correlationId = buildCiCorrelationId(
      repository.owner.login, repository.name,
      check_suite.head_sha, check_suite.head_branch
    );
    return { type, correlationId };
  }

  return { type };
}

function parseCheckRunEvent(payload: unknown): WebhookEventData {
  const parsed = GitHubCheckRunPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { type: "github.unknown" };
  }

  const { check_run, repository } = parsed.data;
  const conclusion = check_run?.conclusion ?? "unknown";
  const type = `github.check_run.${conclusion}`;

  if (check_run && repository) {
    const correlationId = buildCiCorrelationId(
      repository.owner.login, repository.name,
      check_run.head_sha, check_run.head_branch
    );

    // Check if this is a CI failure that should be emitted as github.ci.failed
    if (conclusion === "failure" && check_run.status === "completed") {
      const prNumber = extractPrNumber(check_run.pull_requests);
      const logsUrl = check_run.html_url ?? `${repository.owner.login}/${repository.name}`;
      if (prNumber && logsUrl) {
        return {
          type: "github.ci.failed",
          correlationId,
          ciFailureData: {
            prNumber,
            jobName: check_run.name,
            logsUrl
          }
        };
      }
    }

    return { type, correlationId };
  }

  return { type };
}

function parseGitHubEvent(eventType: string, payload: unknown): WebhookEventData {
  if (eventType === "pull_request") return parsePullRequestEvent(payload);
  if (eventType === "push") return parsePushEvent(payload);
  if (eventType === "workflow_run") return parseWorkflowRunEvent(payload);
  if (eventType === "check_suite") return parseCheckSuiteEvent(payload);
  if (eventType === "check_run") return parseCheckRunEvent(payload);
  return { type: "github.unknown" };
}

async function handleWebhookPayload(
  prisma: PrismaClient,
  eventType: string | undefined,
  payload: unknown
): Promise<{ code: number; response: unknown }> {
  if (!eventType) {
    return { code: 400, response: { error: "Missing x-github-event header" } };
  }

  const eventData = parseGitHubEvent(eventType, payload);

  try {
    // Handle github.ci.failed events through the handler service
    if (eventData.type === "github.ci.failed" && eventData.ciFailureData) {
      const handler = new GitHubCiFailedHandler(prisma);
      await handler.handleEvent(
        eventData.ciFailureData.prNumber,
        eventData.ciFailureData.jobName,
        eventData.ciFailureData.logsUrl,
        JSON.stringify(payload)
      );
      return { code: 202, response: { type: eventData.type } };
    }

    // Standard webhook event persistence
    const event = await prisma.workflowEvent.create({
      data: {
        type: eventData.type,
        source: "github",
        ...(eventData.correlationId ? { correlationId: eventData.correlationId } : {}),
        payload: JSON.stringify(payload)
      }
    });

    return { code: 202, response: { id: event.id, type: eventData.type } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { code: 500, response: { error: message } };
  }
}

export function registerWebhooksRoutes(
  app: FastifyInstance,
  options: WebhooksRouteOptions = {}
): void {
  const secret = options.githubWebhookSecret ?? process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.warn(
      "GITHUB_WEBHOOK_SECRET not configured. GitHub webhook signature verification will be skipped. This is OK for local development."
    );
  }

  app.addContentTypeParser("application/json", async (request: FastifyRequest, payload: NodeJS.ReadableStream) => {
    const chunks: Buffer[] = [];
    for await (const chunk of payload) {
      chunks.push(chunk as Buffer);
    }
    const rawBody = Buffer.concat(chunks).toString("utf-8");
    (request as unknown as { rawBody?: string }).rawBody = rawBody;
    return JSON.parse(rawBody) as unknown;
  });

  app.post("/webhooks/github", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (secret) {
        const signature = request.headers["x-hub-signature-256"] as string | undefined;
        const rawBody = (request as unknown as { rawBody?: string }).rawBody ?? "";
        const verifyResult = verifySignature(secret, signature, rawBody);
        if (!verifyResult.valid) {
          reply.code(401);
          return { error: verifyResult.error ?? "Unknown error" };
        }
      }

      const eventType = request.headers["x-github-event"] as string | undefined;
      const payload = request.body;

      const prisma: PrismaClient = await getWorkflowPrismaClient(options.databaseUrl);
      try {
        const result = await handleWebhookPayload(prisma, eventType, payload);
        reply.code(result.code);
        return result.response;
      } finally {
        await prisma.$disconnect();
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        reply.code(400);
        return { error: "Invalid payload format", details: err.issues };
      }
      throw err;
    }
  });
}
