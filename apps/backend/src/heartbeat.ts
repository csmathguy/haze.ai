import { NoopAuditSink, type AuditSink } from "./audit.js";
import { logger } from "./logger.js";
import type { Orchestrator } from "./orchestrator.js";

interface HeartbeatOptions {
  intervalMs: number;
  stallThresholdMs: number;
}

export class HeartbeatMonitor {
  private readonly options: HeartbeatOptions;
  private lastPulseAt = Date.now();
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly orchestrator: Orchestrator,
    options?: Partial<HeartbeatOptions>,
    private readonly audit: AuditSink = new NoopAuditSink()
  ) {
    this.options = {
      intervalMs: options?.intervalMs ?? 3_000,
      stallThresholdMs: options?.stallThresholdMs ?? 9_000
    };
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.options.intervalMs);

    logger.info(this.options, "heartbeat monitor started");
    void this.audit.record({
      eventType: "heartbeat_monitor_started",
      actor: "heartbeat",
      payload: {
        intervalMs: this.options.intervalMs,
        stallThresholdMs: this.options.stallThresholdMs
      }
    });
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = undefined;
    logger.info("heartbeat monitor stopped");
    void this.audit.record({
      eventType: "heartbeat_monitor_stopped",
      actor: "heartbeat"
    });
  }

  pulse(source: string): void {
    this.lastPulseAt = Date.now();
    logger.debug({ source, at: this.lastPulseAt }, "heartbeat pulse");
    void this.audit.record({
      eventType: "heartbeat_pulse",
      actor: "heartbeat",
      payload: { source, at: this.lastPulseAt }
    });
  }

  private async tick(): Promise<void> {
    const elapsedMs = Date.now() - this.lastPulseAt;

    if (elapsedMs >= this.options.stallThresholdMs && !this.orchestrator.isBusy()) {
      logger.warn(
        { elapsedMs, stallThresholdMs: this.options.stallThresholdMs },
        "orchestrator appears stalled; issuing wake"
      );
      await this.audit.record({
        eventType: "heartbeat_stall_detected",
        actor: "heartbeat",
        payload: {
          elapsedMs,
          stallThresholdMs: this.options.stallThresholdMs
        }
      });
      await this.orchestrator.wake("heartbeat_stall_recovery");
      this.lastPulseAt = Date.now();
    }
  }
}
