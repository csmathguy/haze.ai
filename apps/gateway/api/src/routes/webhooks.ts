import { createHmac, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@taxes/db";
import { z } from "zod";

import { getWorkflowPrismaClient } from "../db/client.js";

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

interface WebhookVerifyResult {
  valid: boolean;
  error?: string;
}

interface WebhookEventData {
  type: string;
  correlationId?: string;
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

function parseGitHubEvent(eventType: string, payload: unknown): WebhookEventData {
  let workflowEventType = "github.unknown";
  let correlationId: string | undefined;

  if (eventType === "pull_request") {
    const parsed = GitHubPullRequestPayloadSchema.safeParse(payload);
    if (parsed.success) {
      const { action, pull_request, repository } = parsed.data;
      workflowEventType = `github.pull_request.${action}`;

      if (pull_request && repository) {
        const owner = repository.owner.login;
        const repo = repository.name;
        const prNumber = String(pull_request.number);
        correlationId = `${owner}/${repo}#${prNumber}`;
      }
    }
  } else if (eventType === "push") {
    const parsed = GitHubPushPayloadSchema.safeParse(payload);
    if (parsed.success) {
      workflowEventType = "github.push";
      const { repository } = parsed.data;
      if (repository) {
        const owner = repository.owner.login;
        const repo = repository.name;
        correlationId = `${owner}/${repo}`;
      }
    }
  }

  return correlationId
    ? { type: workflowEventType, correlationId }
    : { type: workflowEventType };
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
