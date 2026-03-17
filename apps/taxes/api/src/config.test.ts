import { describe, expect, it } from "vitest";

import { buildRuntimeConfig } from "./config.js";

describe("buildRuntimeConfig", () => {
  it("uses default local runtime values", () => {
    const config = buildRuntimeConfig({});

    expect(config.apiHost).toBe("127.0.0.1");
    expect(config.apiPort).toBe(3040);
    expect(config.webPort).toBe(5173);
    expect(config.databaseUrl).toBe("file:./data/sqlite/taxes.db");
    expect(config.workspaceDataRoot.endsWith("data\\workspace") || config.workspaceDataRoot.endsWith("data/workspace")).toBe(true);
    expect(config.webAllowedOrigins).toEqual([buildHttpOrigin("127.0.0.1", 5173), buildHttpOrigin("localhost", 5173)]);
  });

  it("resolves values from TAXES_* environment overrides", () => {
    const config = buildRuntimeConfig({
      DATABASE_URL: "file:./custom/priority.db",
      TAXES_API_HOST: "0.0.0.0",
      TAXES_API_PORT: "4545",
      TAXES_WEB_ORIGINS: `${buildHttpOrigin("127.0.0.1", 7000)}, ${buildHttpOrigin("localhost", 7000)}`,
      TAXES_WEB_PORT: "7000",
      TAXES_WORKSPACE_DATA_ROOT: "./tmp/workspace"
    });

    expect(config.apiHost).toBe("0.0.0.0");
    expect(config.apiPort).toBe(4545);
    expect(config.webPort).toBe(7000);
    expect(config.databaseUrl).toBe("file:./custom/priority.db");
    expect(config.workspaceDataRoot.endsWith("tmp\\workspace") || config.workspaceDataRoot.endsWith("tmp/workspace")).toBe(true);
    expect(config.webAllowedOrigins).toEqual([buildHttpOrigin("127.0.0.1", 7000), buildHttpOrigin("localhost", 7000)]);
  });

  it("throws on invalid port values", () => {
    expect(() => buildRuntimeConfig({ TAXES_API_PORT: "nope" })).toThrow("Invalid TAXES_API_PORT");
    expect(() => buildRuntimeConfig({ TAXES_WEB_PORT: "70000" })).toThrow("Invalid TAXES_WEB_PORT");
  });
});

function buildHttpOrigin(host: string, port: number): string {
  const protocol = "http";
  return `${protocol}://${host}:${port.toString()}`;
}
