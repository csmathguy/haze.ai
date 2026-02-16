import { appendFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { join } from "node:path";
import { logger } from "./logger.js";

export interface AuditEventInput {
  eventType: string;
  actor: string;
  traceId?: string;
  requestId?: string;
  userId?: string | null;
  payload?: Record<string, unknown>;
}

export interface AuditEventRecord extends AuditEventInput {
  id: string;
  timestamp: string;
  traceId: string;
  requestId: string;
  userId: string | null;
  previousHash: string | null;
  hash: string;
}

export interface AuditSink {
  record(event: AuditEventInput): Promise<void>;
}

type AuditSubscriber = (record: AuditEventRecord) => void;

export class NoopAuditSink implements AuditSink {
  async record(): Promise<void> {
    return Promise.resolve();
  }
}

interface FileAuditSinkOptions {
  now?: () => Date;
  retentionDays?: number;
}

export class FileAuditSink implements AuditSink {
  private readonly now: () => Date;
  private readonly retentionDays: number;
  private readonly lastHashByFilePath = new Map<string, string>();
  private readonly subscribers = new Set<AuditSubscriber>();
  private lastRetentionSweepAt = 0;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly baseDir: string,
    options?: FileAuditSinkOptions
  ) {
    this.now = options?.now ?? (() => new Date());
    this.retentionDays = Math.max(1, options?.retentionDays ?? 7);
  }

  async record(event: AuditEventInput): Promise<void> {
    const operation = this.writeQueue.then(async () => {
      const now = this.now();
      const timestamp = now.toISOString();
      const dateKey = timestamp.slice(0, 10);
      const dir = join(this.baseDir, dateKey);
      const filePath = join(dir, "events.json");

      try {
        await mkdir(dir, { recursive: true });
        await this.pruneOldDirectoriesIfDue(now);

        const previousHash = await this.getPreviousHash(filePath);
        const baseRecord = {
          id: randomUUID(),
          timestamp,
          eventType: event.eventType,
          actor: event.actor,
          traceId: event.traceId ?? randomUUID(),
          requestId: event.requestId ?? randomUUID(),
          userId: event.userId ?? null,
          payload: event.payload ?? {},
          previousHash
        };
        const hash = createHash("sha256")
          .update(JSON.stringify(baseRecord))
          .digest("hex");
        const record: AuditEventRecord = {
          ...baseRecord,
          hash
        };

        await appendFile(filePath, `${JSON.stringify(record)}\n`, {
          encoding: "utf8"
        });
        this.lastHashByFilePath.set(filePath, hash);
        this.broadcast(record);
      } catch (error) {
        logger.error({ error, filePath }, "failed to append audit event");
      }
    });

    this.writeQueue = operation.catch(() => undefined);
    await operation;
  }

  subscribe(listener: AuditSubscriber): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  async getRecent(limit = 100): Promise<AuditEventRecord[]> {
    const cappedLimit = Math.max(1, Math.min(limit, 500));
    const records: AuditEventRecord[] = [];

    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true });
      const dateDirs = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => b.localeCompare(a));

      for (const dateDir of dateDirs) {
        if (records.length >= cappedLimit) {
          break;
        }

        const filePath = join(this.baseDir, dateDir, "events.json");
        try {
          const content = await readFile(filePath, "utf8");
          const rows = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          for (let index = rows.length - 1; index >= 0; index -= 1) {
            records.push(JSON.parse(rows[index]) as AuditEventRecord);
            if (records.length >= cappedLimit) {
              break;
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      return [];
    }

    return records;
  }

  private async getPreviousHash(filePath: string): Promise<string | null> {
    const cached = this.lastHashByFilePath.get(filePath);
    if (cached) {
      return cached;
    }

    try {
      const content = await readFile(filePath, "utf8");
      const rows = content
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (rows.length === 0) {
        return null;
      }

      const lastRecord = JSON.parse(rows[rows.length - 1]) as {
        hash?: string;
      };
      if (lastRecord.hash) {
        this.lastHashByFilePath.set(filePath, lastRecord.hash);
        return lastRecord.hash;
      }
    } catch {
      return null;
    }

    return null;
  }

  private async pruneOldDirectoriesIfDue(now: Date): Promise<void> {
    const nowMs = now.getTime();
    const oneHourMs = 60 * 60 * 1000;
    if (nowMs - this.lastRetentionSweepAt < oneHourMs) {
      return;
    }

    this.lastRetentionSweepAt = nowMs;

    const cutoffMs = nowMs - this.retentionDays * 24 * 60 * 60 * 1000;

    try {
      const entries = await readdir(this.baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const folderDate = new Date(`${entry.name}T00:00:00.000Z`);
        if (Number.isNaN(folderDate.getTime())) {
          continue;
        }

        if (folderDate.getTime() < cutoffMs) {
          await rm(join(this.baseDir, entry.name), {
            recursive: true,
            force: true
          });
        }
      }
    } catch (error) {
      logger.error({ error }, "failed to prune old audit directories");
    }
  }

  private broadcast(record: AuditEventRecord): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(record);
      } catch (error) {
        logger.error({ error }, "audit subscriber failed");
      }
    }
  }
}
