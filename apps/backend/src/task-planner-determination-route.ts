import type express from "express";
import type {
  TaskPlannerDeterminationInput,
  TaskWorkflowService
} from "./tasks.js";

interface PlannerDeterminationRouteOptions {
  app: express.Express;
  tasks: TaskWorkflowService;
  handleTaskError: (error: unknown, res: express.Response) => boolean;
  handleUnexpectedTaskError: (
    error: unknown,
    res: express.Response,
    operation: string
  ) => void;
}

export function registerTaskPlannerDeterminationRoute(
  options: PlannerDeterminationRouteOptions
): void {
  const { app, tasks, handleTaskError, handleUnexpectedTaskError } = options;

  app.post("/tasks/:id/planner-determination", async (req, res) => {
    try {
      const input = (req.body ?? {}) as TaskPlannerDeterminationInput;
      const record = await tasks.recordPlannerDetermination(req.params.id, input);
      res.status(201).json({ record: tasks.getWithDependents(record.id) });
    } catch (error) {
      if (!handleTaskError(error, res)) {
        handleUnexpectedTaskError(error, res, "record_planner_determination");
      }
    }
  });
}
