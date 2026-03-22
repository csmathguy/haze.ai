import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchBitcoinFilingSummary, fetchWorkspaceSnapshot, saveQuestionnaireResponse, uploadTaxDocument } from "./api.js";

interface MockFetchResponse {
  json?: () => Promise<unknown>;
  ok: boolean;
  status?: number;
}

describe("app api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the workspace snapshot", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
        snapshot: {
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
          filingChecklist: {
            differsByJurisdiction: false,
            federal: {
              items: [],
              jurisdiction: "federal",
              readiness: "ready"
            },
            filingStatus: "single",
            state: {
              items: [],
              jurisdiction: "state",
              readiness: "ready"
            },
            stateResidence: "NY",
            taxYear: 2025
          },
          generatedAt: "2026-03-11T18:00:00.000Z",
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
          scenarios: []
        }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await fetchWorkspaceSnapshot();

    expect(fetchMock).toHaveBeenCalledWith("/api/workspace");
    expect(snapshot.localOnly).toBe(true);
  });

  it("throws when the workspace request fails", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      ok: false,
      status: 503
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchWorkspaceSnapshot()).rejects.toThrow("Workspace request failed with 503.");
  });

  it("loads the BTC filing summary", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
          summary: {
            blockedRows: [],
            csvContent: "Acquired,Disposed\n",
            csvFileName: "btc-filing-summary-2025.csv",
            generatedAt: "2026-03-22T18:00:00.000Z",
            readyRows: [],
            taxYear: 2025,
            warnings: []
          }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    const summary = await fetchBitcoinFilingSummary();

    expect(fetchMock).toHaveBeenCalledWith("/api/bitcoin-filing-summary");
    expect(summary.csvFileName).toBe("btc-filing-summary-2025.csv");
  });

  it("uploads tax documents with multipart form data", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      json: () =>
        Promise.resolve({
        document: {
          fileName: "2025-W2.pdf",
          id: "doc-1"
        }
        }),
      ok: true
    });

    vi.stubGlobal("fetch", fetchMock);

    const documentId = await uploadTaxDocument(new File(["content"], "2025-W2.pdf", { type: "application/pdf" }));

    const requestInit = fetchMock.mock.calls[0]?.[1];

    expect(fetchMock).toHaveBeenCalledWith("/api/documents", expect.anything());
    expect(requestInit).toMatchObject({
      method: "POST"
    });
    expect(requestInit?.body).toBeInstanceOf(FormData);
    expect(documentId).toBe("doc-1");
  });

  it("throws when document upload fails", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      ok: false,
      status: 400
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadTaxDocument(new File(["content"], "2025-W2.pdf", { type: "application/pdf" }))).rejects.toThrow(
      "Upload failed with 400."
    );
  });

  it("saves questionnaire responses with JSON payloads", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      ok: true,
      status: 204
    });

    vi.stubGlobal("fetch", fetchMock);

    await saveQuestionnaireResponse({
      promptKey: "optimization-capital-loss-carryover",
      taxYear: 2025,
      value: "yes"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/questionnaire-responses",
      expect.objectContaining({
        body: JSON.stringify({
          promptKey: "optimization-capital-loss-carryover",
          taxYear: 2025,
          value: "yes"
        }),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      })
    );
  });

  it("throws when questionnaire persistence fails", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<MockFetchResponse>>().mockResolvedValue({
      ok: false,
      status: 500
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      saveQuestionnaireResponse({
        promptKey: "optimization-capital-loss-carryover",
        taxYear: 2025,
        value: "yes"
      })
    ).rejects.toThrow("Questionnaire save failed with 500.");
  });
});
