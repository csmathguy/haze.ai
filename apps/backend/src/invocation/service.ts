import { randomUUID } from "node:crypto";
import type { AuditSink } from "../audit.js";
import { InvocationProviderNotFoundError } from "./errors.js";
import { InvocationPolicyEvaluator } from "./policy.js";
import type {
  InvocationPolicy,
  InvocationProjectConfig,
  InvocationProvider,
  InvocationRequest,
  InvocationResult
} from "./types.js";

interface InvocationServiceOptions {
  audit: AuditSink;
  defaultProviderId: string;
  providers: InvocationProvider[];
  policy?: InvocationPolicy;
  projectConfigById?: Record<string, InvocationProjectConfig>;
}

export class InvocationService {
  private readonly audit: AuditSink;
  private readonly defaultProviderId: string;
  private readonly providersById: Map<string, InvocationProvider>;
  private readonly policyEvaluator: InvocationPolicyEvaluator;
  private readonly projectConfigById: Record<string, InvocationProjectConfig>;

  constructor(options: InvocationServiceOptions) {
    this.audit = options.audit;
    this.defaultProviderId = options.defaultProviderId;
    // Strategy registry keyed by provider id for runtime-selectable invocation backends.
    this.providersById = new Map(options.providers.map((provider) => [provider.id, provider]));
    this.policyEvaluator = new InvocationPolicyEvaluator(options.policy);
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

    this.policyEvaluator.enforce(model, tools);

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
}
