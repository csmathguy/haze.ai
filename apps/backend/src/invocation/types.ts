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
