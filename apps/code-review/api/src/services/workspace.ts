import type {
  CodeReviewPullRequestDetail,
  CodeReviewReviewActionRequest,
  CodeReviewReviewActionResult,
  CodeReviewWorkspace
} from "@taxes/shared";

import { CODE_REVIEW_CACHE_MAX_AGE_MS, CODE_REVIEW_CACHE_ROOT, CODE_REVIEW_WORKFLOW_DATABASE_URL } from "../config.js";
import { DirectAuditServiceGateway, type AuditWorkItemGateway } from "../adapters/audit-api.js";
import { GitHubCliPullRequestGateway, type GitHubPullRequestGateway } from "../adapters/github-cli.js";
import { DirectPlanningServiceGateway, type PlanningWorkItemGateway } from "../adapters/planning-api.js";
import { DirectWorkflowEventGateway, type WorkflowEventGateway } from "../adapters/workflow-events.js";
import { createFileCodeReviewCacheStore, type CodeReviewCacheStore } from "./pull-request-cache.js";
import { buildAgentReview } from "./agent-review.js";
import { toAuditEvidence, toPlanningWorkItem } from "./pull-request-evidence.js";
import { toPullRequestDetail, toPullRequestSummary, toRepository } from "./pull-request-review.js";
import { buildReviewBrief } from "./review-brief.js";

interface CacheEntry<TValue> {
  readonly cachedAt: string;
  readonly value: TValue;
}

export interface CodeReviewService {
  getPullRequestDetail(pullRequestNumber: number): Promise<CodeReviewPullRequestDetail>;
  getWorkspace(): Promise<CodeReviewWorkspace>;
  submitReviewAction(pullRequestNumber: number, request: CodeReviewReviewActionRequest): Promise<CodeReviewReviewActionResult>;
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
  readonly workflowDatabaseUrl?: string;
  readonly workflowEventGateway?: WorkflowEventGateway;
}

export function createCodeReviewService(options: CreateCodeReviewServiceOptions = {}): CodeReviewService {
  const cacheMaxAgeMs = options.cacheMaxAgeMs ?? CODE_REVIEW_CACHE_MAX_AGE_MS;
  const now = options.now ?? (() => new Date());
  const cacheStore = options.cacheStore ?? createFileCodeReviewCacheStore(CODE_REVIEW_CACHE_ROOT, now);
  const auditGateway = options.auditGateway ?? new DirectAuditServiceGateway(options.auditDatabaseUrl);
  const gateway = options.gateway ?? new GitHubCliPullRequestGateway();
  const planningGateway = options.planningGateway ?? new DirectPlanningServiceGateway(options.planningDatabaseUrl);
  const workflowEventGateway =
    options.workflowEventGateway ??
    new DirectWorkflowEventGateway(options.workflowDatabaseUrl ?? CODE_REVIEW_WORKFLOW_DATABASE_URL);

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
          const [repositoryResult, pullRequestsResult] = await Promise.allSettled([
            gateway.getRepository(),
            gateway.listPullRequests()
          ]);

          if (repositoryResult.status === "rejected") {
            throw repositoryResult.reason instanceof Error
              ? repositoryResult.reason
              : new Error("GitHub repository info could not be loaded.");
          }

          const normalizedRepository = toRepository(repositoryResult.value);
          const pullRequests = pullRequestsResult.status === "fulfilled" ? pullRequestsResult.value : [];
          const orderedPullRequests = [...pullRequests].sort(comparePullRequestsByUpdate);

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
      }),
    submitReviewAction: createSubmitReviewAction({
      auditGateway,
      cacheStore,
      gateway,
      now,
      planningGateway,
      workflowEventGateway
    })
  };
}

