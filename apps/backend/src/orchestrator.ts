import { NoopAuditSink, type AuditSink } from "./audit.js";
import { logger } from "./logger.js";

export interface Orchestrator {
  isBusy(): boolean;
  wake(reason: string): Promise<void>;
}

export class BasicOrchestrator implements Orchestrator {
  private busy = false;
  private lastWakeReason = "startup";

  constructor(private readonly audit: AuditSink = new NoopAuditSink()) {}

  isBusy(): boolean {
    return this.busy;
  }

  async wake(reason: string): Promise<void> {
    if (this.busy) {
      logger.debug({ reason }, "orchestrator already busy");
      await this.audit.record({
        eventType: "orchestrator_wake_skipped_busy",
        actor: "orchestrator",
        payload: { reason }
      });
      return;
    }

    this.busy = true;
    this.lastWakeReason = reason;
    logger.info({ reason }, "orchestrator wake requested");
    await this.audit.record({
      eventType: "orchestrator_wake_requested",
      actor: "orchestrator",
      payload: { reason }
    });

    try {
      await this.performCycle();
    } finally {
      this.busy = false;
    }
  }

  getStatus(): { busy: boolean; lastWakeReason: string } {
    return {
      busy: this.busy,
      lastWakeReason: this.lastWakeReason
    };
  }

  private async performCycle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    logger.info("orchestrator cycle completed");
    await this.audit.record({
      eventType: "orchestrator_cycle_completed",
      actor: "orchestrator"
    });
  }
}
