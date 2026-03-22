import type { PrismaClient } from "@taxes/db";
import { seedAgents } from "./agents.js";
import { seedSkills } from "./skills.js";
import { seedImplementationWorkflow } from "./implementation-workflow.js";
import { registerWorkflowDefinitions } from "./register-definitions.js";

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  try {
    console.warn("Seeding agents...");
    await seedAgents(prisma);
    console.warn("Agents seeded successfully.");

    console.warn("Seeding skills...");
    await seedSkills(prisma);
    console.warn("Skills seeded successfully.");

    console.warn("Seeding workflows...");
    await seedImplementationWorkflow(prisma);
    console.warn("Workflows seeded successfully.");

    console.warn("Registering workflow definitions...");
    await registerWorkflowDefinitions(prisma);
    console.warn("Workflow definitions registered successfully.");
  } catch (err) {
    // P2021 = table does not exist. Skip seeding in environments where migrations haven't run yet.
    const code = (err as Record<string, unknown>).code;
    if (code === "P2021") {
      console.warn("Database tables not found — skipping seed (run migrations to enable full seeding).");
      return;
    }
    throw err;
  }
}
