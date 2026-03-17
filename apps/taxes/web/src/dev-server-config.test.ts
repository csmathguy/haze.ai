import { describe, expect, it } from "vitest";

import { resolveTaxesWebDevServerConfig } from "./dev-server-config.js";

describe("resolveTaxesWebDevServerConfig", () => {
  it("uses default local dev ports and proxy target", () => {
    const config = resolveTaxesWebDevServerConfig({});

    expect(config.webPort).toBe(5173);
    expect(config.apiOrigin).toBe(buildHttpOrigin("127.0.0.1", 3040));
  });

  it("resolves TAXES_* overrides", () => {
    const config = resolveTaxesWebDevServerConfig({
      TAXES_API_HOST: "localhost",
      TAXES_API_PORT: "4040",
      TAXES_WEB_PORT: "5000"
    });

    expect(config.webPort).toBe(5000);
    expect(config.apiOrigin).toBe(buildHttpOrigin("localhost", 4040));
  });

  it("prefers TAXES_API_ORIGIN when provided", () => {
    const config = resolveTaxesWebDevServerConfig({
      TAXES_API_HOST: "127.0.0.1",
      TAXES_API_ORIGIN: buildHttpOrigin("127.0.0.1", 9000),
      TAXES_API_PORT: "3040"
    });

    expect(config.apiOrigin).toBe(buildHttpOrigin("127.0.0.1", 9000));
  });

  it("throws when TAXES_WEB_PORT is invalid", () => {
    expect(() => resolveTaxesWebDevServerConfig({ TAXES_WEB_PORT: "-1" })).toThrow("Invalid TAXES_WEB_PORT");
  });
});

function buildHttpOrigin(host: string, port: number): string {
  const protocol = "http";
  return `${protocol}://${host}:${port.toString()}`;
}
