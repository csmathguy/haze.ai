import type {
  KnowledgeEntry,
  KnowledgeMemoryMetadata,
  KnowledgeMemoryTier
} from "@taxes/shared";

export interface KnowledgeMemoryContextPack {
  readonly entries: KnowledgeEntry[];
  readonly roles: string[];
  readonly tier: KnowledgeMemoryTier;
}

export interface KnowledgeMemoryPromotionInput {
  readonly agentRoles?: string[];
  readonly archiveEntry: KnowledgeEntry;
  readonly promotedAt: string;
  readonly sourceType?: KnowledgeMemoryMetadata["sourceType"];
  readonly sharedAcrossAgents?: boolean;
  readonly tier?: KnowledgeMemoryTier;
}

export function selectKnowledgeMemoryEntries(
  entries: KnowledgeEntry[],
  options: {
    readonly agentRole?: string;
    readonly namespace?: string;
    readonly sourceType?: KnowledgeMemoryMetadata["sourceType"];
    readonly tier?: KnowledgeMemoryTier;
  }
): KnowledgeEntry[] {
  return entries.filter((entry) => isSelectableMemoryEntry(entry, options));
}

export function buildKnowledgeMemoryContextPack(
  entries: KnowledgeEntry[],
  options: {
    readonly agentRole: string;
    readonly namespace?: string;
    readonly tier?: KnowledgeMemoryTier;
    readonly limit?: number;
  }
): KnowledgeMemoryContextPack {
  const tier = options.tier ?? "medium-term";
  const selected = selectKnowledgeMemoryEntries(entries, {
    agentRole: options.agentRole,
    namespace: options.namespace,
    tier
  }).slice(0, options.limit ?? 8);

  return {
    entries: selected,
    roles: [options.agentRole],
    tier
  };
}

export function promoteArchivedKnowledgeMemory(
  input: KnowledgeMemoryPromotionInput
): KnowledgeMemoryMetadata {
  const current = input.archiveEntry.content.memory;

  return {
    agentRoles: resolveAgentRoles(input.agentRoles, current?.agentRoles),
    confidence: resolveConfidence(current?.confidence),
    lastReactivatedAt: input.promotedAt,
    promotedAt: input.promotedAt,
    reactivationCount: resolveReactivationCount(current?.reactivationCount),
    reviewState: resolveReviewState(current?.reviewState),
    sharedAcrossAgents: resolveSharedAcrossAgents(input.sharedAcrossAgents, current?.sharedAcrossAgents),
    sourceType: resolveSourceType(input.sourceType, current?.sourceType),
    tier: resolveTier(input.tier)
  };
}

function resolveAgentRoles(override: string[] | undefined, current: string[] | undefined): string[] {
  return override ?? current ?? [];
}

function resolveConfidence(confidence: KnowledgeMemoryMetadata["confidence"] | undefined): KnowledgeMemoryMetadata["confidence"] {
  return confidence ?? "medium";
}

function resolveReactivationCount(count: number | undefined): number {
  return (count ?? 0) + 1;
}

function resolveReviewState(
  reviewState: KnowledgeMemoryMetadata["reviewState"] | undefined
): KnowledgeMemoryMetadata["reviewState"] {
  return reviewState === "needs-human-review" ? "needs-human-review" : "approved";
}

function resolveSharedAcrossAgents(override: boolean | undefined, current: boolean | undefined): boolean {
  return override ?? current ?? false;
}

function resolveSourceType(
  override: KnowledgeMemoryMetadata["sourceType"] | undefined,
  current: KnowledgeMemoryMetadata["sourceType"] | undefined
): KnowledgeMemoryMetadata["sourceType"] {
  return override ?? current ?? "agent-inferred";
}

function resolveTier(override: KnowledgeMemoryTier | undefined): KnowledgeMemoryTier {
  return override ?? "medium-term";
}

function isSelectableMemoryEntry(
  entry: KnowledgeEntry,
  options: {
    readonly agentRole?: string;
    readonly namespace?: string;
    readonly sourceType?: KnowledgeMemoryMetadata["sourceType"];
    readonly tier?: KnowledgeMemoryTier;
  }
): boolean {
  if (!isMemoryKind(entry.kind)) return false;
  if (!hasMemoryMetadata(entry)) return false;
  if (entry.content.memory.reviewState === "rejected") return false;
  if (!matchesNamespace(entry.namespace, options.namespace)) return false;
  if (!matchesTier(entry.content.memory.tier, options.tier)) return false;
  if (!matchesSourceType(entry.content.memory.sourceType, options.sourceType)) return false;
  if (!matchesAgentRole(entry.content.memory.agentRoles, options.agentRole)) return false;

  return true;
}

function isMemoryKind(kind: KnowledgeEntry["kind"]): boolean {
  return kind === "agent-memory" || kind === "profile-note";
}

function hasMemoryMetadata(entry: KnowledgeEntry): entry is KnowledgeEntry & { content: { memory: KnowledgeMemoryMetadata } } {
  return entry.content.memory !== undefined;
}

function matchesNamespace(namespace: string, expected: string | undefined): boolean {
  return expected === undefined || namespace === expected;
}

function matchesTier(tier: KnowledgeMemoryTier, expected: KnowledgeMemoryTier | undefined): boolean {
  return expected === undefined || tier === expected;
}

function matchesSourceType(
  sourceType: KnowledgeMemoryMetadata["sourceType"],
  expected: KnowledgeMemoryMetadata["sourceType"] | undefined
): boolean {
  return expected === undefined || sourceType === expected;
}

function matchesAgentRole(agentRoles: string[], agentRole: string | undefined): boolean {
  return agentRole === undefined || agentRoles.length === 0 || agentRoles.includes(agentRole);
}
