import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const LIST_FIELDS = ["number", "title", "state", "isDraft", "headRefName", "headRefOid", "baseRefName", "author", "updatedAt", "url", "reviewDecision"].join(",");
const DETAIL_FIELDS = [
  "number",
  "title",
  "body",
  "state",
  "isDraft",
  "headRefName",
  "headRefOid",
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
  readonly headRefOid: string;
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
  readonly patch?: string;
  readonly path: string;
  readonly status: "added" | "copied" | "deleted" | "modified" | "renamed" | "unknown";
}

interface GitHubPullRequestApiFile {
  readonly additions: number;
  readonly deletions: number;
  readonly filename: string;
  readonly patch?: string;
  readonly status?: string;
}

export interface GitHubPullRequestReview {
  readonly author: GitHubPullRequestActor;
  readonly body?: string;
  readonly id?: number;
  readonly state?: string;
  readonly submitted_at?: string;
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
  mergePullRequest(pullRequestNumber: number): Promise<{ readonly merged: boolean }>;
  submitPullRequestReview(
    pullRequestNumber: number,
    input: { readonly action: "approve" | "request-changes"; readonly comment: string }
  ): Promise<GitHubPullRequestReview>;
}

export class GitHubCliPullRequestGateway implements GitHubPullRequestGateway {
  private repositoryPromise?: Promise<GitHubRepositoryRef>;

  async listPullRequests(): Promise<GitHubPullRequestListEntry[]> {
    return this.runJson<GitHubPullRequestListEntry[]>(["pr", "list", "--state", "all", "--limit", "12", "--json", LIST_FIELDS]);
  }

  async getPullRequest(pullRequestNumber: number): Promise<GitHubPullRequestDetail> {
    const [detail, repository] = await Promise.all([
      this.runJson<GitHubPullRequestDetail>(["pr", "view", pullRequestNumber.toString(), "--json", DETAIL_FIELDS]),
      this.getRepository()
    ]);
    const diffFiles = await this.runJson<GitHubPullRequestApiFile[]>([
      "api",
      `repos/${repository.owner}/${repository.name}/pulls/${pullRequestNumber.toString()}/files?per_page=100`,
      "--header",
      "Accept: application/vnd.github+json"
    ]);

    return {
      ...detail,
      files: mergePullRequestFiles(detail.files, diffFiles)
    };
  }

  async getRepository(): Promise<GitHubRepositoryRef> {
    this.repositoryPromise ??= this.loadRepository();

    return this.repositoryPromise;
  }

  async submitPullRequestReview(
    pullRequestNumber: number,
    input: { readonly action: "approve" | "request-changes"; readonly comment: string }
  ): Promise<GitHubPullRequestReview> {
    const repository = await this.getRepository();

    return this.runJson<GitHubPullRequestReview>([
      "api",
      "--method",
      "POST",
      `repos/${repository.owner}/${repository.name}/pulls/${pullRequestNumber.toString()}/reviews`,
      "--header",
      "Accept: application/vnd.github+json",
      "--field",
      `event=${toGitHubReviewEvent(input.action)}`,
      "--field",
      `body=${input.comment}`
    ]);
  }

  async mergePullRequest(pullRequestNumber: number): Promise<{ readonly merged: boolean }> {
    const repository = await this.getRepository();

    return this.runJson<{ readonly merged: boolean }>([
      "api",
      "--method",
      "PUT",
      `repos/${repository.owner}/${repository.name}/pulls/${pullRequestNumber.toString()}/merge`,
      "--header",
      "Accept: application/vnd.github+json",
      "--field",
      "merge_method=merge"
    ]);
  }

  private async loadRepository(): Promise<GitHubRepositoryRef> {
    const remoteUrl = (await this.runText(["git", "remote", "get-url", "origin"])).trim();
    return parseGitHubRepositoryFromRemoteUrl(remoteUrl);
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

function mergePullRequestFiles(files: GitHubPullRequestFile[], diffFiles: GitHubPullRequestApiFile[]): GitHubPullRequestFile[] {
  const diffFilesByPath = new Map(diffFiles.map((file) => [normalizePath(file.filename), file]));

  return files.map((file) => {
    const normalizedPath = normalizePath(file.path);
    const diffFile = diffFilesByPath.get(normalizedPath);

    return {
      additions: file.additions,
      deletions: file.deletions,
      ...(diffFile?.patch === undefined ? {} : { patch: diffFile.patch }),
      path: normalizedPath,
      status: normalizeFileStatus(diffFile?.status)
    };
  });
}

function normalizeFileStatus(status: string | undefined): GitHubPullRequestFile["status"] {
  switch (status) {
    case undefined:
    case "added":
    case "copied":
    case "deleted":
    case "modified":
    case "renamed":
      return status ?? "unknown";
    default:
      return "unknown";
  }
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/");
}

function toGitHubReviewEvent(action: "approve" | "request-changes"): "APPROVE" | "REQUEST_CHANGES" {
  return action === "approve" ? "APPROVE" : "REQUEST_CHANGES";
}

export function parseGitHubRepositoryFromRemoteUrl(remoteUrl: string): GitHubRepositoryRef {
  const match = /github\.com[:/](?<owner>[^/]+)\/(?<repo>[^/]+?)(?:\.git)?$/u.exec(remoteUrl);

  if (match?.groups?.owner === undefined || match.groups.repo === undefined) {
    throw new Error(`Could not resolve the GitHub repository from remote URL "${remoteUrl}".`);
  }

  const owner = match.groups.owner;
  const repo = match.groups.repo;

  return {
    name: repo,
    owner,
    url: `https://github.com/${owner}/${repo}`
  };
}
