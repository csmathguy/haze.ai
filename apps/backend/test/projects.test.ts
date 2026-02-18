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
    expect(created.requirements).toEqual([]);

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

  test("stores and updates project requirements with lifecycle metadata", async () => {
    const service = new ProjectWorkflowService({
      now: () => new Date("2026-02-18T00:00:00.000Z")
    });

    const created = await service.create({
      name: "Requirements Project",
      requirements: [
        {
          title: "Support queue retries",
          description: "Task retries should be configurable",
          type: "functional",
          status: "approved",
          priority: 2
        }
      ]
    });

    expect(created.requirements).toHaveLength(1);
    expect(created.requirements[0]).toMatchObject({
      title: "Support queue retries",
      type: "functional",
      status: "approved",
      priority: 2
    });
    expect(created.requirements[0].createdAt).toBe("2026-02-18T00:00:00.000Z");

    const updated = await service.update(created.id, {
      requirements: [
        ...created.requirements,
        {
          title: "p95 API latency under 400ms",
          type: "non-functional",
          priority: 1
        }
      ]
    });

    expect(updated.requirements).toHaveLength(2);
    expect(updated.requirements[0].id).toBe(created.requirements[0].id);
    expect(updated.requirements[1]).toMatchObject({
      title: "p95 API latency under 400ms",
      type: "non_functional",
      status: "proposed",
      priority: 1
    });
  });
});

