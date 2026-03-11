import { describe, expect, it } from "vitest";

import { sanitizeFileName } from "./storage.js";

describe("sanitizeFileName", () => {
  it("normalizes upload names for local storage", () => {
    expect(sanitizeFileName("Broker Statement 2025.pdf")).toBe("Broker-Statement-2025.pdf");
  });

  it("falls back to a safe placeholder when no filename characters remain", () => {
    expect(sanitizeFileName("***")).toBe("upload");
  });
});
