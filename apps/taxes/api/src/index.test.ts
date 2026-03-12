import { afterEach, describe, expect, it } from "vitest";
import type { WorkspaceSnapshot } from "@taxes/shared";

import { buildApp } from "./app.js";
import type { TestWorkspaceContext } from "./test/database.js";
import { createTestWorkspaceContext } from "./test/database.js";

interface WorkspaceResponse {
  snapshot: WorkspaceSnapshot;
}

describe("buildApp", () => {
  const workspaces: TestWorkspaceContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("exposes a local-only health endpoint", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-health");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const response = await app.inject({
      method: "GET",
      url: "/api/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      localOnly: true,
      status: "ok"
    });

    await app.close();
  });

  it("returns the workspace snapshot envelope", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-workspace");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const response = await app.inject({
      method: "GET",
      url: "/api/workspace"
    });
    const payload: WorkspaceResponse = response.json();

    expect(response.statusCode).toBe(200);
    expect(payload.snapshot.assetLots).toEqual([]);
    expect(payload.snapshot.dataGaps).toEqual([]);
    expect(payload.snapshot.documents).toEqual([]);
    expect(payload.snapshot.extractions).toEqual([]);
    expect(payload.snapshot.localOnly).toBe(true);
    expect(payload.snapshot.questionnaire.length).toBeGreaterThan(0);
    expect(payload.snapshot.scenarios[0]?.id).toBe("scenario-fifo");

    await app.close();
  });

  it("persists questionnaire responses through the API", async () => {
    const workspace = await createTestWorkspaceContext("taxes-build-app-questionnaire");
    workspaces.push(workspace);
    const app = await buildApp(workspace);
    const saveResponse = await app.inject({
      method: "POST",
      payload: {
        promptKey: "optimization-capital-loss-carryover",
        taxYear: 2025,
        value: "yes"
      },
      url: "/api/questionnaire-responses"
    });
    const workspaceResponse = await app.inject({
      method: "GET",
      url: "/api/workspace"
    });
    const payload: WorkspaceResponse = workspaceResponse.json();

    expect(saveResponse.statusCode).toBe(204);
    expect(payload.snapshot.questionnaire.find((prompt) => prompt.key === "optimization-capital-loss-carryover")).toEqual(
      expect.objectContaining({
        currentValue: "yes"
      })
    );

    await app.close();
  });
});
