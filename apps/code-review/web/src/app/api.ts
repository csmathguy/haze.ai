import type { CodeReviewWorkspace } from "@taxes/shared";
import { CodeReviewWorkspaceSchema } from "@taxes/shared";

interface CodeReviewWorkspaceResponse {
  workspace: CodeReviewWorkspace;
}

export async function fetchCodeReviewWorkspace(): Promise<CodeReviewWorkspace> {
  const response = await fetch("/api/code-review/workspace");

  if (!response.ok) {
    throw new Error(`Code review workspace request failed with ${response.status.toString()}.`);
  }

  const payload = (await response.json()) as CodeReviewWorkspaceResponse;

  try {
    return CodeReviewWorkspaceSchema.parse(payload.workspace);
  } catch {
    throw new Error("Code review workspace response was invalid.");
  }
}
