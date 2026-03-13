import { describe, expect, it } from "vitest";
import type { WorkspaceSnapshot } from "@taxes/shared";

import { buildReviewBanner, buildScenarioChartData, formatScenarioTax, summarizeRequiredForms } from "./index.js";

function createWorkspaceSnapshot(overrides: Partial<WorkspaceSnapshot>): WorkspaceSnapshot {
  return {
    assetLots: [],
    dataGaps: [],
    documents: [],
    draft: {
      deductionItems: [],
      household: {
        filingStatus: "single",
        hasDigitalAssets: false,
        primaryTaxpayer: "Local owner",
        stateResidence: "NY",
        taxYear: 2025
      },
      incomeItems: [],
      notes: [],
      requiredForms: ["1040"]
    },
    extractions: [],
    generatedAt: "2026-03-10T23:00:00.000Z",
    household: {
      filingStatus: "single",
      hasDigitalAssets: false,
      primaryTaxpayer: "Local owner",
      stateResidence: "NY",
      taxYear: 2025
    },
    localOnly: true,
    questionnaire: [],
    reviewQueue: [],
    scenarios: [],
    ...overrides
  };
}

describe("buildReviewBanner", () => {
  it("uses a warning banner when the workspace has blocking review tasks", () => {
    expect(
      buildReviewBanner(
        createWorkspaceSnapshot({
        draft: {
          deductionItems: [],
          household: {
            filingStatus: "single",
            hasDigitalAssets: true,
            primaryTaxpayer: "Local owner",
            stateResidence: "NY",
            taxYear: 2025
          },
          incomeItems: [],
          notes: [],
          requiredForms: ["1040", "schedule-d"]
        },
        generatedAt: "2026-03-10T23:00:00.000Z",
        household: {
          filingStatus: "single",
          hasDigitalAssets: true,
          primaryTaxpayer: "Local owner",
          stateResidence: "NY",
          taxYear: 2025
        },
        localOnly: true,
        reviewQueue: [
          {
            actionLabel: "Fill missing data",
            id: "task-1",
            reason: "Acquisition date is missing.",
            severity: "required",
            title: "1099-B: acquisition date"
          }
        ],
        scenarios: []
      })
      )
    ).toEqual({
      emphasis: "warning",
      message: "1 review checkpoint(s) need attention before the imported values can be trusted for filing or lot optimization."
    });
  });

  it("uses an informational banner for an empty workspace", () => {
    expect(
      buildReviewBanner(
        createWorkspaceSnapshot({
        draft: {
          deductionItems: [],
          household: {
            filingStatus: "single",
            hasDigitalAssets: false,
            primaryTaxpayer: "Local owner",
            stateResidence: "NY",
            taxYear: 2025
          },
          incomeItems: [],
          notes: [],
          requiredForms: ["1040"]
        },
        generatedAt: "2026-03-10T23:00:00.000Z",
        household: {
          filingStatus: "single",
          hasDigitalAssets: false,
          primaryTaxpayer: "Local owner",
          stateResidence: "NY",
          taxYear: 2025
        },
        localOnly: true,
        reviewQueue: [],
        scenarios: []
      })
      )
    ).toEqual({
      emphasis: "info",
      message: "The workspace is ready for document intake. Uploaded files will stay local and generate review steps as needed."
    });
  });
});

describe("summarizeRequiredForms", () => {
  it("renders the current draft form list for dashboard cards", () => {
    expect(
      summarizeRequiredForms(
        createWorkspaceSnapshot({
        draft: {
          deductionItems: [],
          household: {
            filingStatus: "single",
            hasDigitalAssets: false,
            primaryTaxpayer: "Local owner",
            stateResidence: "NY",
            taxYear: 2025
          },
          incomeItems: [],
          notes: [],
          requiredForms: ["1040", "schedule-b"]
        },
        generatedAt: "2026-03-10T23:00:00.000Z",
        household: {
          filingStatus: "single",
          hasDigitalAssets: false,
          primaryTaxpayer: "Local owner",
          stateResidence: "NY",
          taxYear: 2025
        },
        localOnly: true,
        reviewQueue: [],
        scenarios: []
      })
      )
    ).toBe("1040, schedule-b");
  });
});

describe("buildScenarioChartData", () => {
  it("converts money values into chart-friendly dollars", () => {
    expect(
      buildScenarioChartData([
        {
          description: "FIFO template",
          estimatedFederalTax: {
            amountInCents: 125000,
            currencyCode: "USD"
          },
          id: "scenario-fifo",
          lotSelectionMethod: "fifo",
          name: "FIFO baseline",
          realizedLongTermGain: {
            amountInCents: 0,
            currencyCode: "USD"
          },
          realizedShortTermGain: {
            amountInCents: 0,
            currencyCode: "USD"
          }
        }
      ])
    ).toEqual([
      {
        estimatedTax: 1250,
        name: "FIFO baseline"
      }
    ]);
  });
});

describe("formatScenarioTax", () => {
  it("formats projected tax values for scenario cards", () => {
    expect(
      formatScenarioTax({
        description: "FIFO template",
        estimatedFederalTax: {
          amountInCents: 9900,
          currencyCode: "USD"
        },
        id: "scenario-fifo",
        lotSelectionMethod: "fifo",
        name: "FIFO baseline",
        realizedLongTermGain: {
          amountInCents: 0,
          currencyCode: "USD"
        },
        realizedShortTermGain: {
          amountInCents: 0,
          currencyCode: "USD"
        }
      })
    ).toBe("$99.00");
  });
});