async function enrichPullRequestDetail(
  detail: CodeReviewPullRequestDetail,
  planningGateway: PlanningWorkItemGateway,
  auditGateway: AuditWorkItemGateway
): Promise<CodeReviewPullRequestDetail> {
  const evidenceWarnings: string[] = [];
  const enrichmentInputs = await loadDetailEnrichmentInputs(detail, planningGateway, auditGateway);
  const planningWorkItem =
    enrichmentInputs.planningResult === undefined
      ? undefined
      : resolvePlanningWorkItem(detail, enrichmentInputs.planningResult, evidenceWarnings);
  const auditEvidence =
    enrichmentInputs.workItemId === undefined || enrichmentInputs.auditResult === undefined
      ? undefined
      : resolveAuditEvidence(enrichmentInputs.workItemId, enrichmentInputs.auditResult, evidenceWarnings);
  const agentReview = buildAgentReview(
    {
      ...detail,
      ...(auditEvidence === undefined ? {} : { auditEvidence }),
      ...(planningWorkItem === undefined ? {} : { planningWorkItem })
    },
    detail.updatedAt
  );
  const enrichedDetail = {
    ...detail,
    ...(agentReview === undefined ? {} : { agentReview }),
    ...(auditEvidence === undefined ? {} : { auditEvidence }),
    ...(evidenceWarnings.length === 0 ? {} : { evidenceWarnings }),
    ...(planningWorkItem === undefined ? {} : { planningWorkItem })
  };

  return {
    ...enrichedDetail,
    reviewBrief: buildReviewBrief(enrichedDetail, detail.updatedAt)
  };
}

