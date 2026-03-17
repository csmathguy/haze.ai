import type { PrismaClient } from "@taxes/db";

interface AgentSeedData {
  name: string;
  description: string;
  modelTier: string;
  capabilities: string[];
}

const SEED_AGENTS: AgentSeedData[] = [
  {
    name: "code-reviewer",
    description: "Review a diff, branch, or set of files for architecture boundary violations, privacy-sensitive handling, quality concerns, and PR readiness.",
    modelTier: "1",
    capabilities: ["code-review", "architecture-analysis", "privacy-audit", "quality-check"]
  },
  {
    name: "research",
    description: "Fetch and summarize external documentation, compare sources, verify dated claims, or turn external guidance into repository documentation input.",
    modelTier: "1",
    capabilities: ["web-search", "documentation-review", "source-analysis", "knowledge-synthesis"]
  },
  {
    name: "orchestrator",
    description: "Break work into parallel slices with independent seams, minimize merge conflicts, and dispatch autonomous parallel agents.",
    modelTier: "3",
    capabilities: ["work-decomposition", "parallel-dispatch", "dependency-analysis", "conflict-avoidance"]
  },
  {
    name: "implementer",
    description: "Implement a bounded slice inside its own worktree with clear scope and local adherence to repository patterns.",
    modelTier: "2",
    capabilities: ["code-implementation", "testing", "refactoring", "validation"]
  },
  {
    name: "planner",
    description: "Create and refine planning work items, capture acceptance criteria, and link planned work to audit workflow IDs.",
    modelTier: "2",
    capabilities: ["work-planning", "backlog-management", "acceptance-criteria", "work-decomposition"]
  }
];

export async function seedAgents(prisma: PrismaClient): Promise<void> {
  for (const agent of SEED_AGENTS) {
    await prisma.agent.upsert({
      where: { name: agent.name },
      update: {
        description: agent.description,
        tier: agent.modelTier,
        status: "active"
      },
      create: {
        name: agent.name,
        description: agent.description,
        model: agent.name,
        tier: agent.modelTier,
        status: "active",
        version: "1.0.0",
        metadata: JSON.stringify({
          capabilities: agent.capabilities,
          createdAt: new Date().toISOString()
        })
      }
    });
  }
}
