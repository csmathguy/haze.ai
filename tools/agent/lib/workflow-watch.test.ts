import { describe, expect, it } from "vitest";

import type { AuditEvent } from "./audit.js";
import {
  createWatchState,
  isApprovalGateEvent,
  isHeartbeatEvent,
  isStale,
  labelForEvent,
  minutesSinceHeartbeat,
  processEvents,
  resolveEventsPath
} from "./workflow-watch.js";

function makeEvent(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    actor: "test",
    cwd: "/repo",
    eventId: "evt-1",
    eventType: "workflow-note",
    runId: "2026-01-01T000000-000-implementation-abc12345",
    timestamp: new Date().toISOString(),
    workflow: "implementation",
    ...overrides
  };
}

describe("resolveEventsPath", () => {
  it("includes the run ID directory and events.ndjson filename", () => {
    const runId = "2026-03-21T120000-000-implementation-abc12345";
    const eventsPath = resolveEventsPath(runId);
    expect(eventsPath).toContain("2026-03-21");
    expect(eventsPath).toContain(runId);
    expect(eventsPath).toContain("events.ndjson");
  });
});

describe("isStale", () => {
  it("returns false when heartbeat is recent", () => {
    const state = createWatchState("run-1");
    expect(isStale(state, { pollIntervalMs: 3000, staleHeartbeatMin: 10 })).toBe(false);
  });

  it("returns true when last heartbeat is older than threshold", () => {
    const state = createWatchState("run-1");
    state.lastHeartbeatAt = Date.now() - 11 * 60 * 1000;
    expect(isStale(state, { pollIntervalMs: 3000, staleHeartbeatMin: 10 })).toBe(true);
  });
});

describe("minutesSinceHeartbeat", () => {
  it("returns 0 for a fresh state", () => {
    const state = createWatchState("run-1");
    expect(minutesSinceHeartbeat(state)).toBe(0);
  });

  it("returns floored minutes for older heartbeat", () => {
    const state = createWatchState("run-1");
    state.lastHeartbeatAt = Date.now() - 7.9 * 60 * 1000;
    expect(minutesSinceHeartbeat(state)).toBe(7);
  });
});

describe("isHeartbeatEvent", () => {
  it("considers execution-start a heartbeat", () => {
    expect(isHeartbeatEvent(makeEvent({ eventType: "execution-start" }))).toBe(true);
  });

  it("considers execution-end a heartbeat", () => {
    expect(isHeartbeatEvent(makeEvent({ eventType: "execution-end" }))).toBe(true);
  });

  it("considers workflow-note a heartbeat", () => {
    expect(isHeartbeatEvent(makeEvent({ eventType: "workflow-note" }))).toBe(true);
  });

  it("considers artifact-recorded with kind=heartbeat a heartbeat", () => {
    expect(
      isHeartbeatEvent(
        makeEvent({ eventType: "artifact-recorded", metadata: { kind: "heartbeat" } })
      )
    ).toBe(true);
  });

  it("does not consider workflow-start a heartbeat", () => {
    expect(isHeartbeatEvent(makeEvent({ eventType: "workflow-start" }))).toBe(false);
  });
});

describe("isApprovalGateEvent", () => {
  it("detects approval gate keyword in workflow-note message", () => {
    expect(
      isApprovalGateEvent(
        makeEvent({ eventType: "workflow-note", metadata: { message: "approval.gate fired" } })
      )
    ).toBe(true);
  });

  it("detects 'awaiting approval' in message", () => {
    expect(
      isApprovalGateEvent(
        makeEvent({ eventType: "workflow-note", metadata: { message: "awaiting approval from human" } })
      )
    ).toBe(true);
  });

  it("returns false for regular workflow-note", () => {
    expect(
      isApprovalGateEvent(
        makeEvent({ eventType: "workflow-note", metadata: { message: "starting step 2" } })
      )
    ).toBe(false);
  });

  it("returns false for non-note events", () => {
    expect(isApprovalGateEvent(makeEvent({ eventType: "execution-start" }))).toBe(false);
  });
});

describe("labelForEvent", () => {
  it("labels workflow-start with workflow name and task", () => {
    const label = labelForEvent(makeEvent({ eventType: "workflow-start", task: "fix bug" }));
    expect(label).toContain("workflow started");
    expect(label).toContain("implementation");
    expect(label).toContain("fix bug");
  });

  it("labels workflow-end with status", () => {
    const label = labelForEvent(makeEvent({ eventType: "workflow-end", status: "success" }));
    expect(label).toContain("workflow ended");
    expect(label).toContain("success");
  });

  it("labels execution-start with kind and name", () => {
    const label = labelForEvent(
      makeEvent({ eventType: "execution-start", executionKind: "skill", executionName: "impl" })
    );
    expect(label).toContain("skill");
    expect(label).toContain("impl");
  });

  it("labels execution-end with duration", () => {
    const label = labelForEvent(
      makeEvent({
        eventType: "execution-end",
        executionKind: "tool",
        executionName: "read",
        durationMs: 1500,
        status: "success"
      })
    );
    expect(label).toContain("1.5s");
    expect(label).toContain("success");
  });

  it("labels heartbeat artifacts specially", () => {
    const label = labelForEvent(
      makeEvent({
        eventType: "artifact-recorded",
        metadata: { kind: "heartbeat", message: "step 3 done" }
      })
    );
    expect(label).toContain("heartbeat");
    expect(label).toContain("step 3 done");
  });
});

describe("processEvents", () => {
  it("updates lastHeartbeatAt when a heartbeat event is processed", () => {
    const state = createWatchState("run-1");
    state.lastHeartbeatAt = Date.now() - 5 * 60 * 1000; // 5m ago
    const before = state.lastHeartbeatAt;

    processEvents([makeEvent({ eventType: "execution-start", eventId: "e1" })], state);

    expect(state.lastHeartbeatAt).toBeGreaterThan(before);
  });

  it("marks approval gate events", () => {
    const state = createWatchState("run-1");
    const lines = processEvents(
      [
        makeEvent({
          eventType: "workflow-note",
          eventId: "e1",
          metadata: { message: "awaiting approval from human" }
        })
      ],
      state
    );

    expect(lines[0]?.kind).toBe("event");
    if (lines[0]?.kind === "event") {
      expect(lines[0].isGate).toBe(true);
    }
  });

  it("emits one line per event", () => {
    const state = createWatchState("run-1");
    const events = [
      makeEvent({ eventId: "e1", eventType: "execution-start" }),
      makeEvent({ eventId: "e2", eventType: "execution-end" })
    ];
    const lines = processEvents(events, state);
    expect(lines).toHaveLength(2);
  });
});
