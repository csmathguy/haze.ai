import type { PrismaClient, WorkflowEvent } from "@taxes/db";

export interface WorkflowEventPayload {
  readonly workflowRunId: string;
  readonly eventType: string;    // e.g. "step.completed", "signal.received", "timer.fired"
  readonly payload: Record<string, unknown>;
}

export class EventBus {
  constructor(private readonly db: PrismaClient) {}

  /** Persist an event to WorkflowEvent table with status="pending" */
  async emit(event: WorkflowEventPayload): Promise<WorkflowEvent> {
    return this.db.workflowEvent.create({
      data: {
        type: event.eventType,
        source: "workflow",
        correlationId: event.workflowRunId,
        payload: JSON.stringify(event.payload)
      }
    });
  }

  /** Mark an event as processed */
  async markProcessed(eventId: string): Promise<void> {
    await this.db.workflowEvent.update({
      where: { id: eventId },
      data: { processedAt: new Date() }
    });
  }

  /** Mark an event as failed with error message */
  async markFailed(eventId: string, error: string): Promise<void> {
    await this.db.workflowEvent.update({
      where: { id: eventId },
      data: {
        metadata: JSON.stringify({ error })
      }
    });
  }

  /** Fetch pending events ordered by createdAt ASC, up to limit */
  async fetchPending(limit = 10): Promise<WorkflowEvent[]> {
    return this.db.workflowEvent.findMany({
      where: {
        processedAt: null
      },
      orderBy: {
        occurredAt: "asc"
      },
      take: limit
    });
  }
}
