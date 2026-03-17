import type { PrismaClient } from "@taxes/db";
import { seedAgents } from "./agents.js";
import { seedSkills } from "./skills.js";

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  console.log("Seeding agents...");
  await seedAgents(prisma);
  console.log("Agents seeded successfully.");

  console.log("Seeding skills...");
  await seedSkills(prisma);
  console.log("Skills seeded successfully.");
}