async function loadDetailEnrichmentInputs(
  detail: CodeReviewPullRequestDetail,
  planningGateway: PlanningWorkItemGateway,
  auditGateway: AuditWorkItemGateway
): Promise<{
  readonly auditResult?: PromiseSettledResult<Awaited<ReturnType<AuditWorkItemGateway["getWorkItemTimeline"]>>>;
  readonly planningResult?: PromiseSettledResult<Awaited<ReturnType<PlanningWorkItemGateway["getWorkItem"]>>>;
  readonly workItemId?: string;
}> {
  if (detail.linkedPlan === undefined) {
    return {};
  }

  const workItemId = detail.linkedPlan.workItemId;
  const [planningResult, auditResult] = await Promise.allSettled([
    planningGateway.getWorkItem(workItemId),
    auditGateway.getWorkItemTimeline(workItemId)
  ]);

  return {
    auditResult,
    planningResult,
    workItemId
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

function comparePullRequestsByUpdate(left: { updatedAt: string }, right: { updatedAt: string }): number {
  return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
}

function extractLinkedWorkItemId(detail: { body: string; headRefName: string }): string | undefined {
  const branchMatch = /\b(PLAN-\d+)\b/u.exec(detail.headRefName);

  if (branchMatch?.[1] !== undefined) {
    return branchMatch[1];
  }

  const bodyMatch = /\b(PLAN-\d+)\b/u.exec(detail.body);

  return bodyMatch?.[1];
}

function createSubmitReviewAction(options: {
  readonly auditGateway: AuditWorkItemGateway;
  readonly cacheStore: CodeReviewCacheStore;
  readonly gateway: GitHubPullRequestGateway;
  readonly now: () => Date;
  readonly planningGateway: PlanningWorkItemGateway;
  readonly workflowEventGateway: WorkflowEventGateway;
}): CodeReviewService["submitReviewAction"] {
  return async (pullRequestNumber, request) => {
    const normalizedComment = request.comment?.trim() ?? "";
    const [repository, currentPullRequest] = await Promise.all([options.gateway.getRepository(), options.gateway.getPullRequest(pullRequestNumber)]);
    const workItemId = extractLinkedWorkItemId(currentPullRequest);
    const repositoryRef = toRepository(repository);
    const workflowEvent =
      request.action === "merge"
        ? await submitMergeAction({
          currentPullRequest,
          gateway: options.gateway,
          pullRequestNumber,
          repository: repositoryRef,
          submittedAt: options.now().toISOString(),
          workflowEventGateway: options.workflowEventGateway,
          ...(workItemId === undefined ? {} : { workItemId })
        })
        : await submitReviewDecision({
          action: request.action,
          comment: normalizedComment,
          currentPullRequest,
          gateway: options.gateway,
          pullRequestNumber,
          repository: repositoryRef,
          submittedAt: options.now().toISOString(),
          workflowEventGateway: options.workflowEventGateway,
          ...(workItemId === undefined ? {} : { workItemId })
        });

    await refreshPullRequestCaches({
      auditGateway: options.auditGateway,
      cacheStore: options.cacheStore,
      gateway: options.gateway,
      planningGateway: options.planningGateway,
      pullRequestNumber
    }).catch(() => undefined);

    return {
      action: request.action,
      comment: normalizedComment,
      submittedAt: workflowEvent.submittedAt,
      workflowEventId: workflowEvent.eventId
    };
  };
}

async function submitReviewDecision(options: {
  readonly action: "approve" | "request-changes";
  readonly comment: string;
  readonly currentPullRequest: { readonly headRefOid: string };
  readonly gateway: GitHubPullRequestGateway;
  readonly pullRequestNumber: number;
  readonly repository: ReturnType<typeof toRepository>;
  readonly submittedAt: string;
  readonly workflowEventGateway: WorkflowEventGateway;
  readonly workItemId?: string;
}): Promise<{ readonly eventId: string; readonly submittedAt: string }> {
  const submittedReview = await options.gateway.submitPullRequestReview(options.pullRequestNumber, {
    action: options.action,
    comment: options.comment
  });
  const submittedAt = submittedReview.submitted_at ?? options.submittedAt;
  const workflowEvent = await options.workflowEventGateway.createCodeReviewReviewSubmittedEvent({
    action: options.action,
    comment: options.comment,
    headSha: options.currentPullRequest.headRefOid,
    pullRequestNumber: options.pullRequestNumber,
    repository: options.repository,
    submittedAt,
    ...(submittedReview.id === undefined ? {} : { reviewId: submittedReview.id }),
    ...(options.workItemId === undefined ? {} : { workItemId: options.workItemId })
  });

  return {
    eventId: workflowEvent.eventId,
    submittedAt
  };
}

async function submitMergeAction(options: {
  readonly currentPullRequest: { readonly headRefOid: string };
  readonly gateway: GitHubPullRequestGateway;
  readonly pullRequestNumber: number;
  readonly repository: ReturnType<typeof toRepository>;
  readonly submittedAt: string;
  readonly workflowEventGateway: WorkflowEventGateway;
  readonly workItemId?: string;
}): Promise<{ readonly eventId: string; readonly submittedAt: string }> {
  const mergeResult = await options.gateway.mergePullRequest(options.pullRequestNumber);

  if (!mergeResult.merged) {
    throw new Error(`GitHub did not merge pull request ${options.pullRequestNumber.toString()}.`);
  }

  const workflowEvent = await options.workflowEventGateway.createCodeReviewMergeSubmittedEvent({
    headSha: options.currentPullRequest.headRefOid,
    pullRequestNumber: options.pullRequestNumber,
    repository: options.repository,
    submittedAt: options.submittedAt,
    ...(options.workItemId === undefined ? {} : { workItemId: options.workItemId })
  });

  return {
    eventId: workflowEvent.eventId,
    submittedAt: options.submittedAt
  };
}

async function refreshPullRequestCaches(options: {
  readonly auditGateway: AuditWorkItemGateway;
  readonly cacheStore: CodeReviewCacheStore;
  readonly gateway: GitHubPullRequestGateway;
  readonly planningGateway: PlanningWorkItemGateway;
  readonly pullRequestNumber: number;
}): Promise<void> {
  const [repository, pullRequest, pullRequests] = await Promise.all([
    options.gateway.getRepository(),
    options.gateway.getPullRequest(options.pullRequestNumber),
    options.gateway.listPullRequests()
  ]);
  const normalizedRepository = toRepository(repository);
  const detail = await enrichPullRequestDetail(
    toPullRequestDetail(pullRequest, normalizedRepository),
    options.planningGateway,
    options.auditGateway
  );
  const orderedPullRequests = [...pullRequests].sort(comparePullRequestsByUpdate);

  await Promise.all([
    options.cacheStore.writePullRequestDetail(options.pullRequestNumber, detail),
    options.cacheStore.writeWorkspace({
      generatedAt: detail.updatedAt,
      localOnly: true,
      pullRequests: orderedPullRequests.map((entry) => toPullRequestSummary(entry)),
      purpose:
        "Review pull requests from this repository in a deterministic order that highlights value, changed boundaries, tests, validation, and merge readiness.",
      repository: normalizedRepository,
      showingRecentFallback: orderedPullRequests.every((entry) => entry.state !== "OPEN"),
      title: "Code Review Studio",
      trustStatement:
        "Human review remains the confirmation step. The app should explain the pull request and surface evidence before approval or merge."
    })
  ]);
}
