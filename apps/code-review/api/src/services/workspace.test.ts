import { mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { GitHubPullRequestDetail, GitHubPullRequestGateway, GitHubPullRequestListEntry, GitHubRepositoryRef } from "../adapters/github-cli.js";
import { createFileCodeReviewCacheStore } from "./pull-request-cache.js";
import { createCodeReviewService } from "./workspace.js";

const cacheDirectories: string[] = [];

describe("createCodeReviewService", () => {
  afterEach(async () => {
    await Promise.all(cacheDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
  });
  it("reuses a fresh cached workspace without refetching GitHub data", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    let now = new Date("2026-03-14T16:15:00.000Z");
    const service = createCodeReviewService({
      cacheStore: createFileCodeReviewCacheStore(cacheRoot, () => now),
      gateway,
      now: () => now
    });

    const firstWorkspace = await service.getWorkspace();
    now = new Date("2026-03-14T16:17:00.000Z");
    const secondWorkspace = await service.getWorkspace();

    expect(gateway.listCalls).toBe(1);
    expect(secondWorkspace.generatedAt).toBe(firstWorkspace.generatedAt);
    expect(secondWorkspace.pullRequests[0]?.number).toBe(29);
  });

  it("refreshes stale workspace cache entries", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    let now = new Date("2026-03-14T16:15:00.000Z");
    const service = createCodeReviewService({
      cacheMaxAgeMs: 5 * 60 * 1000,
      cacheStore: createFileCodeReviewCacheStore(cacheRoot, () => now),
      gateway,
      now: () => now
    });

    const firstWorkspace = await service.getWorkspace();
    gateway.workspaceTitle = "Updated cached workspace title";
    now = new Date("2026-03-14T16:25:00.000Z");
    const refreshedWorkspace = await service.getWorkspace();

    expect(gateway.listCalls).toBe(2);
    expect(refreshedWorkspace.generatedAt).not.toBe(firstWorkspace.generatedAt);
    expect(refreshedWorkspace.pullRequests[0]?.title).toBe("Updated cached workspace title");
  });

  it("orders workspace pull requests by most recent update instead of state grouping", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    gateway.listPullRequests = (): Promise<GitHubPullRequestListEntry[]> =>
      Promise.resolve([
        {
          author: {
            is_bot: false,
            login: "csmathguy",
            name: "Zachary Hayes"
          },
          baseRefName: "main",
          headRefName: "feature/older-open",
          isDraft: false,
          number: 29,
          reviewDecision: "",
          state: "OPEN" as const,
          title: "Older open pull request",
          updatedAt: "2026-03-14T16:15:00.000Z",
          url: "https://github.com/csmathguy/Taxes/pull/29"
        },
        {
          author: {
            is_bot: false,
            login: "csmathguy",
            name: "Zachary Hayes"
          },
          baseRefName: "main",
          headRefName: "feature/newer-merged",
          isDraft: false,
          number: 30,
          reviewDecision: "",
          state: "MERGED" as const,
          title: "Newer merged pull request",
          updatedAt: "2026-03-14T18:15:00.000Z",
          url: "https://github.com/csmathguy/Taxes/pull/30"
        }
      ]);
    const service = createCodeReviewService({
      cacheStore: createFileCodeReviewCacheStore(cacheRoot),
      gateway
    });

    const workspace = await service.getWorkspace();

    expect(workspace.pullRequests.map((pullRequest) => pullRequest.number)).toEqual([30, 29]);
  });

  it("falls back to stale cached pull request detail when GitHub refresh fails", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    let now = new Date("2026-03-14T16:15:00.000Z");
    const service = createCodeReviewService({
      cacheMaxAgeMs: 5 * 60 * 1000,
      cacheStore: createFileCodeReviewCacheStore(cacheRoot, () => now),
      gateway,
      now: () => now
    });

    const firstDetail = await service.getPullRequestDetail(29);
    gateway.detailError = new Error("gh auth token expired");
    gateway.detailTitle = "Updated title that should not be used";
    now = new Date("2026-03-14T16:25:00.000Z");
    const cachedDetail = await service.getPullRequestDetail(29);

    expect(gateway.detailCalls).toBe(2);
    expect(cachedDetail.title).toBe(firstDetail.title);
  });

  it("enriches linked pull request detail with planning and audit evidence", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    const service = createCodeReviewService({
      auditGateway: {
        getWorkItemTimeline: () =>
          Promise.resolve({
            artifacts: [],
            decisions: [],
            events: [],
            failures: [],
            handoffs: [],
            runs: [
              {
                actor: "codex",
                artifactCount: 0,
                decisionCount: 0,
                durationMs: 12000,
                executionCount: 4,
                failedExecutionCount: 0,
                failureCount: 0,
                handoffCount: 0,
                latestEventAt: "2026-03-14T16:18:00.000Z",
                runId: "2026-03-14T161700-000-implementation-abcd1234",
                startedAt: "2026-03-14T16:17:00.000Z",
                stats: {
                  byKind: {},
                  byStatus: {},
                  executionCount: 4,
                  failedExecutionCount: 0
                },
                status: "success",
                workflow: "implementation",
                worktreePath: "C:/Users/csmat/source/repos/Taxes/.worktrees/plan-29-pr-cache"
              }
            ],
            summary: {
              activeAgents: ["codex"],
              artifactCount: 0,
              decisionCount: 0,
              executionCount: 4,
              failureCount: 0,
              handoffCount: 0,
              latestEventAt: "2026-03-14T16:18:00.000Z",
              runCount: 1,
              workflows: ["implementation"]
            },
            workItemId: "PLAN-29"
          })
      },
      cacheStore: createFileCodeReviewCacheStore(cacheRoot),
      gateway,
      planningGateway: {
        getWorkItem: () =>
          Promise.resolve({
            acceptanceCriteria: [
              {
                id: "criterion-1",
                sequence: 0,
                status: "passed",
                title: "PR detail renders plan context."
              }
            ],
            auditWorkflowRunId: "2026-03-14T161700-000-implementation-abcd1234",
            blockedByWorkItemIds: [],
            createdAt: "2026-03-14T16:00:00.000Z",
            id: "PLAN-29",
            kind: "feature",
            owner: "codex",
            planRuns: [
              {
                createdAt: "2026-03-14T16:01:00.000Z",
                id: "plan-run-1",
                mode: "single-agent",
                status: "executing",
                steps: [
                  {
                    id: "step-1",
                    phase: "design",
                    sequence: 0,
                    status: "done",
                    title: "Design the contract"
                  },
                  {
                    id: "step-2",
                    phase: "implementation",
                    sequence: 1,
                    status: "in-progress",
                    title: "Implement the trust gate"
                  }
                ],
                summary: "Build the trust gate contract.",
                updatedAt: "2026-03-14T16:05:00.000Z"
              }
            ],
            priority: "high",
            projectKey: "code-review",
            status: "in-progress",
            summary: "Enrich code review with planning and audit evidence.",
            tasks: [
              {
                id: "task-1",
                sequence: 0,
                status: "done",
                title: "Add the planning endpoint"
              },
              {
                id: "task-2",
                sequence: 1,
                status: "todo",
                title: "Add the trust panel"
              }
            ],
            title: "Trust gate workspace with planning and audit evidence",
            updatedAt: "2026-03-14T16:06:00.000Z"
          })
      }
    });

    const detail = await service.getPullRequestDetail(29);

    expect(detail.planningWorkItem).toEqual(
      expect.objectContaining({
        owner: "codex",
        status: "in-progress",
        tasks: {
          completeCount: 1,
          pendingCount: 1,
          totalCount: 2
        },
        workItemId: "PLAN-29"
      })
    );
    expect(detail.auditEvidence).toEqual(
      expect.objectContaining({
        activeAgents: ["codex"],
        failureCount: 0,
        runCount: 1,
        workflows: ["implementation"],
        workItemId: "PLAN-29"
      })
    );
    expect(detail.agentReview).toEqual(
      expect.objectContaining({
        reviewer: "code-review-agent",
        status: "advisory"
      })
    );
    expect(detail.agentReview?.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "testing-missing-validation-commands",
          suggestedAction: "follow-up"
        }),
        expect.objectContaining({
          id: "testing-no-reported-checks",
          suggestedAction: "follow-up"
        })
      ])
    );
    expect(detail.evidenceWarnings).toBeUndefined();
  });

  it("raises a refresh error when GitHub fails and no cache exists yet", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    gateway.detailError = new Error("gh auth token expired");
    const service = createCodeReviewService({
      cacheStore: createFileCodeReviewCacheStore(cacheRoot),
      gateway
    });

    await expect(service.getPullRequestDetail(29)).rejects.toThrow("Code review pull request 29 refresh failed: gh auth token expired");
  });
});

