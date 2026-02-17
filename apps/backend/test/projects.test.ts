import { describe, expect, test } from "vitest";
import {
  DEFAULT_PROJECT_ID,
  ProjectServiceError,
  ProjectWorkflowService
} from "../src/projects.js";

describe("ProjectWorkflowService", () => {
  test("creates default project and supports CRUD", async () => {
    const service = new ProjectWorkflowService();

    const defaults = service.list();
    expect(defaults.some((project) => project.id === DEFAULT_PROJECT_ID)).toBe(true);

    const created = await service.create({
      name: "Haze Product",
      repository: "csmathguy/haze.ai",
      description: "Primary application project"
    });
    expect(created.name).toBe("Haze Product");
    expect(created.repository).toBe("csmathguy/haze.ai");

    const updated = await service.update(created.id, {
      repository: "github.com/csmathguy/haze.ai"
    });
    expect(updated.repository).toBe("github.com/csmathguy/haze.ai");

    await service.delete(created.id);
    expect(service.exists(created.id)).toBe(false);
  });

  test("prevents deleting default project", async () => {
    const service = new ProjectWorkflowService();

    await expect(service.delete(DEFAULT_PROJECT_ID)).rejects.toMatchObject<ProjectServiceError>({
      statusCode: 409
    });
  });
});

