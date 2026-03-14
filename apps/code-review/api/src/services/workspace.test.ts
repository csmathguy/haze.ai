import { mkdtemp, rm } from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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

function createGateway() {
  return {
    detailCalls: 0,
    detailError: undefined as Error | undefined,
    detailTitle: "Initial pull request title",
    listCalls: 0,
    workspaceTitle: "Initial pull request title",
    getPullRequest() {
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
            path: "apps/code-review/api/src/services/workspace.ts"
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
    getRepository() {
      return Promise.resolve({
        name: "Taxes",
        owner: "csmathguy",
        url: "https://github.com/csmathguy/Taxes"
      });
    },
    listPullRequests() {
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
