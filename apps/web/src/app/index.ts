import { formatUsd, type TaxScenario, type WorkspaceSnapshot } from "@taxes/shared";

export interface ReviewBannerState {
  readonly emphasis: "info" | "warning";
  readonly message: string;
}

export function buildReviewBanner(snapshot: WorkspaceSnapshot | null): ReviewBannerState | null {
  if (snapshot === null) {
    return null;
  }

  if (snapshot.reviewQueue.length > 0) {
    return {
      emphasis: "warning",
      message: `${snapshot.reviewQueue.length.toString()} review checkpoint(s) need attention before the imported values can be trusted for filing or lot optimization.`
    };
  }

  return {
    emphasis: "info",
    message: "The workspace is ready for document intake. Uploaded files will stay local and generate review steps as needed."
  };
}

export function summarizeRequiredForms(snapshot: WorkspaceSnapshot): string {
  return snapshot.draft.requiredForms.join(", ");
}

export function buildScenarioChartData(scenarios: TaxScenario[]): readonly { estimatedTax: number; name: string }[] {
  return scenarios.map((scenario) => ({
    estimatedTax: scenario.estimatedFederalTax.amountInCents / 100,
    name: scenario.name
  }));
}

export function formatScenarioTax(scenario: TaxScenario): string {
  return formatUsd(scenario.estimatedFederalTax);
}
