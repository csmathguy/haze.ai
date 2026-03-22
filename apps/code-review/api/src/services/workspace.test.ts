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
          headRefOid: "abcdef1234567890",
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
          headRefOid: "fedcba0987654321",
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
    expect(cachedDetail.reviewBrief?.sourceHeadSha).toBe("abcdef1234567890");
  });

  it("enriches linked pull request detail with planning and audit evidence", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    const service = createCodeReviewService({
      auditGateway: {
        getWorkItemTimeline: () =>
          Promise.resolve({
            artifacts: [
              {
                artifactId: "artifact-1",
                artifactType: "playwright-screenshot",
                label: "Checkout confirmation screenshot",
                metadata: {
                  suite: "browser"
                },
                path: "artifacts/e2e/checkout-confirmation.png",
                runId: "2026-03-14T161700-000-implementation-abcd1234",
                status: "created",
                timestamp: "2026-03-14T16:18:00.000Z"
              }
            ],
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
              artifactCount: 1,
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
        acceptanceCriteriaPreview: {
          items: ["PR detail renders plan context."],
          totalCount: 1
        },
        owner: "codex",
        status: "in-progress",
        taskPreview: {
          items: ["Add the planning endpoint", "Add the trust panel"],
          totalCount: 2
        },
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
        artifacts: [
          {
            category: "visual",
            kind: "screenshot",
            label: "Checkout confirmation screenshot",
            location: "artifacts/e2e/checkout-confirmation.png",
            status: "created",
            timestamp: "2026-03-14T16:18:00.000Z"
          }
        ],
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
    expect(detail.reviewBrief).toEqual(
      expect.objectContaining({
        sourceHeadSha: "abcdef1234567890"
      })
    );
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

  it("submits a review action and records a workflow event id", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    const service = createCodeReviewService({
      cacheStore: createFileCodeReviewCacheStore(cacheRoot),
      gateway,
      workflowEventGateway: {
        createCodeReviewMergeSubmittedEvent: () => Promise.resolve({ eventId: "evt_merge" }),
        createCodeReviewReviewSubmittedEvent: () => Promise.resolve({ eventId: "evt_123" })
      }
    });

    const result = await service.submitReviewAction(29, {
      action: "approve",
      comment: "Looks good."
    });

    expect(result).toEqual({
      action: "approve",
      comment: "Looks good.",
      submittedAt: "2026-03-22T12:15:00.000Z",
      workflowEventId: "evt_123"
    });
    expect(gateway.submittedReviews).toEqual([
      {
        action: "approve",
        comment: "Looks good.",
        pullRequestNumber: 29
      }
    ]);
  });

  it("submits a merge action and records a merge workflow event id", async () => {
    const cacheRoot = await createCacheRoot();
    const gateway = createGateway();
    const service = createCodeReviewService({
      cacheStore: createFileCodeReviewCacheStore(cacheRoot),
      gateway,
      now: () => new Date("2026-03-22T12:20:00.000Z"),
      workflowEventGateway: {
        createCodeReviewMergeSubmittedEvent: () => Promise.resolve({ eventId: "evt_merge" }),
        createCodeReviewReviewSubmittedEvent: () => Promise.resolve({ eventId: "evt_review" })
      }
    });

    const result = await service.submitReviewAction(29, {
      action: "merge"
    });

    expect(result).toEqual({
      action: "merge",
      comment: "",
      submittedAt: "2026-03-22T12:20:00.000Z",
      workflowEventId: "evt_merge"
    });
    expect(gateway.mergedPullRequests).toEqual([29]);
    expect(gateway.submittedReviews).toEqual([]);
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
  mergedPullRequests: number[];
  submittedReviews: { action: "approve" | "request-changes"; comment: string; pullRequestNumber: number }[];
  workspaceTitle: string;
} {
  return {
    detailCalls: 0,
    detailError: undefined as Error | undefined,
    detailTitle: "Initial pull request title",
    listCalls: 0,
    mergedPullRequests: [],
    submittedReviews: [],
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
        headRefOid: "abcdef1234567890",
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
          headRefOid: "abcdef1234567890",
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
    },
    mergePullRequest(pullRequestNumber: number): Promise<{ merged: true }> {
      this.mergedPullRequests.push(pullRequestNumber);

      return Promise.resolve({ merged: true });
    },
    submitPullRequestReview(
      pullRequestNumber: number,
      input: { readonly action: "approve" | "request-changes"; readonly comment: string }
    ): Promise<{ author: { is_bot: false; login: string; name: string }; id: number; state: string; submitted_at: string }> {
      this.submittedReviews.push({
        action: input.action,
        comment: input.comment,
        pullRequestNumber
      });

      return Promise.resolve({
        author: {
          is_bot: false,
          login: "csmathguy",
          name: "Zachary Hayes"
        },
        id: 92,
        state: input.action === "approve" ? "APPROVED" : "CHANGES_REQUESTED",
        submitted_at: "2026-03-22T12:15:00.000Z"
      });
    }
  };
}
