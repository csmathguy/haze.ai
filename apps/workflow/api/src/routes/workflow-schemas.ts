import { z } from "zod";

export const AgentCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.string().optional(),
  tier: z.string().optional(),
  allowedSkillIds: z.string().optional(),
  version: z.string().optional(),
  metadata: z.string().optional()
});

export const SkillCreateSchema = z.object({
  name: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
  executionMode: z.string().optional(),
  permissions: z.string().optional()
});

export const WorkflowDefinitionCreateSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  triggers: z.array(z.string().min(1)),
  definitionJson: z.record(z.string(), z.unknown())
});

export const WorkflowRunCreateSchema = z.object({
  definitionName: z.string().min(1),
  input: z.unknown().optional(),
  workItemId: z.string().optional()
});

export const WorkflowRunSignalSchema = z.object({
  type: z.string().min(1),
  correlationKey: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});

export const WorkflowRunListParamsSchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().default(50)
});

export const RespondApprovalBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  respondedBy: z.string().min(1),
  notes: z.string().optional()
});
