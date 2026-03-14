import { afterEach, describe, expect, it } from "vitest";

import { waitForServiceHealth } from "./dev-environment-runtime.js";

describe("waitForServiceHealth", () => {
  afterEach(() => {
    delete process.env.__TEST_HEALTH_URL__;
  });

  it("returns immediately when no health url is configured", async () => {
    await expect(
      waitForServiceHealth({
        serviceLabel: "Audit API"
      })
    ).resolves.toBeUndefined();
  });

  it("waits until the service reports a healthy response", async () => {
    let attempts = 0;

    await expect(
      waitForServiceHealth({
        fetchFn: () => {
          attempts += 1;

          return Promise.resolve(new Response(null, {
            status: attempts >= 3 ? 200 : 503
          }));
        },
        healthUrl: "http://127.0.0.1:3180/api/health",
        intervalMs: 10,
        serviceLabel: "Audit API",
        timeoutMs: 1_000
      })
    ).resolves.toBeUndefined();

    expect(attempts).toBe(3);
  });

  it("fails with the last health-check error when the service never becomes healthy", async () => {
    await expect(
      waitForServiceHealth({
        fetchFn: () =>
          Promise.resolve(new Response(null, {
            status: 503
          })),
        healthUrl: "http://127.0.0.1:3180/api/health",
        intervalMs: 1,
        serviceLabel: "Audit API",
        timeoutMs: 5
      })
    ).rejects.toThrow("Last error: HTTP 503");
  });
});
