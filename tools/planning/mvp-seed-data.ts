import type { CreateWorkItemInput, WorkItemStatus } from "@taxes/shared";

export interface SeedWorkItem extends CreateWorkItemInput {
  readonly status?: WorkItemStatus;
}

export const CODE_REVIEW_SEED_ITEMS: SeedWorkItem[] = [
  {
    acceptanceCriteria: [
      "The first code-review app can present a PR summary, deterministic review order, and sectioned review lanes.",
      "The MVP keeps humans focused on understanding code and validating value rather than replacing judgment.",
      "The UI makes test and validation evidence visible alongside the changed code."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    plan: {
      mode: "single-agent",
      steps: [
        "Confirm the MVP boundary from research and current repo constraints",
        "Scaffold local-only API and web surfaces for the review workspace",
        "Validate the shared contracts, tests, and project wiring"
      ],
      summary: "Stand up the first code-review product surface with a review-workspace shell."
    },
    priority: "high",
    projectKey: "code-review",
    status: "ready",
    summary: "Create the first local-only code-review app family so pull request review becomes a guided trust-building workflow instead of a raw diff dump.",
    tasks: [
      "Define the review-workspace contract and default review lanes",
      "Build a minimal API surface for the scaffolded workspace",
      "Build a web shell that highlights review lanes, roadmap, and trust goals"
    ],
    title: "Code review workspace MVP"
  },
  {
    acceptanceCriteria: [
      "The backend can fetch pull request metadata, changed files, review comments, and review states from GitHub.",
      "The adapter stores only the minimum local summary and diff data needed for review.",
      "Authentication stays local-first through environment variables or a local CLI bridge."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    priority: "high",
    projectKey: "code-review",
    summary: "Add a GitHub ingestion adapter so the review app can materialize a pull request into local review data without depending on hosted middleware.",
    tasks: [
      "Define the GitHub pull-request summary contract for local storage and rendering",
      "Implement the adapter for files, reviews, comments, and check summaries",
      "Add tests for pagination, auth failure handling, and minimal-data persistence"
    ],
    title: "GitHub PR ingestion adapter and minimal cache"
  },
  {
    acceptanceCriteria: [
      "Changed files are grouped into review lanes such as tests, implementation, validation, docs, and risks.",
      "Review order is deterministic and calls out higher-risk areas first.",
      "The tests lane can isolate unit, integration, and end-to-end additions from the rest of the diff."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    priority: "high",
    projectKey: "code-review",
    summary: "Turn raw pull request diffs into focused review lanes so reviewers can work section by section instead of scrolling a flat file list.",
    tasks: [
      "Design lane-classification rules from path, file type, and diff metadata",
      "Implement lane summaries and review ordering heuristics",
      "Add tests for mixed diffs that include production code, tests, and tooling changes"
    ],
    title: "Review lane classification for diff, tests, validation, and risks"
  },
  {
    acceptanceCriteria: [
      "The review app can show codebase context for touched areas without requiring reviewers to manually chase files.",
      "Explanations can be refreshed when the repository changes so summaries do not drift silently.",
      "Repository context stays local-only and avoids sending code to third-party hosted services."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    priority: "medium",
    projectKey: "code-review",
    summary: "Build a local repository context index so the app can explain changed modules and keep walkthroughs synchronized as the codebase evolves.",
    tasks: [
      "Define the freshness model for touched-path summaries and module explanations",
      "Implement a local indexing pipeline that can be refreshed on demand or from workflow events",
      "Expose explanation freshness state in the review UI"
    ],
    title: "Repository explanations and freshness indexing"
  },
  {
    acceptanceCriteria: [
      "The review flow guides a human through context, tests, implementation, validation, and trust confirmation checkpoints.",
      "The reviewer can record questions, concerns, and confirmations without leaving the review surface.",
      "The final output summarizes value added, remaining risk, and reviewer confidence."
    ],
    blockedByWorkItemIds: [],
    kind: "feature",
    priority: "medium",
    projectKey: "code-review",
    summary: "Add an interactive walkthrough so reviewers are led through the parts of a PR that matter for trust rather than relying on personal memory or file order luck.",
    tasks: [
      "Design the walkthrough state machine and checkpoint model",
      "Implement inline reviewer notes and unresolved-question capture",
      "Generate a final review summary focused on value, risk, and confidence"
    ],
    title: "Interactive walkthrough and trust confirmation flow"
  },
  {
    acceptanceCriteria: [
      "Motivational signals reward coverage and consistency rather than speed or vanity scores.",
      "The design avoids punishing careful reviewers or encouraging rubber-stamp behavior.",
      "The effects of any motivational features are measurable against review completion and defect-finding outcomes."
    ],
    blockedByWorkItemIds: [],
    kind: "spike",
    priority: "low",
    projectKey: "code-review",
    summary: "Research and prototype lightweight motivational patterns such as progress checkpoints, streaks, or coverage medals that improve review quality without distorting behavior.",
    tasks: [
      "Define safe gamification constraints grounded in research and reviewer trust goals",
      "Prototype a small set of non-competitive progress signals",
      "Measure whether the signals improve completion quality instead of review speed alone"
    ],
    title: "Gamified confidence checkpoints without vanity metrics"
  }
];
