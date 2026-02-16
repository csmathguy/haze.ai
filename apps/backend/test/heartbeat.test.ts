import { describe, expect, test, vi } from "vitest";
import { HeartbeatMonitor } from "../src/heartbeat.js";

describe("HeartbeatMonitor", () => {
  test("wakes orchestrator when pulse is stale", async () => {
    vi.useFakeTimers();

    const wake = vi.fn(async () => {});
    const orchestrator = {
      isBusy: vi.fn(() => false),
      wake
    };
    const audit = {
      record: vi.fn(async () => {})
    };

    const monitor = new HeartbeatMonitor(
      orchestrator,
      {
        intervalMs: 1000,
        stallThresholdMs: 2000
      },
      audit
    );

    monitor.start();
    monitor.pulse("test");

    await vi.advanceTimersByTimeAsync(2500);

    expect(wake).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "heartbeat_stall_detected" })
    );

    monitor.stop();
    vi.useRealTimers();
  });

  test("does not wake if orchestrator is already busy", async () => {
    vi.useFakeTimers();

    const wake = vi.fn(async () => {});
    const orchestrator = {
      isBusy: vi.fn(() => true),
      wake
    };

    const monitor = new HeartbeatMonitor(orchestrator, {
      intervalMs: 1000,
      stallThresholdMs: 2000
    });

    monitor.start();
    monitor.pulse("test");

    await vi.advanceTimersByTimeAsync(2500);

    expect(wake).not.toHaveBeenCalled();

    monitor.stop();
    vi.useRealTimers();
  });
});
