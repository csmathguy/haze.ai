import { describe, it, expect } from "vitest";
import { executeCommandStep } from "./command-executor.js";

describe("CommandStepExecutor", () => {
  it("should execute a simple echo command successfully", async () => {
    const result = await executeCommandStep({
      stepId: "test-step-1",
      command: "echo",
      args: ["hello"]
    });

    expect(result.stepId).toBe("test-step-1");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello");
    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThan(0);
  });

  it("should capture command failures with non-zero exit code", async () => {
    const result = await executeCommandStep({
      stepId: "test-step-2",
      command: "sh",
      args: ["-c", "exit 1"]
    });

    expect(result.stepId).toBe("test-step-2");
    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
  });

  it("should separate stdout and stderr", async () => {
    const result = await executeCommandStep({
      stepId: "test-step-3",
      command: "sh",
      args: ["-c", "echo 'to stdout' && echo 'to stderr' >&2"]
    });

    expect(result.stdout).toContain("to stdout");
    expect(result.stderr).toContain("to stderr");
    expect(result.success).toBe(true);
  });

  it("should timeout long-running processes", async () => {
    const result = await executeCommandStep({
      stepId: "test-step-4",
      command: "sleep",
      args: ["10"],
      timeoutMs: 100
    });

    expect(result.stepId).toBe("test-step-4");
    expect(result.exitCode).toBe(-1);
    expect(result.success).toBe(false);
    // Should complete much faster than 10 seconds
    expect(result.durationMs).toBeLessThan(5000);
  });

  it("should pass through environment variables", async () => {
    const result = await executeCommandStep({
      stepId: "test-step-5",
      command: "sh",
      args: ["-c", "echo $TEST_VAR"],
      env: { TEST_VAR: "test-value" }
    });

    expect(result.stdout).toContain("test-value");
    expect(result.success).toBe(true);
  });

  it("should use default timeout of 30000ms", async () => {
    const result = await executeCommandStep({
      stepId: "test-step-6",
      command: "echo",
      args: ["quick"]
    });

    expect(result.durationMs).toBeLessThan(30000);
    expect(result.success).toBe(true);
  });

  it("should use repository root as default cwd", async () => {
    const result = await executeCommandStep({
      stepId: "test-step-7",
      command: "pwd",
      args: []
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim().length).toBeGreaterThan(0);
    expect(result.success).toBe(true);
  });

  it("should handle command not found gracefully", async () => {
    const result = await executeCommandStep({
      stepId: "test-step-8",
      command: "nonexistent-command-xyz",
      args: []
    });

    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
    expect(result.stderr.length).toBeGreaterThan(0);
  });
});
