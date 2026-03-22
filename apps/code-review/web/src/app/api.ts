import type {
  CodeReviewPullRequestDetail,
  CodeReviewReviewAction,
  CodeReviewReviewActionResult,
  CodeReviewWorkspace
} from "@taxes/shared";
import {
  CodeReviewPullRequestDetailSchema,
  CodeReviewReviewActionResultSchema,
  CodeReviewWorkspaceSchema
} from "@taxes/shared";

interface CodeReviewPullRequestResponse {
  readonly pullRequest: CodeReviewPullRequestDetail;
}

interface CodeReviewReviewActionResponse {
  readonly result: CodeReviewReviewActionResult;
}

interface CodeReviewWorkspaceResponse {
  readonly workspace: CodeReviewWorkspace;
}

export async function fetchCodeReviewWorkspace(): Promise<CodeReviewWorkspace> {
  return parseResponse("/api/code-review/workspace", CodeReviewWorkspaceSchema, "Code review workspace response was invalid.", "workspace");
}

export async function fetchCodeReviewPullRequest(pullRequestNumber: number): Promise<CodeReviewPullRequestDetail> {
  return parseResponse(
    `/api/code-review/pull-requests/${pullRequestNumber.toString()}`,
    CodeReviewPullRequestDetailSchema,
    "Pull request detail response was invalid.",
    "pullRequest"
  );
}

export async function submitCodeReviewAction(
  pullRequestNumber: number,
  action: CodeReviewReviewAction,
  comment?: string
): Promise<CodeReviewReviewActionResult> {
  const response = await fetch(`/api/code-review/pull-requests/${pullRequestNumber.toString()}/review-actions`, {
    body: JSON.stringify(comment === undefined ? { action } : { action, comment }),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Code review request failed with ${response.status.toString()}.`);
  }

  const payload = (await response.json()) as CodeReviewReviewActionResponse;

  try {
    return CodeReviewReviewActionResultSchema.parse(payload.result);
  } catch {
    throw new Error("Review action response was invalid.");
  }
}

async function parseResponse<TSchemaOutput>(
  url: string,
  schema: { parse: (value: unknown) => TSchemaOutput },
  invalidMessage: string,
  field: "pullRequest" | "workspace"
): Promise<TSchemaOutput> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Code review request failed with ${response.status.toString()}.`);
  }

  const payload = (await response.json()) as CodeReviewWorkspaceResponse & CodeReviewPullRequestResponse & CodeReviewReviewActionResponse;

  try {
    return schema.parse(payload[field]);
  } catch {
    throw new Error(invalidMessage);
  }
}
