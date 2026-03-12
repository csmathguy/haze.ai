import { describe, expect, it } from "vitest";

import {
  buildDocumentMissingFacts,
  buildQuestionnairePrompts,
  createEmptyTaxReturnDraft,
  createReviewTasksFromDataGaps,
  createReviewTasksFromDocuments,
  deriveRequiredForms,
  formatUsd,
  inferDocumentKindFromFileName,
  makeUsd
} from "./index.js";

describe("inferDocumentKindFromFileName", () => {
  it("maps common tax forms from uploaded filenames", () => {
    expect(inferDocumentKindFromFileName("2025-W2-employer.pdf")).toBe("w-2");
    expect(inferDocumentKindFromFileName("broker-1099-INT.pdf")).toBe("1099-int");
    expect(inferDocumentKindFromFileName("coinbase-wallet-export.csv")).toBe("crypto-wallet-export");
  });

  it("falls back to unknown for files that do not match the first-pass patterns", () => {
    expect(inferDocumentKindFromFileName("scan-0001.pdf")).toBe("unknown");
  });
});

describe("buildDocumentMissingFacts", () => {
  it("highlights the lot data needed for capital gains optimization", () => {
    expect(buildDocumentMissingFacts("1099-b")).toContain("lot identification");
    expect(buildDocumentMissingFacts("crypto-wallet-export")).toContain("wallet transfer matching");
  });

  it("covers non-capital-gains document families as separate review branches", () => {
    expect(buildDocumentMissingFacts("1098")).toContain("mortgage interest allocation");
    expect(buildDocumentMissingFacts("schedule-k-1")).toContain("state apportionment");
    expect(buildDocumentMissingFacts("unknown")).toContain("document classification");
  });

  it("covers deduction and retirement document families distinctly", () => {
    expect(buildDocumentMissingFacts("charitable-contribution")).toContain("receipt valuation");
    expect(buildDocumentMissingFacts("property-tax-statement")).toContain("deductible tax portion");
    expect(buildDocumentMissingFacts("retirement-distribution")).toContain("rollover status");
  });
});

describe("createEmptyTaxReturnDraft", () => {
  it("starts every workspace with a draft 1040 shell", () => {
    const draft = createEmptyTaxReturnDraft(2025);

    expect(draft.household.taxYear).toBe(2025);
    expect(draft.requiredForms).toEqual(["1040"]);
  });
});

describe("createReviewTasksFromDocuments", () => {
  it("turns document missing facts into explicit review tasks", () => {
    const tasks = createReviewTasksFromDocuments([
      {
        fileName: "broker-1099-B.pdf",
        fileSizeBytes: 1024,
        id: "doc-1",
        importedAt: "2026-03-10T23:00:00.000Z",
        kind: "1099-b",
        mimeType: "application/pdf",
        missingFacts: [
          {
            key: "lot-identification",
            label: "Lot identification",
            reason: "Specific identification is required to compare sale scenarios.",
            severity: "required"
          }
        ],
        status: "needs-review",
        taxYear: 2025
      }
    ]);

    expect(tasks).toEqual([
      {
        actionLabel: "Fill missing data",
        documentId: "doc-1",
        id: "doc-1-1",
        reason: "Specific identification is required to compare sale scenarios.",
        severity: "required",
        title: "broker-1099-B.pdf: Lot identification"
      }
    ]);
  });
});

describe("createReviewTasksFromDataGaps", () => {
  it("turns open data gaps into explicit review work items", () => {
    expect(
      createReviewTasksFromDataGaps([
        {
          description: "Cost basis is missing for a sale that affects Schedule D.",
          documentId: "doc-1",
          gapKind: "missing-tax-lot",
          id: "gap-1",
          key: "cost-basis",
          severity: "required",
          status: "open",
          title: "Resolve missing cost basis"
        }
      ])
    ).toEqual([
      {
        actionLabel: "Resolve data gap",
        documentId: "doc-1",
        id: "gap-1",
        reason: "Cost basis is missing for a sale that affects Schedule D.",
        severity: "required",
        title: "Resolve missing cost basis"
      }
    ]);
  });

  it("uses optimization-specific actions and ignores resolved gaps", () => {
    expect(
      createReviewTasksFromDataGaps([
        {
          description: "Need a preferred disposal strategy before scenario generation.",
          gapKind: "optimization-input",
          id: "gap-optimization",
          key: "lot-strategy",
          severity: "warning",
          status: "open",
          title: "Pick a lot strategy"
        },
        {
          description: "Already resolved.",
          gapKind: "missing-source-field",
          id: "gap-resolved",
          key: "resolved-field",
          severity: "required",
          status: "resolved",
          title: "Resolved gap"
        }
      ])
    ).toEqual([
      {
        actionLabel: "Review optimization input",
        documentId: undefined,
        id: "gap-optimization",
        reason: "Need a preferred disposal strategy before scenario generation.",
        severity: "warning",
        title: "Pick a lot strategy"
      }
    ]);
  });
});

