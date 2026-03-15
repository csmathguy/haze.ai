import type { CodeReviewPullRequestDetail, CodeReviewWorkspace } from "@taxes/shared";

import { CODE_REVIEW_CACHE_MAX_AGE_MS, CODE_REVIEW_CACHE_ROOT } from "../config.js";
import { DirectAuditServiceGateway, type AuditWorkItemGateway } from "../adapters/audit-api.js";
import { GitHubCliPullRequestGateway, type GitHubPullRequestGateway } from "../adapters/github-cli.js";
import { DirectPlanningServiceGateway, type PlanningWorkItemGateway } from "../adapters/planning-api.js";
import { createFileCodeReviewCacheStore, type CodeReviewCacheStore } from "./pull-request-cache.js";
import { toAuditEvidence, toPlanningWorkItem } from "./pull-request-evidence.js";
import { toPullRequestDetail, toPullRequestSummary, toRepository } from "./pull-request-review.js";

interface CacheEntry<TValue> {
  readonly cachedAt: string;
  readonly value: TValue;
}

export interface CodeReviewService {
  getPullRequestDetail(pullRequestNumber: number): Promise<CodeReviewPullRequestDetail>;
  getWorkspace(): Promise<CodeReviewWorkspace>;
}

interface CreateCodeReviewServiceOptions {
  readonly auditDatabaseUrl?: string;
  readonly auditGateway?: AuditWorkItemGateway;
  readonly cacheMaxAgeMs?: number;
  readonly cacheStore?: CodeReviewCacheStore;
  readonly gateway?: GitHubPullRequestGateway;
  readonly now?: () => Date;
  readonly planningDatabaseUrl?: string;
  readonly planningGateway?: PlanningWorkItemGateway;
}

export function createCodeReviewService(options: CreateCodeReviewServiceOptions = {}): CodeReviewService {
  const cacheMaxAgeMs = options.cacheMaxAgeMs ?? CODE_REVIEW_CACHE_MAX_AGE_MS;
  const now = options.now ?? (() => new Date());
  const cacheStore = options.cacheStore ?? createFileCodeReviewCacheStore(CODE_REVIEW_CACHE_ROOT, now);
  const auditGateway = options.auditGateway ?? new DirectAuditServiceGateway(options.auditDatabaseUrl);
  const gateway = options.gateway ?? new GitHubCliPullRequestGateway();
  const planningGateway = options.planningGateway ?? new DirectPlanningServiceGateway(options.planningDatabaseUrl);

  return {
    getPullRequestDetail: async (pullRequestNumber) =>
      readThroughCache({
        cacheKey: pullRequestNumber,
        cacheReader: () => cacheStore.readPullRequestDetail(pullRequestNumber),
        cacheWriter: async (detail) => cacheStore.writePullRequestDetail(pullRequestNumber, detail),
        fetchFreshValue: async () => {
          const [repository, pullRequest] = await Promise.all([gateway.getRepository(), gateway.getPullRequest(pullRequestNumber)]);
          const detail = toPullRequestDetail(pullRequest, toRepository(repository));

          return enrichPullRequestDetail(detail, planningGateway, auditGateway);
        },
        isFresh: (entry) => isFreshEntry(entry, now, cacheMaxAgeMs)
      }),
    getWorkspace: async () =>
      readThroughCache({
        cacheKey: "workspace",
        cacheReader: () => cacheStore.readWorkspace(),
        cacheWriter: async (workspace) => cacheStore.writeWorkspace(workspace),
        fetchFreshValue: async () => {
          const [repository, pullRequests] = await Promise.all([gateway.getRepository(), gateway.listPullRequests()]);
          const normalizedRepository = toRepository(repository);
          const orderedPullRequests = [...pullRequests].sort(comparePullRequests);

          return {
            generatedAt: now().toISOString(),
            localOnly: true,
            pullRequests: orderedPullRequests.map((pullRequest) => toPullRequestSummary(pullRequest)),
            purpose:
              "Review pull requests from this repository in a deterministic order that highlights value, changed boundaries, tests, validation, and merge readiness.",
            repository: normalizedRepository,
            showingRecentFallback: orderedPullRequests.every((pullRequest) => pullRequest.state !== "OPEN"),
            title: "Code Review Studio",
            trustStatement:
              "Human review remains the confirmation step. The app should explain the pull request and surface evidence before approval or merge."
          };
        },
        isFresh: (entry) => isFreshEntry(entry, now, cacheMaxAgeMs)
      })
  };
}

