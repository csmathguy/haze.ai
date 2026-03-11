import { describe, expect, it } from "vitest";

import {
  buildDocumentMissingFacts,
  createEmptyTaxReturnDraft,
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
