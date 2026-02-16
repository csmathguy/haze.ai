import { describe, expect, test, vi } from "vitest";
import { BasicOrchestrator } from "../src/orchestrator.js";

describe("BasicOrchestrator", () => {
  test("starts idle and wakes with reason", async () => {
    vi.useFakeTimers();

    const audit = {
      record: vi.fn(async () => {})
    };
    const orchestrator = new BasicOrchestrator(audit);
    const wakePromise = orchestrator.wake("unit_test");

    expect(orchestrator.isBusy()).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    await wakePromise;

    expect(orchestrator.isBusy()).toBe(false);
    expect(orchestrator.getStatus().lastWakeReason).toBe("unit_test");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "orchestrator_wake_requested" })
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "orchestrator_cycle_completed" })
    );

    vi.useRealTimers();
  });
});
