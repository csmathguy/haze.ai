export type GitHubMergeMethod = "merge" | "squash" | "rebase";

export interface GitHubPullRequestState {
  merged: boolean;
}

export interface GitHubMergePullRequestResult {
  merged: boolean;
}

export interface GitHubPullRequestService {
  getPullRequestState(input: {
    repository: string;
    pullRequestNumber: number;
    token: string;
  }): Promise<GitHubPullRequestState>;
  mergePullRequest(input: {
    repository: string;
    pullRequestNumber: number;
    token: string;
    mergeMethod: GitHubMergeMethod;
    commitTitle?: string;
  }): Promise<GitHubMergePullRequestResult>;
}

export class GitHubPullRequestApiService implements GitHubPullRequestService {
  async getPullRequestState(input: {
    repository: string;
    pullRequestNumber: number;
    token: string;
  }): Promise<GitHubPullRequestState> {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(input.repository).replace("%2F", "/")}/pulls/${input.pullRequestNumber}`,
      {
        headers: this.buildHeaders(input.token)
      }
    );

    if (!response.ok) {
      throw new Error(`github_pr_state_failed_${response.status}`);
    }

    const payload = (await response.json()) as { merged?: boolean };
    return {
      merged: payload.merged === true
    };
  }

  async mergePullRequest(input: {
    repository: string;
    pullRequestNumber: number;
    token: string;
    mergeMethod: GitHubMergeMethod;
    commitTitle?: string;
  }): Promise<GitHubMergePullRequestResult> {
    const response = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(input.repository).replace("%2F", "/")}/pulls/${input.pullRequestNumber}/merge`,
      {
        method: "PUT",
        headers: {
          ...this.buildHeaders(input.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          merge_method: input.mergeMethod,
          commit_title: input.commitTitle
        })
      }
    );

    if (response.status === 200 || response.status === 201) {
      const payload = (await response.json()) as { merged?: boolean };
      return { merged: payload.merged === true };
    }

    if (response.status === 405 || response.status === 409 || response.status === 422) {
      return { merged: false };
    }

    throw new Error(`github_pr_merge_failed_${response.status}`);
  }

  private buildHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "haze-ai-task-workflow"
    };
  }
}

