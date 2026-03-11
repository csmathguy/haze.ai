import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { TestWorkspaceContext } from "./test/database.js";
import { createTestWorkspaceContext } from "./test/database.js";

interface WorkspaceResponse {
  snapshot: {
    assetLots: unknown[];
    documents: unknown[];
    localOnly: boolean;
    scenarios: {
      id: string;
    }[];
  };
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
    expect(payload.snapshot.documents).toEqual([]);
    expect(payload.snapshot.localOnly).toBe(true);
    expect(payload.snapshot.scenarios[0]?.id).toBe("scenario-fifo");

    await app.close();
  });
});
