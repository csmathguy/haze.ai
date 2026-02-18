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
