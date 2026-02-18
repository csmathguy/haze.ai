import { randomUUID } from "node:crypto";
import type { AuditSink } from "./audit.js";

export type InvocationMode = "cli" | "api";

export interface InvocationRequest {
  prompt: string;
  taskId?: string;
  projectId?: string;
  model?: string;
  tools?: string[];
  traceId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface InvocationResult {
  providerId: string;
  mode: InvocationMode;
  output: string;
  model: string | null;
  tools: string[];
  traceId: string;
  requestId: string;
  raw?: unknown;
}

export interface InvocationProviderRequest {
  prompt: string;
  model: string | null;
  tools: string[];
  traceId: string;
  requestId: string;
  metadata: Record<string, unknown>;
}

export interface InvocationProviderResult {
  output: string;
  raw?: unknown;
}

export interface InvocationProvider {
  // Strategy pattern: each provider supplies interchangeable invocation behavior.
  readonly id: string;
  readonly mode: InvocationMode;
  invoke(request: InvocationProviderRequest): Promise<InvocationProviderResult>;
}

export interface InvocationPolicy {
  allowedTools?: string[];
  blockedTools?: string[];
  allowedModels?: string[];
  blockedModels?: string[];
}

export interface InvocationProjectConfig {
  providerId?: string;
  model?: string;
}

interface InvocationServiceOptions {
  audit: AuditSink;
  defaultProviderId: string;
  providers: InvocationProvider[];
  policy?: InvocationPolicy;
  projectConfigById?: Record<string, InvocationProjectConfig>;
}

export class InvocationPolicyError extends Error {
  constructor(
    message: string,
    public readonly reasonCode:
      | "TOOL_NOT_ALLOWED"
      | "TOOL_BLOCKED"
      | "MODEL_NOT_ALLOWED"
      | "MODEL_BLOCKED"
  ) {
    super(message);
  }
}

export class InvocationProviderNotFoundError extends Error {}

export class InvocationService {
  private readonly audit: AuditSink;
  private readonly defaultProviderId: string;
  private readonly providersById: Map<string, InvocationProvider>;
  private readonly policy: InvocationPolicy;
  private readonly projectConfigById: Record<string, InvocationProjectConfig>;

  constructor(options: InvocationServiceOptions) {
    this.audit = options.audit;
    this.defaultProviderId = options.defaultProviderId;
    // Strategy registry keyed by provider id for runtime-selectable invocation backends.
    this.providersById = new Map(options.providers.map((provider) => [provider.id, provider]));
    this.policy = options.policy ?? {};
    this.projectConfigById = options.projectConfigById ?? {};
  }

  async invoke(request: InvocationRequest): Promise<InvocationResult> {
    const traceId = request.traceId ?? randomUUID();
    const requestId = request.requestId ?? randomUUID();
    const projectConfig = request.projectId ? this.projectConfigById[request.projectId] : undefined;
    const providerId = projectConfig?.providerId ?? this.defaultProviderId;
    const model = request.model ?? projectConfig?.model ?? null;
    const tools = request.tools ?? [];
    const provider = this.providersById.get(providerId);

    if (!provider) {
      throw new InvocationProviderNotFoundError(`Invocation provider not found: ${providerId}`);
    }

    this.enforcePolicy(model, tools);

    const auditPayload = {
      providerId,
      mode: provider.mode,
      taskId: request.taskId ?? null,
      projectId: request.projectId ?? null,
      toolCount: tools.length,
      model
    };

    await this.audit.record({
      eventType: "invocation_requested",
      actor: "invocation_service",
      traceId,
      requestId,
      payload: auditPayload
    });

    try {
      const response = await provider.invoke({
        prompt: request.prompt,
        model,
        tools,
        traceId,
        requestId,
        metadata: request.metadata ?? {}
      });

      await this.audit.record({
        eventType: "invocation_completed",
        actor: "invocation_service",
        traceId,
        requestId,
        payload: auditPayload
      });

      return {
        providerId,
        mode: provider.mode,
        output: response.output,
        model,
        tools,
        traceId,
        requestId,
        raw: response.raw
      };
    } catch (error) {
      await this.audit.record({
        eventType: "invocation_failed",
        actor: "invocation_service",
        traceId,
        requestId,
        payload: {
          ...auditPayload,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      throw error;
    }
  }

  private enforcePolicy(model: string | null, tools: string[]): void {
    const blockedTools = new Set(this.policy.blockedTools ?? []);
    const allowedTools = this.policy.allowedTools ? new Set(this.policy.allowedTools) : null;
    const blockedModels = new Set(this.policy.blockedModels ?? []);
    const allowedModels = this.policy.allowedModels ? new Set(this.policy.allowedModels) : null;

    for (const tool of tools) {
      if (blockedTools.has(tool)) {
        throw new InvocationPolicyError(`Tool is blocked by policy: ${tool}`, "TOOL_BLOCKED");
      }
      if (allowedTools && !allowedTools.has(tool)) {
        throw new InvocationPolicyError(`Tool is not allow-listed: ${tool}`, "TOOL_NOT_ALLOWED");
      }
    }

    if (model) {
      if (blockedModels.has(model)) {
        throw new InvocationPolicyError(`Model is blocked by policy: ${model}`, "MODEL_BLOCKED");
      }
      if (allowedModels && !allowedModels.has(model)) {
        throw new InvocationPolicyError(`Model is not allow-listed: ${model}`, "MODEL_NOT_ALLOWED");
      }
    }
  }
}
