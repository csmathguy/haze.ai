import { describe, expect, test, vi } from "vitest";
import {
  InvocationPolicyError,
  InvocationProviderNotFoundError,
  type InvocationProvider,
  InvocationService
} from "../src/invocation.js";

describe("InvocationService", () => {
  test("selects provider by project config and falls back to default provider", async () => {
    const audit = { record: vi.fn(async () => {}) };
    const cliProvider: InvocationProvider = {
      id: "codex_cli",
      mode: "cli",
      invoke: vi.fn(async () => ({ output: "cli-result" }))
    };
    const apiProvider: InvocationProvider = {
      id: "openai_api",
      mode: "api",
      invoke: vi.fn(async () => ({ output: "api-result" }))
    };

    const service = new InvocationService({
      audit,
      defaultProviderId: "codex_cli",
      providers: [cliProvider, apiProvider],
      projectConfigById: {
        "project-api": { providerId: "openai_api", model: "gpt-4.1" }
      }
    });

    const apiResult = await service.invoke({
      prompt: "hello",
      projectId: "project-api"
    });
    expect(apiResult.providerId).toBe("openai_api");
    expect(apiResult.mode).toBe("api");
    expect(apiResult.model).toBe("gpt-4.1");
    expect(apiProvider.invoke).toHaveBeenCalledOnce();

    const defaultResult = await service.invoke({
      prompt: "hello",
      projectId: "project-default"
    });
    expect(defaultResult.providerId).toBe("codex_cli");
    expect(defaultResult.mode).toBe("cli");
    expect(cliProvider.invoke).toHaveBeenCalledOnce();
  });

  test("blocks disallowed tools and models via centralized policy", async () => {
    const audit = { record: vi.fn(async () => {}) };
    const provider: InvocationProvider = {
      id: "codex_cli",
      mode: "cli",
      invoke: vi.fn(async () => ({ output: "ok" }))
    };
    const service = new InvocationService({
      audit,
      defaultProviderId: "codex_cli",
      providers: [provider],
      policy: {
        allowedTools: ["npm", "git"],
        blockedTools: ["rm"],
        allowedModels: ["gpt-4.1"],
        blockedModels: ["gpt-legacy"]
      }
    });

    await expect(
      service.invoke({
        prompt: "run",
        tools: ["rm"]
      })
    ).rejects.toMatchObject<Partial<InvocationPolicyError>>({
      reasonCode: "TOOL_BLOCKED"
    });

    await expect(
      service.invoke({
        prompt: "run",
        model: "gpt-legacy"
      })
    ).rejects.toMatchObject<Partial<InvocationPolicyError>>({
      reasonCode: "MODEL_BLOCKED"
    });

    await expect(
      service.invoke({
        prompt: "run",
        tools: ["powershell"]
      })
    ).rejects.toMatchObject<Partial<InvocationPolicyError>>({
      reasonCode: "TOOL_NOT_ALLOWED"
    });
  });

  test("emits correlated audit metadata around invocation lifecycle", async () => {
    const audit = { record: vi.fn(async () => {}) };
    const provider: InvocationProvider = {
      id: "openai_api",
      mode: "api",
      invoke: vi.fn(async () => ({ output: "response" }))
    };
    const service = new InvocationService({
      audit,
      defaultProviderId: "openai_api",
      providers: [provider]
    });

    const result = await service.invoke({
      prompt: "say hi",
      traceId: "trace-1",
      requestId: "request-1",
      taskId: "task-1",
      model: "gpt-4.1"
    });

    expect(result.traceId).toBe("trace-1");
    expect(result.requestId).toBe("request-1");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "invocation_requested",
        traceId: "trace-1",
        requestId: "request-1"
      })
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "invocation_completed",
        traceId: "trace-1",
        requestId: "request-1"
      })
    );
  });

  test("fails when configured provider is missing", async () => {
    const audit = { record: vi.fn(async () => {}) };
    const service = new InvocationService({
      audit,
      defaultProviderId: "missing-provider",
      providers: []
    });

    await expect(
      service.invoke({
        prompt: "run"
      })
    ).rejects.toBeInstanceOf(InvocationProviderNotFoundError);
  });
});
