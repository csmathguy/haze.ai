import { InvocationPolicyError } from "./errors.js";
import type { InvocationPolicy } from "./types.js";

export class InvocationPolicyEvaluator {
  private readonly blockedTools: Set<string>;
  private readonly allowedTools: Set<string> | null;
  private readonly blockedModels: Set<string>;
  private readonly allowedModels: Set<string> | null;

  constructor(policy: InvocationPolicy = {}) {
    this.blockedTools = new Set(policy.blockedTools ?? []);
    this.allowedTools = policy.allowedTools ? new Set(policy.allowedTools) : null;
    this.blockedModels = new Set(policy.blockedModels ?? []);
    this.allowedModels = policy.allowedModels ? new Set(policy.allowedModels) : null;
  }

  enforce(model: string | null, tools: string[]): void {
    for (const tool of tools) {
      if (this.blockedTools.has(tool)) {
        throw new InvocationPolicyError(`Tool is blocked by policy: ${tool}`, "TOOL_BLOCKED");
      }
      if (this.allowedTools && !this.allowedTools.has(tool)) {
        throw new InvocationPolicyError(`Tool is not allow-listed: ${tool}`, "TOOL_NOT_ALLOWED");
      }
    }

    if (!model) {
      return;
    }

    if (this.blockedModels.has(model)) {
      throw new InvocationPolicyError(`Model is blocked by policy: ${model}`, "MODEL_BLOCKED");
    }
    if (this.allowedModels && !this.allowedModels.has(model)) {
      throw new InvocationPolicyError(`Model is not allow-listed: ${model}`, "MODEL_NOT_ALLOWED");
    }
  }
}
