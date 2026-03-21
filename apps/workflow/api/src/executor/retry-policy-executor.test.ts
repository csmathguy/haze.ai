import { describe, it, expect, vi } from "vitest";
import { executeWithRetry, createRetryPolicy } from "./retry-policy-executor.js";

describe("RetryPolicyExecutor", () => {
  describe("executeWithRetry", () => {
    describe("immediate success", () => {
      it("returns value on first successful execution", async () => {
        const fn = vi.fn().mockResolvedValue("success");

        const result = await executeWithRetry(fn, { maxAttempts: 3 });

        expect(result.value).toBe("success");
        expect(result.attempts).toBe(1);
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it("succeeds on first attempt with no delay configured", async () => {
        const fn = vi.fn().mockResolvedValue(42);

        const result = await executeWithRetry(fn, {
          maxAttempts: 5,
          delayMs: 100
        });

        expect(result.value).toBe(42);
        expect(result.attempts).toBe(1);
      });
    });

    describe("retry on failure", () => {
      it("retries on first failure and succeeds on second attempt", async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error("attempt 1 failed"))
          .mockResolvedValueOnce("success");

        const result = await executeWithRetry(fn, { maxAttempts: 3 });

        expect(result.value).toBe("success");
        expect(result.attempts).toBe(2);
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it("retries multiple times until success", async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error("attempt 1"))
          .mockRejectedValueOnce(new Error("attempt 2"))
          .mockResolvedValueOnce("success");

        const result = await executeWithRetry(fn, { maxAttempts: 4 });

        expect(result.value).toBe("success");
        expect(result.attempts).toBe(3);
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it("returns correct attempt count on late success", async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error("fail 1"))
          .mockRejectedValueOnce(new Error("fail 2"))
          .mockRejectedValueOnce(new Error("fail 3"))
          .mockResolvedValueOnce("finally");

        const result = await executeWithRetry(fn, { maxAttempts: 5 });

        expect(result.attempts).toBe(4);
      });
    });

    describe("exhausted retries", () => {
      it("throws error after maxAttempts exhausted", async () => {
        const fn = vi
          .fn()
          .mockRejectedValue(new Error("persistent failure"));

        await expect(
          executeWithRetry(fn, { maxAttempts: 3 })
        ).rejects.toThrow("Failed after 3 attempts");
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it("throws with descriptive error message including last error", async () => {
        const fn = vi
          .fn()
          .mockRejectedValue(new Error("database connection timeout"));

        await expect(
          executeWithRetry(fn, { maxAttempts: 2 })
        ).rejects.toThrow("database connection timeout");
      });

      it("handles non-Error exceptions", async () => {
        let callCount = 0;
        const fn = async (): Promise<string> => {
          // Ensure we use the async nature of the function
          await Promise.resolve();
          callCount += 1;
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw "string error";
        };

        await expect(
          executeWithRetry(fn, { maxAttempts: 1 })
        ).rejects.toThrow("Failed after 1 attempts: string error");

        expect(callCount).toBe(1);
      });
    });

    describe("retry delay", () => {
      it("waits delayMs between retry attempts", async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error("fail"))
          .mockResolvedValueOnce("success");

        const startTime = Date.now();
        const result = await executeWithRetry(fn, {
          maxAttempts: 2,
          delayMs: 50
        });

        const elapsed = Date.now() - startTime;

        expect(result.value).toBe("success");
        // Should have waited approximately 50ms between attempts
        expect(elapsed).toBeGreaterThanOrEqual(40);
      });

      it("does not delay before final failure", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("always fails"));

        const startTime = Date.now();

        await expect(
          executeWithRetry(fn, {
            maxAttempts: 2,
            delayMs: 100
          })
        ).rejects.toThrow();

        const elapsed = Date.now() - startTime;

        // Should be less than 200ms (no delay after final failure)
        expect(elapsed).toBeLessThan(200);
      });

      it("accumulates total duration including delays", async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error("fail 1"))
          .mockRejectedValueOnce(new Error("fail 2"))
          .mockResolvedValueOnce("success");

        const result = await executeWithRetry(fn, {
          maxAttempts: 3,
          delayMs: 50
        });

        // Should include delays: 50ms + 50ms = 100ms minimum
        expect(result.totalDurationMs).toBeGreaterThanOrEqual(80);
      });

      it("skips delay when undefined", async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error("fail"))
          .mockResolvedValueOnce("success");

        const result = await executeWithRetry(fn, {
          maxAttempts: 2
          // No delayMs specified
        });

        expect(result.value).toBe("success");
        expect(result.attempts).toBe(2);
        // Should complete quickly without delay
        expect(result.totalDurationMs).toBeLessThan(100);
      });
    });

    describe("duration tracking", () => {
      it("tracks total duration including retries and delays", async () => {
        const fn = vi
          .fn()
          .mockRejectedValueOnce(new Error("fail 1"))
          .mockResolvedValueOnce("success");

        const result = await executeWithRetry(fn, {
          maxAttempts: 3,
          delayMs: 50
        });

        expect(result.totalDurationMs).toBeGreaterThan(0);
        expect(typeof result.totalDurationMs).toBe("number");
      });

      it("records zero or minimal duration for immediate success", async () => {
        const fn = vi.fn().mockResolvedValue("instant");

        const result = await executeWithRetry(fn, {
          maxAttempts: 1
        });

        expect(result.totalDurationMs).toBeLessThan(100);
      });
    });

    describe("single attempt mode", () => {
      it("succeeds with maxAttempts=1 on first success", async () => {
        const fn = vi.fn().mockResolvedValue("ok");

        const result = await executeWithRetry(fn, { maxAttempts: 1 });

        expect(result.value).toBe("ok");
        expect(result.attempts).toBe(1);
      });

      it("fails with maxAttempts=1 on first failure", async () => {
        const fn = vi.fn().mockRejectedValue(new Error("nope"));

        await expect(
          executeWithRetry(fn, { maxAttempts: 1 })
        ).rejects.toThrow("Failed after 1 attempts: nope");
      });
    });

    describe("lastError tracking", () => {
      it("returns undefined lastError on success", async () => {
        const fn = vi.fn().mockResolvedValue("success");

        const result = await executeWithRetry(fn, { maxAttempts: 2 });

        expect(result.lastError).toBeUndefined();
      });

      it("includes lastError in error message on failure", async () => {
        const fn = vi
          .fn()
          .mockRejectedValue(new Error("specific error message"));

        try {
          await executeWithRetry(fn, { maxAttempts: 1 });
          // Should not reach here
          expect.fail("should have thrown");
        } catch (error) {
          expect((error as Error).message).toContain("specific error message");
        }
      });
    });
  });

  describe("createRetryPolicy", () => {
    it("creates default policy with maxAttempts=1 when undefined", () => {
      const policy = createRetryPolicy();

      expect(policy.maxAttempts).toBe(1);
      expect(policy.delayMs).toBeUndefined();
    });

    it("converts maxRetries to maxAttempts (maxRetries + 1)", () => {
      const policy = createRetryPolicy({ maxRetries: 2 });

      expect(policy.maxAttempts).toBe(3); // 1 initial + 2 retries
    });

    it("converts maxRetries=0 to maxAttempts=1", () => {
      const policy = createRetryPolicy({ maxRetries: 0 });

      expect(policy.maxAttempts).toBe(1);
    });

    it("includes backoffMs as delayMs", () => {
      const policy = createRetryPolicy({
        maxRetries: 2,
        backoffMs: 100
      });

      expect(policy.maxAttempts).toBe(3);
      expect(policy.delayMs).toBe(100);
    });

    it("handles partial policy configuration", () => {
      const policy1 = createRetryPolicy({ maxRetries: 3 });
      expect(policy1.delayMs).toBeUndefined();

      const policy2 = createRetryPolicy({ backoffMs: 50 });
      expect(policy2.maxAttempts).toBe(1);
      expect(policy2.delayMs).toBe(50);
    });

    it("handles empty policy object", () => {
      const policy = createRetryPolicy({});

      expect(policy.maxAttempts).toBe(1);
      expect(policy.delayMs).toBeUndefined();
    });
  });
});
