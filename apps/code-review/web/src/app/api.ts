import type { CodeReviewPullRequestDetail, CodeReviewWorkspace } from "@taxes/shared";
import { CodeReviewPullRequestDetailSchema, CodeReviewWorkspaceSchema } from "@taxes/shared";

interface CodeReviewPullRequestResponse {
  readonly pullRequest: CodeReviewPullRequestDetail;
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

  const payload = (await response.json()) as CodeReviewWorkspaceResponse & CodeReviewPullRequestResponse;

  try {
    return schema.parse(payload[field]);
  } catch {
    throw new Error(invalidMessage);
  }
}
