import type { CodeReviewWorkspace } from "@taxes/shared";
import { CodeReviewWorkspaceSchema } from "@taxes/shared";

const CODE_REVIEW_WORKSPACE: CodeReviewWorkspace = CodeReviewWorkspaceSchema.parse({
  freshnessStrategy: [
    "Refresh touched-path explanations whenever the pull request head SHA changes.",
    "Regenerate lane summaries when files, checks, or review comments change.",
    "Record the source commit and retrieval time beside every PR-derived explanation."
  ],
  generatedAt: "2026-03-13T19:45:00.000Z",
  lanes: [
    {
      evidence: ["PR summary and changed-method inventory", "Ownership, architecture, and risk notes"],
      id: "context",
      questions: [
        "What user or workflow problem does this change solve?",
        "Which boundaries, contracts, or invariants should I verify first?"
      ],
      reviewerGoal: "Orient the reviewer before they dive into file-level detail.",
      summary: "Start with intent, affected seams, and likely hotspots so review order is deliberate.",
      title: "Context"
    },
    {
      evidence: ["Production diffs grouped by backend, web, shared contracts, and tooling", "Changed methods and file risk markers"],
      id: "implementation",
      questions: [
        "Does the implementation match the stated value and boundary rules?",
        "Are the riskiest changes small, composable, and easy to reason about?"
      ],
      reviewerGoal: "Make production-code review understandable without flattening everything into one file list.",
      summary: "Review the implementation after context, with deterministic grouping and hotspot emphasis.",
      title: "Implementation"
    },
    {
      evidence: ["Risk checklist and unresolved reviewer questions", "Architecture, privacy, and regression watchpoints"],
      id: "risks",
      questions: [
        "What could break even if the happy path looks correct?",
        "Did the change expand scope, weaken privacy, or blur architecture boundaries?"
      ],
      reviewerGoal: "Keep trust tied to explicit risk assessment instead of intuition alone.",
      summary: "Surface realistic failure modes and trust gaps before approval.",
      title: "Risks"
    },
    {
      evidence: ["Unit, integration, and end-to-end tests added or modified", "Coverage and validation notes linked to touched code"],
      id: "tests",
      questions: [
        "Do the tests prove the intended behavior rather than just the implementation detail?",
        "What important branches, regressions, or failure cases are still untested?"
      ],
      reviewerGoal: "Give tests a first-class lane so reviewers can validate behavior separately from implementation.",
      summary: "Isolate the test diff and keep proof of behavior visible during review.",
      title: "Tests"
    },
    {
      evidence: ["Lint, typecheck, architecture, and CI status summaries", "Checks mapped to the files and workflows they protect"],
      id: "validation",
      questions: [
        "Which validations passed, and what confidence do they actually provide?",
        "Are there missing checks for migrations, frontend behavior, or architecture drift?"
      ],
      reviewerGoal: "Treat validation output as evidence, not just a badge wall.",
      summary: "Bring automated evidence into the review without pretending automation replaces judgment.",
      title: "Validation"
    }
  ],
  localOnly: true,
  principles: [
    {
      description: "Guide the reviewer through a stable order: context, tests, implementation, validation, and risk confirmation.",
      title: "Reduce comprehension friction first"
    },
    {
      description: "Keep humans focused on understanding why the code exists and whether it should be trusted.",
      title: "Optimize for trust, not throughput theater"
    },
    {
      description: "Reward coverage and deliberate confirmation instead of raw speed or vanity scoring.",
      title: "Use motivation carefully"
    }
  ],
  purpose: "Help a human reviewer understand AI-created pull requests, confirm the value they add, and preserve trust in the codebase through guided review.",
  researchSources: [
    {
      authority: "official-docs",
      id: "github-pr-reviewing",
      note: "GitHub already emphasizes a review flow centered on changed files, comments, and approval state; the app should build on that instead of fighting it.",
      reviewedAt: "2026-03-13",
      title: "GitHub Docs: Reviewing proposed changes in a pull request",
      url: "https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests/reviewing-proposed-changes-in-a-pull-request"
    },
    {
      authority: "official-docs",
      id: "github-pr-files-api",
      note: "The MVP can fetch changed files and diff metadata directly from the GitHub REST API without introducing third-party middleware.",
      reviewedAt: "2026-03-13",
      title: "GitHub REST API: List pull requests files",
      url: "https://docs.github.com/en/rest/pulls/pulls#list-pull-requests-files"
    },
    {
      authority: "peer-reviewed",
      id: "modern-code-review",
      note: "Modern code review is not only defect finding; knowledge transfer and shared understanding are core outcomes.",
      reviewedAt: "2026-03-13",
      title: "Expectations, Outcomes, and Challenges of Modern Code Review",
      url: "https://www.microsoft.com/en-us/research/publication/expectations-outcomes-and-challenges-of-modern-code-review/"
    },
    {
      authority: "industry-practice",
      id: "google-reviewer-guide",
      note: "Review quality improves when reviewers have a clear starting point, manageable scope, and explicit risk framing.",
      reviewedAt: "2026-03-13",
      title: "Google Engineering Practices: Reviewer guide",
      url: "https://google.github.io/eng-practices/review/reviewer/"
    },
    {
      authority: "peer-reviewed",
      id: "retrieval-practice",
      note: "Active recall and explanation are stronger for durable understanding than passive rereading, which supports interactive walkthrough checkpoints.",
      reviewedAt: "2026-03-13",
      title: "Retrieval Practice Produces More Learning than Elaborative Studying with Concept Mapping",
      url: "https://www.science.org/doi/10.1126/science.1199327"
    }
  ],
  roadmap: [
    {
      dependencies: ["Planning project and shared contracts"],
      id: "workspace-mvp",
      outcome: "A local-first app exists with review lanes, roadmap context, and a trust-focused UX shell.",
      stage: "mvp",
      summary: "Scaffold the API and web shells around a typed review workspace so the product can evolve in code and not only in planning notes.",
      title: "Review workspace scaffold"
    },
    {
      dependencies: ["GitHub authentication contract", "Local cache policy"],
      id: "github-intake",
      outcome: "The app can fetch PR files, review comments, and review state directly from GitHub with minimal retained data.",
      stage: "mvp",
      summary: "Add GitHub PR ingestion so the scaffold can render real pull requests.",
      title: "GitHub PR intake"
    },
    {
      dependencies: ["GitHub PR intake", "Deterministic path classification rules"],
      id: "laneing",
      outcome: "Reviewers can move through tests, implementation, risks, and validation without relying on raw file order.",
      stage: "mvp",
      summary: "Turn the diff into review lanes with a stable review sequence and clear hotspots.",
      title: "Sectioned review lanes"
    },
    {
      dependencies: ["Laneing", "Repository context index"],
      id: "walkthrough",
      outcome: "Reviewers can follow a guided narrative and record trust confirmations or concerns as they go.",
      stage: "next",
      summary: "Add an interactive walkthrough that explains why each review section matters and what to inspect.",
      title: "Interactive walkthrough"
    },
    {
      dependencies: ["Repository indexing pipeline", "Workflow or PR event hooks"],
      id: "freshness",
      outcome: "Explanations and module summaries can be refreshed when the repository or PR changes.",
      stage: "next",
      summary: "Prevent stale explanations by making freshness a first-class part of the product.",
      title: "Freshness and repository context sync"
    },
    {
      dependencies: ["Walkthrough checkpoints", "Quality outcome telemetry"],
      id: "motivation",
      outcome: "The app can encourage review completion without pushing speed-over-quality behavior.",
      stage: "later",
      summary: "Prototype lightweight progress and confidence signals instead of competitive leaderboards.",
      title: "Careful motivational mechanics"
    }
  ],
  title: "Code Review Studio",
  trustStatement: "Human review remains the confirmation step. The product should help people understand the change, validate its evidence, and decide whether the code deserves trust."
});

export function getCodeReviewWorkspace(): CodeReviewWorkspace {
  return CODE_REVIEW_WORKSPACE;
}
