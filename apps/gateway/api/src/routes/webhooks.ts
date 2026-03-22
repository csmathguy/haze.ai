import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@taxes/db";
import { z } from "zod";

import { getWorkflowPrismaClient } from "../db/client.js";
import { GitHubCiFailedHandler } from "../services/github-ci-failed-handler.js";
import {
  GitHubPullRequestPayloadSchema,
  GitHubPushPayloadSchema,
  GitHubWorkflowRunPayloadSchema,
  GitHubCheckSuitePayloadSchema,
  GitHubCheckRunPayloadSchema
} from "./webhook-payload-schemas.js";

declare global {
  interface FastifyRequest {
    rawBody?: string;
  }
}

export interface WebhooksRouteOptions {
  readonly databaseUrl?: string;
  readonly githubWebhookSecret?: string;
}

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
  pullRequests: { number: number }[] | undefined
): number | undefined {
  if (!pullRequests || pullRequests.length === 0) {
    return undefined;
  }
  const firstPr = pullRequests[0];
  return firstPr?.number;
}

interface CiRunData {
  conclusion: string | null;
  status: string;
  jobName: string;
  pullRequests: { number: number }[] | undefined;
  htmlUrl: string | undefined;
  fallbackLogsId: string;
  correlationId: string;
}

/** Returns a github.ci.failed event if conclusion is failure+completed with a linked PR, else null. */
function buildCiFailedEvent(run: CiRunData): WebhookEventData | null {
  if (run.conclusion !== "failure" || run.status !== "completed") return null;
  const prNumber = extractPrNumber(run.pullRequests);
  if (!prNumber) return null;
  return {
    type: "github.ci.failed",
    correlationId: run.correlationId,
    ciFailureData: { prNumber, jobName: run.jobName, logsUrl: run.htmlUrl ?? run.fallbackLogsId }
  };
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

  const conflictEvent = tryBuildConflictEvent(action, pull_request, repository);
  if (conflictEvent !== null) {
    return conflictEvent;
  }

  const type = resolvePullRequestEventType(action, pull_request?.merged);

  if (pull_request && repository) {
    const { login: owner } = repository.owner;
    const correlationId = `${owner}/${repository.name}#${String(pull_request.number)}`;
    return { type, correlationId };
  }

  return { type };
}

function tryBuildConflictEvent(
  action: string,
  pullRequest: z.infer<typeof GitHubPullRequestPayloadSchema>["pull_request"],
  repository: z.infer<typeof GitHubPullRequestPayloadSchema>["repository"]
): WebhookEventData | null {
  if (
    pullRequest === undefined ||
    repository === undefined ||
    !["opened", "synchronize", "reopened"].includes(action) ||
    pullRequest.mergeable_state !== "dirty"
  ) {
    return null;
  }

  const prBody = pullRequest.body ?? "";
  if (!/PLAN-(\d+)/i.test(prBody)) {
    return null;
  }

  const { login: owner } = repository.owner;
  return {
    correlationId: `${owner}/${repository.name}#${String(pullRequest.number)}`,
    type: "github.pull_request.conflict"
  };
}

function resolvePullRequestEventType(action: string, merged: boolean | undefined): string {
  if (action === "closed" && merged === true) {
    return "github.pull_request.merged";
  }

  return `github.pull_request.${action}`;
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

  if (workflow_run && repository) {
    const correlationId = buildCiCorrelationId(
      repository.owner.login, repository.name,
      workflow_run.head_sha, workflow_run.head_branch
    );
    const ciEvent = buildCiFailedEvent({
      conclusion, status: workflow_run.status, jobName: workflow_run.name,
      pullRequests: workflow_run.pull_requests, htmlUrl: workflow_run.html_url,
      fallbackLogsId: `${repository.owner.login}/${repository.name}`, correlationId
    });
    if (ciEvent) return ciEvent;
    return { type: `github.workflow_run.${conclusion}`, correlationId };
  }

  return { type: `github.workflow_run.${conclusion}` };
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

  if (check_run && repository) {
    const correlationId = buildCiCorrelationId(
      repository.owner.login, repository.name,
      check_run.head_sha, check_run.head_branch
    );
    const ciEvent = buildCiFailedEvent({
      conclusion, status: check_run.status, jobName: check_run.name,
      pullRequests: check_run.pull_requests, htmlUrl: check_run.html_url,
      fallbackLogsId: `${repository.owner.login}/${repository.name}`, correlationId
    });
    if (ciEvent) return ciEvent;
    return { type: `github.check_run.${conclusion}`, correlationId };
  }

  return { type: `github.check_run.${conclusion}` };
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
