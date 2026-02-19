export interface WorkflowDispatchJob {
  key: string;
  taskId: string;
  actionId: string;
  actionType: string;
  runId: string;
  sessionId: string;
  processedAt: string;
  maxAttempts: number;
  attempt: number;
}

export interface WorkflowDispatchResult {
  job: WorkflowDispatchJob;
  status: "dispatched" | "failed";
  error: string | null;
}

interface WorkflowHookDispatcherOptions {
  dispatch: (job: WorkflowDispatchJob) => Promise<void>;
}

export class WorkflowHookDispatcher {
  private readonly dispatch: (job: WorkflowDispatchJob) => Promise<void>;
  private readonly queue: WorkflowDispatchJob[] = [];
  private readonly pendingKeys = new Set<string>();

  constructor(options: WorkflowHookDispatcherOptions) {
    this.dispatch = options.dispatch;
  }

  enqueue(job: WorkflowDispatchJob): boolean {
    if (this.pendingKeys.has(job.key)) {
      return false;
    }
    this.pendingKeys.add(job.key);
    this.queue.push(job);
    return true;
  }

  async processAll(): Promise<WorkflowDispatchResult[]> {
    const results: WorkflowDispatchResult[] = [];
    while (this.queue.length > 0) {
      const current = this.queue.shift();
      if (!current) {
        break;
      }
      try {
        await this.dispatch(current);
        this.pendingKeys.delete(current.key);
        results.push({
          job: current,
          status: "dispatched",
          error: null
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (current.attempt + 1 < current.maxAttempts) {
          this.queue.push({
            ...current,
            attempt: current.attempt + 1
          });
          continue;
        }
        this.pendingKeys.delete(current.key);
        results.push({
          job: current,
          status: "failed",
          error: message
        });
      }
    }

    return results;
  }
}
