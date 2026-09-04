import type { AuditSink } from "./audit.js";
import { PlanningAgentRunner, type PlanningAgentDecision } from "./planning-agent-runner.js";
import type { TaskRecord } from "./tasks.js";
import type { WorkflowDispatchJob } from "./workflow-hook-dispatcher.js";

export async function dispatchWorkerAction(input: {
  audit: AuditSink;
  sessionId: string | null;
  job: WorkflowDispatchJob;
}): Promise<void> {
  const { audit, sessionId, job } = input;
  await audit.record({
    eventType: "worker_action_dispatched",
    actor: "orchestrator_worker",
    payload: {
      taskId: job.taskId,
      sessionId,
      runId: job.runId,
      checkpointKey: job.key,
      actionId: job.actionId,
      actionType: job.actionType,
      attempts: job.attempt + 1
    }
  });
  if (job.attempt > 0) {
    await audit.record({
      eventType: "worker_action_dispatch_retried",
      actor: "orchestrator_worker",
      payload: {
        taskId: job.taskId,
        sessionId,
        runId: job.runId,
        checkpointKey: job.key,
        actionId: job.actionId,
        actionType: job.actionType,
        attempts: job.attempt + 1
      }
    });
  }
}

export async function evaluatePlanningTaskWithCli(
  task: TaskRecord
): Promise<PlanningAgentDecision> {
  const runner = new PlanningAgentRunner();
  return runner.evaluate(task);
}
