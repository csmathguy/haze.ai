import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LIST_FIELDS = ["number", "title", "state", "isDraft", "headRefName", "baseRefName", "author", "updatedAt", "url", "reviewDecision"].join(",");
const DETAIL_FIELDS = [
  "number",
  "title",
  "body",
  "state",
  "isDraft",
  "headRefName",
  "baseRefName",
  "author",
  "updatedAt",
  "url",
  "mergeStateStatus",
  "reviewDecision",
  "files",
  "reviews",
  "comments",
  "statusCheckRollup"
].join(",");

export interface GitHubPullRequestActor {
  readonly is_bot: boolean;
  readonly login: string;
  readonly name?: string;
}

export interface GitHubPullRequestListEntry {
  readonly author: GitHubPullRequestActor;
  readonly baseRefName: string;
  readonly headRefName: string;
  readonly isDraft: boolean;
  readonly number: number;
  readonly reviewDecision: string;
  readonly state: "CLOSED" | "MERGED" | "OPEN";
  readonly title: string;
  readonly updatedAt: string;
  readonly url: string;
}

export interface GitHubPullRequestFile {
  readonly additions: number;
  readonly deletions: number;
  readonly path: string;
}

export interface GitHubPullRequestReview {
  readonly author: GitHubPullRequestActor;
  readonly state?: string;
}

export interface GitHubStatusCheck {
  readonly completedAt?: string;
  readonly conclusion?: string;
  readonly detailsUrl?: string;
  readonly name: string;
  readonly startedAt?: string;
  readonly status: string;
  readonly workflowName?: string;
}

export interface GitHubPullRequestDetail extends GitHubPullRequestListEntry {
  readonly body: string;
  readonly comments: unknown[];
  readonly files: GitHubPullRequestFile[];
  readonly mergeStateStatus: string;
  readonly reviews: GitHubPullRequestReview[];
  readonly statusCheckRollup: GitHubStatusCheck[];
}

export interface GitHubRepositoryRef {
  readonly name: string;
  readonly owner: string;
  readonly url: string;
}

export interface GitHubPullRequestGateway {
  getPullRequest(pullRequestNumber: number): Promise<GitHubPullRequestDetail>;
  getRepository(): Promise<GitHubRepositoryRef>;
  listPullRequests(): Promise<GitHubPullRequestListEntry[]>;
}

export class GitHubCliPullRequestGateway implements GitHubPullRequestGateway {
  private repositoryPromise?: Promise<GitHubRepositoryRef>;

  async listPullRequests(): Promise<GitHubPullRequestListEntry[]> {
    return this.runJson<GitHubPullRequestListEntry[]>(["pr", "list", "--state", "all", "--limit", "12", "--json", LIST_FIELDS]);
  }

  async getPullRequest(pullRequestNumber: number): Promise<GitHubPullRequestDetail> {
    return this.runJson<GitHubPullRequestDetail>(["pr", "view", pullRequestNumber.toString(), "--json", DETAIL_FIELDS]);
  }

  async getRepository(): Promise<GitHubRepositoryRef> {
    this.repositoryPromise ??= this.loadRepository();

    return this.repositoryPromise;
  }

  private async loadRepository(): Promise<GitHubRepositoryRef> {
    const remoteUrl = (await this.runText(["git", "remote", "get-url", "origin"])).trim();
    const match = /github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/.]+)(?:\.git)?$/u.exec(remoteUrl);

    if (match?.groups?.owner === undefined || match.groups.repo === undefined) {
      throw new Error(`Could not resolve the GitHub repository from remote URL "${remoteUrl}".`);
    }

    const { owner, repo } = match.groups;

    return {
      name: repo,
      owner,
      url: `https://github.com/${owner}/${repo}`
    };
  }

  private async runJson<T>(args: string[]): Promise<T> {
    try {
      return JSON.parse(await this.runText(["gh", ...args])) as T;
    } catch (error) {
      throw toGitHubCliError(error);
    }
  }

  private async runText(command: string[]): Promise<string> {
    const [file, ...args] = command;

    if (file === undefined) {
      throw new Error("Missing command name for GitHub CLI execution.");
    }

    const result = await execFileAsync(file, args, {
      cwd: process.cwd(),
      maxBuffer: 8 * 1024 * 1024
    });

    return result.stdout;
  }
}

function toGitHubCliError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("GitHub CLI request failed.");
  }

  const message = error.message.includes("gh") ? error.message : `GitHub CLI request failed: ${error.message}`;

  return new Error(message);
}
