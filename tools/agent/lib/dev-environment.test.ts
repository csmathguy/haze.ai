import { describe, expect, it } from "vitest";

import {
  createDevEnvironmentPlan,
  parseDevEnvironmentArgs,
  renderDevEnvironmentCatalog,
  renderDevEnvironmentPlan
} from "./dev-environment.js";

describe("parseDevEnvironmentArgs", () => {
  it("accepts repeated environment flags and dry-run mode", () => {
    const parsed = parseDevEnvironmentArgs(["--environment", "taxes", "--environment", "audit", "--dry-run"], {
      requireEnvironmentSelection: true
    });

    expect(parsed).toEqual({
      checkout: "main",
      dryRun: true,
      environmentIds: ["taxes", "audit"]
    });
  });

  it("expands the all environment selector", () => {
    const parsed = parseDevEnvironmentArgs(["--environment", "all"], {
      requireEnvironmentSelection: true
    });

    expect(parsed.environmentIds).toEqual(["taxes", "plan", "audit", "knowledge", "code-review", "gateway", "workflow"]);
  });

  it("rejects missing environment selection for start flows", () => {
    expect(() => parseDevEnvironmentArgs([], { requireEnvironmentSelection: true })).toThrow(
      "Select at least one environment with --environment <name>."
    );
  });

  it("rejects unsupported checkout targets in this slice", () => {
    expect(() =>
      parseDevEnvironmentArgs(["--environment", "taxes", "--checkout", "current"], {
        requireEnvironmentSelection: true
      })
    ).toThrow('Unsupported checkout "current". Only "main" is available in this slice.');
  });
});

describe("createDevEnvironmentPlan", () => {
  it("builds workspace commands for the selected environments", () => {
    const plan = createDevEnvironmentPlan(
      {
        checkout: "main",
        dryRun: false,
        environmentIds: ["taxes", "plan"]
      },
      {
        main: "C:/repo"
      }
    );

    expect(plan.checkoutRoot).toBe("C:/repo");
    expect(plan.environments.map((environment) => environment.id)).toEqual(["taxes", "plan"]);
    expect(plan.services.map((service) => service.id)).toEqual(["taxes-api", "taxes-web", "plan-api", "plan-web"]);
    expect(plan.services[0]?.commandArgs).toEqual(["run", "dev", "--workspace=@taxes/api"]);
    expect(plan.services[2]?.primaryUrl).toBe("http://127.0.0.1:3140");
  });
});

describe("renderers", () => {
  it("renders the environment catalog with examples", () => {
    const catalog = renderDevEnvironmentCatalog();

    expect(catalog).toContain("Available environments:");
    expect(catalog).toContain("- taxes: Tax workflow document intake, workspace review, and filing support surfaces.");
    expect(catalog).toContain("- all: every environment listed above");
    expect(catalog).toContain("npm run dev:env -- --environment taxes");
  });

  it("renders the launch plan summary", () => {
    const plan = createDevEnvironmentPlan(
      {
        checkout: "main",
        dryRun: true,
        environmentIds: ["audit"]
      },
      {
        main: "C:/repo"
      }
    );

    const summary = renderDevEnvironmentPlan(plan);

    expect(summary).toContain("Checkout: main");
    expect(summary).toContain("Environments: audit");
    expect(summary).toContain("- audit-api: http://127.0.0.1:3180 | health http://127.0.0.1:3180/api/health");
    expect(summary).toContain("command: npm run dev --workspace=@taxes/audit-api");
  });
});