async function createCacheRoot(): Promise<string> {
  const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "code-review-cache-"));
  cacheDirectories.push(cacheRoot);

  return cacheRoot;
}

function createGateway(): GitHubPullRequestGateway & {
  detailCalls: number;
  detailError: Error | undefined;
  detailTitle: string;
  listCalls: number;
  workspaceTitle: string;
} {
  return {
    detailCalls: 0,
    detailError: undefined as Error | undefined,
    detailTitle: "Initial pull request title",
    listCalls: 0,
    workspaceTitle: "Initial pull request title",
    getPullRequest(): Promise<GitHubPullRequestDetail> {
      this.detailCalls += 1;

      if (this.detailError !== undefined) {
        return Promise.reject(this.detailError);
      }

      return Promise.resolve({
        author: {
          is_bot: false,
          login: "csmathguy",
          name: "Zachary Hayes"
        },
        baseRefName: "main",
        body: "## Summary\n- Add cache support",
        comments: [],
        files: [
          {
            additions: 12,
            deletions: 1,
            path: "apps/code-review/api/src/services/workspace.ts",
            status: "modified" as const
          }
        ],
        headRefName: "feature/plan-29-pr-cache",
        isDraft: false,
        mergeStateStatus: "CLEAN",
        number: 29,
        reviewDecision: "",
        reviews: [],
        state: "OPEN" as const,
        statusCheckRollup: [],
        title: this.detailTitle,
        updatedAt: "2026-03-14T16:15:00.000Z",
        url: "https://github.com/csmathguy/Taxes/pull/29"
      });
    },
    getRepository(): Promise<GitHubRepositoryRef> {
      return Promise.resolve({
        name: "Taxes",
        owner: "csmathguy",
        url: "https://github.com/csmathguy/Taxes"
      });
    },
    listPullRequests(): Promise<GitHubPullRequestListEntry[]> {
      this.listCalls += 1;

      return Promise.resolve([
        {
          author: {
            is_bot: false,
            login: "csmathguy",
            name: "Zachary Hayes"
          },
          baseRefName: "main",
          headRefName: "feature/plan-29-pr-cache",
          isDraft: false,
          number: 29,
          reviewDecision: "",
          state: "OPEN" as const,
          title: this.workspaceTitle,
          updatedAt: "2026-03-14T16:15:00.000Z",
          url: "https://github.com/csmathguy/Taxes/pull/29"
        }
      ]);
    }
  };
}