describe("buildQuestionnairePrompts", () => {
  it("adds lot and optimization prompts when capital-gains documents are present", () => {
    const prompts = buildQuestionnairePrompts({
      documents: [
        {
          fileName: "broker-1099-B.pdf",
          fileSizeBytes: 1024,
          id: "doc-1",
          importedAt: "2026-03-11T12:00:00.000Z",
          kind: "1099-b",
          mimeType: "application/pdf",
          missingFacts: [],
          status: "imported",
          taxYear: 2025
        }
      ],
      gaps: [
        {
          description: "Need acquisition date support for an uncovered sale.",
          documentId: "doc-1",
          gapKind: "missing-tax-lot",
          id: "gap-1",
          key: "acquisition-date",
          severity: "required",
          status: "open",
          title: "Resolve missing acquisition date"
        }
      ],
      household: {
        filingStatus: "single",
        hasDigitalAssets: false,
        primaryTaxpayer: "Local owner",
        stateResidence: "NY",
        taxYear: 2025
      },
      responses: [
        {
          answeredAt: "2026-03-11T12:01:00.000Z",
          promptKey: "optimization-capital-loss-carryover",
          value: "yes"
        }
      ],
      taxYear: 2025
    });

    expect(prompts.some((prompt) => prompt.key === "asset-lots-uncovered-basis")).toBe(true);
    expect(prompts.some((prompt) => prompt.key === "gap-acquisition-date")).toBe(true);
    expect(prompts.find((prompt) => prompt.key === "optimization-capital-loss-carryover")?.currentValue).toBe("yes");
  });

  it("creates questionnaire prompts from compliance gaps and filters out non-actionable gaps", () => {
    const prompts = buildQuestionnairePrompts({
      documents: [],
      gaps: [
        {
          description: "Confirm whether estimated tax payments were made.",
          gapKind: "compliance-question",
          id: "gap-1",
          key: "estimated-payments",
          severity: "required",
          status: "open",
          title: "Estimated tax payments"
        },
        {
          description: "Informational only.",
          gapKind: "missing-source-field",
          id: "gap-2",
          key: "info-gap",
          severity: "info",
          status: "open",
          title: "Informational gap"
        },
        {
          description: "Already handled.",
          gapKind: "optimization-input",
          id: "gap-3",
          key: "resolved-gap",
          severity: "warning",
          status: "resolved",
          title: "Resolved gap"
        }
      ],
      household: {
        filingStatus: "single",
        hasDigitalAssets: true,
        primaryTaxpayer: "Local owner",
        stateResidence: "NY",
        taxYear: 2025
      },
      responses: [],
      taxYear: 2025
    });

    expect(prompts.some((prompt) => prompt.key === "asset-lots-uncovered-basis")).toBe(true);
    expect(prompts.find((prompt) => prompt.key === "gap-estimated-payments")).toEqual(
      expect.objectContaining({
        category: "compliance",
        sourceGapId: "gap-1"
      })
    );
    expect(prompts.some((prompt) => prompt.key === "gap-info-gap")).toBe(false);
    expect(prompts.some((prompt) => prompt.key === "gap-resolved-gap")).toBe(false);
  });
});

describe("makeUsd", () => {
  it("builds a normalized USD money object", () => {
    expect(makeUsd(12500)).toEqual({
      amountInCents: 12500,
      currencyCode: "USD"
    });
  });
});

describe("formatUsd", () => {
  it("formats integer cents into display currency", () => {
    expect(formatUsd(makeUsd(12500))).toBe("$125.00");
  });
});

describe("deriveRequiredForms", () => {
  it("maps imported capital-gains documents to Schedule D support forms", () => {
    expect(
      deriveRequiredForms([
        {
          fileName: "broker-1099-B.pdf",
          fileSizeBytes: 1024,
          id: "doc-1",
          importedAt: "2026-03-10T23:00:00.000Z",
          kind: "1099-b",
          mimeType: "application/pdf",
          missingFacts: [],
          status: "imported",
          taxYear: 2025
        }
      ])
    ).toEqual(["1040", "schedule-d", "form-8949"]);
  });
});
