import { describe, expect, test } from "vitest";
import { resolveTaskBranchName } from "../../../scripts/resolve-task-branch-name.mjs";

describe("resolveTaskBranchName", () => {
  test("uses canonical task id when provided in T-##### format", () => {
    const branch = resolveTaskBranchName({
      taskId: "1fb98cee-0867-4f07-ba27-f5cff00185ce",
      canonicalTaskId: "T-00052",
      title: "Use canonical task ID in branch names"
    });

    expect(branch).toBe("task/t-00052-use-canonical-task-id-in-branch-names");
  });

  test("falls back to backend task id when canonical id is missing", () => {
    const branch = resolveTaskBranchName({
      taskId: "1fb98cee-0867-4f07-ba27-f5cff00185ce",
      title: "Use canonical task ID in branch names"
    });

    expect(branch).toBe("task/1fb98cee-0867-4f07-ba27-f5cff00185ce-use-canonical-task-id-in-branch-names");
  });

  test("falls back to backend task id when canonical id is invalid", () => {
    const branch = resolveTaskBranchName({
      taskId: "1fb98cee-0867-4f07-ba27-f5cff00185ce",
      canonicalTaskId: "task-52",
      title: "Use canonical task ID in branch names"
    });

    expect(branch).toBe("task/1fb98cee-0867-4f07-ba27-f5cff00185ce-use-canonical-task-id-in-branch-names");
  });
});
