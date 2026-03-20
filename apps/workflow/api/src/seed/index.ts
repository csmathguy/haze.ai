import type { PrismaClient } from "@taxes/db";
import { seedAgents } from "./agents.js";
import { seedSkills } from "./skills.js";
import { seedImplementationWorkflow } from "./implementation-workflow.js";

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  console.warn("Seeding agents...");
  await seedAgents(prisma);
  console.warn("Agents seeded successfully.");

  console.warn("Seeding skills...");
  await seedSkills(prisma);
  console.warn("Skills seeded successfully.");

  console.warn("Seeding workflows...");
  await seedImplementationWorkflow(prisma);
  console.warn("Workflows seeded successfully.");
}
