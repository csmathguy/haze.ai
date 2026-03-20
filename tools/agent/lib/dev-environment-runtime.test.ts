import { createServer } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { ensureServicePortsAvailable, waitForServiceHealth } from "./dev-environment-runtime.js";

async function listenOnEphemeralPort(): Promise<ReturnType<typeof createServer>> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  return server;
}

function readListeningPort(server: ReturnType<typeof createServer>): number {
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected a TCP server address.");
  }

  return address.port;
}

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

describe("ensureServicePortsAvailable", () => {
  it("accepts services whose planned ports are free", async () => {
    const reserved = await listenOnEphemeralPort();
    const port = readListeningPort(reserved);
    await new Promise<void>((resolve, reject) => {
      reserved.close((error) => {
        if (error === undefined) {
          resolve();
          return;
        }

        reject(error);
      });
    });

    await expect(
      ensureServicePortsAvailable([
        {
          label: "Audit API",
          primaryUrl: `http://127.0.0.1:${port.toString()}`
        }
      ])
    ).resolves.toBeUndefined();
  });

  it("fails clearly when a planned port is already occupied", async () => {
    const occupied = await listenOnEphemeralPort();
    const port = readListeningPort(occupied);

    try {
      await expect(
        ensureServicePortsAvailable([
          {
            label: "Audit Web",
            primaryUrl: `http://127.0.0.1:${port.toString()}`
          }
        ])
      ).rejects.toThrow(`Audit Web cannot start because 127.0.0.1:${port.toString()} is already in use.`);
    } finally {
      await new Promise<void>((resolve, reject) => {
        occupied.close((error) => {
          if (error === undefined) {
            resolve();
            return;
          }

          reject(error);
        });
      });
    }
  });
});
