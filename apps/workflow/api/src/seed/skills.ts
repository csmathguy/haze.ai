import type { PrismaClient } from "@taxes/db";

interface SkillSeedData {
  name: string;
  description: string;
  category?: string;
}

const SEED_SKILLS: SkillSeedData[] = [
  {
    name: "implementation-workflow",
    description: "Use this skill when implementing, refactoring, testing, or restructuring code in this repository. Apply it for changes in apps/*/web, apps/*/api, packages/shared, tooling, tests, or architecture docs.",
    category: "development"
  },
  {
    name: "planning-workflow",
    description: "Use this skill when scoping work, creating or refining backlog items, recording acceptance criteria, or linking planned work to audit workflow IDs.",
    category: "planning"
  },
  {
    name: "research-agent",
    description: "Use this skill when researching a topic, comparing sources, verifying dated claims, or turning external guidance into repository documentation, workflows, or new agent skills.",
    category: "research"
  },
  {
    name: "knowledge-agent",
    description: "Use this skill when an agent needs to read, write, or synchronize the repository's local knowledge base and long-term memory store.",
    category: "knowledge"
  },
  {
    name: "workflow-audit",
    description: "Use this skill when work in this repository needs explicit audit logging, workflow start/end markers, deterministic wrapper scripts for validation commands, or live visibility in the shared audit monitor.",
    category: "audit"
  },
  {
    name: "parallel-work-orchestrator",
    description: "Use this skill when a feature or refactor should be decomposed into parallel agent slices. Apply it for worktree planning, seam ownership, dependency ordering, and autonomous parallel dispatch.",
    category: "orchestration"
  },
  {
    name: "parallel-work-implementer",
    description: "Use this skill when implementing one pre-scoped parallel slice inside its own worktree. Apply it for bounded execution, local brief adherence, and low-conflict handoffs.",
    category: "implementation"
  },
  {
    name: "ui-design-workflow",
    description: "Use this skill when designing or refining the frontend for this repository, including React components, forms, review screens, charts, tables, MUI theming, and accessibility decisions.",
    category: "frontend"
  },
  {
    name: "visualization-workflow",
    description: "Use this skill when researching, choosing, or producing diagrams and visuals for this repository, including architecture diagrams, PR change visuals, workflow monitoring views, and dashboards.",
    category: "visualization"
  },
  {
    name: "local-development-environment",
    description: "Use this skill when you need to start one or more repository web and API products locally for manual testing, UI review, or cross-app validation.",
    category: "devops"
  },
  {
    name: "workflow-retrospective",
    description: "Use this skill when asked to write a retrospective, postmortem, workflow debrief, or improvement review for work in this repository.",
    category: "reflection"
  }
];

export async function seedSkills(prisma: PrismaClient): Promise<void> {
  for (const skill of SEED_SKILLS) {
    await prisma.skill.upsert({
      where: {
        name_version: {
          name: skill.name,
          version: "1.0.0"
        }
      },
      update: {
        description: skill.description,
        category: skill.category || null,
        status: "active"
      },
      create: {
        name: skill.name,
        version: "1.0.0",
        description: skill.description,
        category: skill.category || null,
        status: "active",
        executionMode: "agent"
      }
    });
  }
}
