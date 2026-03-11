import { describe, expect, it } from "vitest";

import { buildPullRequestDraft } from "./pull-request-draft.js";

describe("buildPullRequestDraft", () => {
  it("groups changed files into reviewable areas and risks", () => {
    const draft = buildPullRequestDraft([
      "prisma/schema.prisma",
      "packages/shared/src/questionnaire.ts",
      "apps/api/src/routes/questionnaire.ts",
      "apps/web/src/app/api.ts",
      "tools/agent/quality-gates.ts"
    ]);

    expect(draft.areas.map((area) => area.title)).toEqual([
      "Database and persistence",
      "Shared contracts",
      "API and backend workflow",
      "Web UI and client workflow",
      "Tooling and automation"
    ]);
    expect(draft.reviewOrder).toEqual([
      "Database and persistence",
      "Shared contracts",
      "API and backend workflow",
      "Web UI and client workflow",
      "Tooling and automation"
    ]);
    expect(draft.risks).toEqual([
      "Schema or migration changes can affect local SQLite data compatibility and rollout steps.",
      "Shared contract changes can break both API and web consumers if the update is only partially applied.",
      "Coordinated backend and frontend changes need an end-to-end review to confirm the workflow still matches across the API boundary.",
      "Tooling or CI changes can slow or block local development, validation, or agent workflows."
    ]);
    expect(draft.markdown).toContain("## What Changed");
    expect(draft.markdown).toContain("## Review Order");
    expect(draft.markdown).toContain("## Review Focus");
    expect(draft.markdown).toContain("`prisma/schema.prisma`");
  });

  it("keeps docs-only changes lightweight", () => {
    const draft = buildPullRequestDraft([
      "docs/pull-request-standards.md",
      "README.md"
    ]);

    expect(draft.areas.map((area) => area.title)).toEqual(["Documentation and contributor workflow"]);
    expect(draft.risks).toEqual(["Low behavioral risk from changed code paths was detected from file paths alone."]);
    expect(draft.markdown).toContain("Documentation and contributor workflow");
    expect(draft.markdown).toContain("Low behavioral risk");
  });

  it("normalizes duplicate Windows paths", () => {
    const draft = buildPullRequestDraft([
      "apps\\api\\src\\app.ts",
      "apps/api/src/app.ts",
      "apps\\api\\src\\index.test.ts"
    ]);

    expect(draft.areas).toEqual([
      {
        files: ["apps/api/src/app.ts", "apps/api/src/index.test.ts"],
        title: "API and backend workflow"
      }
    ]);
  });
});
