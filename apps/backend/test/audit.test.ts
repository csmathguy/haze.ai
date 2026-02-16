import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { FileAuditSink } from "../src/audit.js";

describe("FileAuditSink", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  test("appends newline-delimited JSON records with hash chain and correlation ids", async () => {
    const dir = await mkdtemp(join(tmpdir(), "haze-audit-"));
    tempDirs.push(dir);

    const sink = new FileAuditSink(dir);

    await sink.record({
      eventType: "test_event_one",
      actor: "test",
      traceId: "trace-1",
      requestId: "request-1",
      userId: "user-1",
      payload: { sequence: 1 }
    });
    await sink.record({
      eventType: "test_event_two",
      actor: "test",
      payload: { sequence: 2 }
    });

    const dateKey = new Date().toISOString().slice(0, 10);
    const file = join(dir, dateKey, "events.json");
    const content = await readFile(file, "utf8");
    const rows = content
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    expect(rows).toHaveLength(2);

    const first = rows[0];
    const second = rows[1];

    expect(first.eventType).toBe("test_event_one");
    expect(first.traceId).toBe("trace-1");
    expect(first.requestId).toBe("request-1");
    expect(first.userId).toBe("user-1");
    expect(first.previousHash).toBeNull();
    expect(typeof first.hash).toBe("string");

    expect(second.eventType).toBe("test_event_two");
    expect(typeof second.traceId).toBe("string");
    expect(typeof second.requestId).toBe("string");
    expect(second.userId).toBeNull();
    expect(second.previousHash).toBe(first.hash);
    expect(typeof second.hash).toBe("string");
    expect(second.hash).not.toBe(first.hash);
  });

  test("removes audit folders older than retention window", async () => {
    const dir = await mkdtemp(join(tmpdir(), "haze-audit-"));
    tempDirs.push(dir);

    const now = new Date("2026-02-16T12:00:00.000Z");
    const sink = new FileAuditSink(dir, {
      retentionDays: 7,
      now: () => now
    });

    const oldFolder = join(dir, "2026-02-01");
    const keptFolder = join(dir, "2026-02-12");
    await mkdir(oldFolder, { recursive: true });
    await mkdir(keptFolder, { recursive: true });
    await writeFile(join(oldFolder, "events.json"), "", "utf8");
    await writeFile(join(keptFolder, "events.json"), "", "utf8");

    await sink.record({
      eventType: "retention_check",
      actor: "test"
    });

    await expect(readFile(join(oldFolder, "events.json"), "utf8")).rejects.toThrow();
    await expect(readFile(join(keptFolder, "events.json"), "utf8")).resolves.toBe("");
  });

  test("returns recent records and emits subscriber events", async () => {
    const dir = await mkdtemp(join(tmpdir(), "haze-audit-"));
    tempDirs.push(dir);

    const sink = new FileAuditSink(dir);
    const listener = vi.fn();
    const unsubscribe = sink.subscribe(listener);

    await sink.record({
      eventType: "event_one",
      actor: "test"
    });
    await sink.record({
      eventType: "event_two",
      actor: "test"
    });

    const recent = await sink.getRecent(1);
    expect(recent).toHaveLength(1);
    expect(recent[0].eventType).toBe("event_two");
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
  });
});
