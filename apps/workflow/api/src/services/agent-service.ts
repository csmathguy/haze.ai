import type { Agent, PrismaClient } from "@taxes/db";

export interface AgentCreateInput {
  name: string;
  description?: string | undefined;
  model?: string | undefined;
  tier?: string | undefined;
  allowedSkillIds?: string | undefined;
  version?: string | undefined;
  metadata?: string | undefined;
}

export interface AgentUpdateInput {
  name?: string;
  description?: string | undefined;
  model?: string | undefined;
  tier?: string | undefined;
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
  return prisma.agent.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.model !== undefined ? { model: data.model } : {}),
      ...(data.tier !== undefined ? { tier: data.tier } : {}),
      ...(data.allowedSkillIds !== undefined ? { allowedSkillIds: data.allowedSkillIds } : {}),
      ...(data.version !== undefined ? { version: data.version } : {}),
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
      ...(data.status !== undefined ? { status: data.status } : {})
    }
  });
}
