import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchCodeReviewPullRequest, fetchCodeReviewWorkspace, submitCodeReviewAction } from "./api.js";

interface MockFetchResponse {
  readonly json?: () => Promise<unknown>;
  readonly ok: boolean;
  readonly status?: number;
}

describe("code review app api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the code review workspace", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          workspace: {
            generatedAt: "2026-03-14T03:30:00.000Z",
            localOnly: true,
            pullRequests: [
              {
                author: {
                  isBot: false,
                  login: "csmathguy"
                },
                baseRefName: "main",
                headSha: "abcdef1234567890",
                headRefName: "feature/plan-53-local-env-runner",
                isDraft: false,
                number: 25,
                reviewDecision: "",
                state: "MERGED",
                title: "Add a main-checkout environment runner",
                updatedAt: "2026-03-14T02:59:48.000Z",
                url: "https://github.com/csmathguy/Taxes/pull/25"
              }
            ],
            purpose: "Help humans review pull requests.",
            repository: {
              name: "Taxes",
              owner: "csmathguy",
              url: "https://github.com/csmathguy/Taxes"
            },
            showingRecentFallback: true,
            title: "Code Review Studio",
            trustStatement: "Human review confirms trust."
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    const workspace = await fetchCodeReviewWorkspace();

    expect(fetchMock).toHaveBeenCalledWith("/api/code-review/workspace");
    expect(workspace.pullRequests[0]?.number).toBe(25);
  });

  it("loads a pull request detail payload", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          pullRequest: {
            author: {
              isBot: false,
              login: "csmathguy"
            },
            baseRefName: "main",
            body: "## Summary\n- Add a local runner",
            checks: [],
            headSha: "abcdef1234567890",
            headRefName: "feature/plan-53-local-env-runner",
            isDraft: false,
            lanes: [
              {
                evidence: ["Add a local runner"],
                files: [],
                highlights: ["workflow: 1 file"],
                id: "context",
                questions: ["What changed?"],
                reviewerGoal: "Orient the review.",
                summary: "Context lane.",
                title: "Context"
              }
            ],
            mergeStateStatus: "UNKNOWN",
            narrative: {
              reviewFocus: ["Confirm the workflow impact."],
              reviewOrder: ["Context"],
              risks: ["None beyond normal regression risk."],
              summaryBullets: ["Add a local runner"],
              validationCommands: [],
              valueSummary: "Add a local runner",
              whatChangedSections: []
            },
            number: 25,
            reviewDecision: "",
            state: "MERGED",
            stats: {
              commentCount: 0,
              fileCount: 1,
              reviewCount: 0,
              totalAdditions: 2,
              totalDeletions: 0
            },
            title: "Add a main-checkout environment runner",
            trustStatement: "Human review remains the final gate.",
            updatedAt: "2026-03-14T02:59:48.000Z",
            url: "https://github.com/csmathguy/Taxes/pull/25"
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    const pullRequest = await fetchCodeReviewPullRequest(25);

    expect(fetchMock).toHaveBeenCalledWith("/api/code-review/pull-requests/25");
    expect(pullRequest.number).toBe(25);
  });

  it("throws when the workspace payload is invalid", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          workspace: {
            generatedAt: "2026-03-14T03:30:00.000Z"
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCodeReviewWorkspace()).rejects.toThrow("Code review workspace response was invalid.");
  });

  it("submits an approve action for a pull request", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          result: {
            action: "approve",
            comment: "Looks good.",
            submittedAt: "2026-03-22T12:15:00.000Z",
            workflowEventId: "evt_123"
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await submitCodeReviewAction(25, "approve", "Looks good.");

    expect(fetchMock).toHaveBeenCalledWith("/api/code-review/pull-requests/25/review-actions", {
      body: JSON.stringify({
        action: "approve",
        comment: "Looks good."
      }),
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST"
    });
    expect(result.workflowEventId).toBe("evt_123");
  });
});