async function enrichPullRequestDetail(
  detail: CodeReviewPullRequestDetail,
  planningGateway: PlanningWorkItemGateway,
  auditGateway: AuditWorkItemGateway
): Promise<CodeReviewPullRequestDetail> {
  if (detail.linkedPlan === undefined) {
    return detail;
  }

  const workItemId = detail.linkedPlan.workItemId;
  const [planningResult, auditResult] = await Promise.allSettled([
    planningGateway.getWorkItem(workItemId),
    auditGateway.getWorkItemTimeline(workItemId)
  ]);
  const evidenceWarnings: string[] = [];
  const planningWorkItem = resolvePlanningWorkItem(detail, planningResult, evidenceWarnings);
  const auditEvidence = resolveAuditEvidence(workItemId, auditResult, evidenceWarnings);

  return {
    ...detail,
    ...(auditEvidence === undefined ? {} : { auditEvidence }),
    ...(evidenceWarnings.length === 0 ? {} : { evidenceWarnings }),
    ...(planningWorkItem === undefined ? {} : { planningWorkItem })
  };
}

function resolvePlanningWorkItem(
  detail: CodeReviewPullRequestDetail,
  result: PromiseSettledResult<Awaited<ReturnType<PlanningWorkItemGateway["getWorkItem"]>>>,
  evidenceWarnings: string[]
) {
  if (result.status === "rejected") {
    evidenceWarnings.push(`Planning context for ${detail.linkedPlan?.workItemId ?? "the linked work item"} could not be loaded.`);
    return undefined;
  }

  if (result.value === null || detail.linkedPlan === undefined) {
    evidenceWarnings.push(`Linked planning work item ${detail.linkedPlan?.workItemId ?? "unknown"} was not found.`);
    return undefined;
  }

  return toPlanningWorkItem(detail.linkedPlan, result.value);
}

function resolveAuditEvidence(
  workItemId: string,
  result: PromiseSettledResult<Awaited<ReturnType<AuditWorkItemGateway["getWorkItemTimeline"]>>>,
  evidenceWarnings: string[]
) {
  if (result.status === "rejected") {
    evidenceWarnings.push(`Audit evidence for ${workItemId} could not be loaded.`);
    return undefined;
  }

  if (result.value === null) {
    evidenceWarnings.push(`No audit lineage has been recorded for ${workItemId} yet.`);
    return undefined;
  }

  return toAuditEvidence(result.value);
}

async function readThroughCache<TValue>(options: {
  readonly cacheKey: number | "workspace";
  readonly cacheReader: () => Promise<CacheEntry<TValue> | null>;
  readonly cacheWriter: (value: TValue) => Promise<void>;
  readonly fetchFreshValue: () => Promise<TValue>;
  readonly isFresh: (entry: CacheEntry<TValue>) => boolean;
}): Promise<TValue> {
  const cachedEntry = await options.cacheReader();

  if (cachedEntry !== null && options.isFresh(cachedEntry)) {
    return cachedEntry.value;
  }

  try {
    const freshValue = await options.fetchFreshValue();
    await options.cacheWriter(freshValue);

    return freshValue;
  } catch (error) {
    if (cachedEntry !== null) {
      return cachedEntry.value;
    }

    throw wrapCacheMissError(error, options.cacheKey);
  }
}

function isFreshEntry<TValue>(entry: CacheEntry<TValue>, now: () => Date, cacheMaxAgeMs: number): boolean {
  return now().getTime() - Date.parse(entry.cachedAt) <= cacheMaxAgeMs;
}

function wrapCacheMissError(error: unknown, cacheKey: number | "workspace"): Error {
  const target = cacheKey === "workspace" ? "workspace" : `pull request ${cacheKey.toString()}`;

  if (error instanceof Error) {
    return new Error(`Code review ${target} refresh failed: ${error.message}`);
  }

  return new Error("Code review refresh failed.");
}

function comparePullRequests(left: { state: string; updatedAt: string }, right: { state: string; updatedAt: string }): number {
  return getStateRank(left.state) - getStateRank(right.state) || Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function getStateRank(state: string): number {
  switch (state) {
    case "OPEN":
      return 0;
    case "MERGED":
      return 1;
    default:
      return 2;
  }
}
