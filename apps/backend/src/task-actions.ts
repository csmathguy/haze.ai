import type { CreateTaskInput, TaskRecord } from "./tasks.js";
import { TaskWorkflowService } from "./tasks.js";

export class TaskActions {
  constructor(private readonly workflow: TaskWorkflowService) {}

  async addTask(input: CreateTaskInput): Promise<TaskRecord> {
    return this.workflow.create(input);
  }

  async nextTask(): Promise<TaskRecord | null> {
    return this.workflow.claimNextTask();
  }
}
