import { describe, expect, it } from "vitest";
import { z } from "zod";

import { CodeReviewWorkspaceSchema } from "@taxes/shared";

import { buildApp } from "./app.js";

describe("code review app", () => {
  it("exposes a local-only health endpoint", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      localOnly: true,
      service: "code-review",
      status: "ok"
    });

    await app.close();
  });

  it("returns the code review workspace scaffold", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/code-review/workspace"
    });
    const payload = z.object({ workspace: CodeReviewWorkspaceSchema }).parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(payload.workspace.localOnly).toBe(true);
    expect(payload.workspace.lanes.some((lane) => lane.id === "tests")).toBe(true);
    expect(payload.workspace.roadmap.some((item) => item.stage === "mvp")).toBe(true);

    await app.close();
  });
});
