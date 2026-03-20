import type { Agent, PrismaClient } from "@taxes/db";

export interface AgentCreateInput {
  name: string;
  description?: string | undefined;
  model?: string | undefined;
  tier?: string | undefined;
  providerFamily?: string | undefined;
  runtimeKind?: string | undefined;
  configSourcePath?: string | undefined;
  allowedSkillIds?: string | undefined;
  version?: string | undefined;
  metadata?: string | undefined;
}

export interface AgentUpdateInput {
  name?: string;
  description?: string | undefined;
  model?: string | undefined;
  tier?: string | undefined;
  providerFamily?: string | undefined;
  runtimeKind?: string | undefined;
  configSourcePath?: string | undefined;
  allowedSkillIds?: string | undefined;
  version?: string | undefined;
  metadata?: string | undefined;
  status?: string | undefined;
}

export async function listAgents(prisma: PrismaClient): Promise<Agent[]> {
  return prisma.agent.findMany({
    where: {
      status: "active"
    },
    orderBy: {
      createdAt: "asc"
    }
  });
}

export async function getAgent(prisma: PrismaClient, id: string): Promise<Agent | null> {
  return prisma.agent.findUnique({
    where: { id }
  });
}

export async function createAgent(prisma: PrismaClient, data: AgentCreateInput): Promise<Agent> {
  return prisma.agent.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      model: data.model ?? data.name,
      tier: data.tier ?? "2",
      providerFamily: data.providerFamily ?? "anthropic",
      runtimeKind: data.runtimeKind ?? "claude-code-subagent",
      configSourcePath: data.configSourcePath ?? null,
      allowedSkillIds: data.allowedSkillIds ?? null,
      version: data.version ?? "1.0.0",
      metadata: data.metadata ?? null,
      status: "active"
    }
  });
}

export async function updateAgent(
  prisma: PrismaClient,
  id: string,
  data: AgentUpdateInput
): Promise<Agent> {
  const updates = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .reduce<Record<string, string | undefined>>((acc, [key, value]) => {
      acc[key] = value as string | undefined;
      return acc;
    }, {});

  return prisma.agent.update({
    where: { id },
    data: updates as Parameters<typeof prisma.agent.update>[0]["data"]
  });
}
