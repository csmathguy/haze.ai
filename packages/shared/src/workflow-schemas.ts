import { z } from "zod";

// ============================================================================
// Core Enums and Schemas
// ============================================================================

export const WorkflowRunStatusSchema = z.enum([
  "pending",
  "running",
  "paused",
  "waiting",
  "failed",
  "completed",
  "cancelled"
]);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;

export const StepNodeTypeSchema = z.enum([
  "deterministic",
  "agent",
  "approval",
  "wait"
]);
export type StepNodeType = z.infer<typeof StepNodeTypeSchema>;

// ============================================================================
// Workflow Step Types (Discriminated Union)
// ============================================================================

export const CommandStepSchema = z.object({
  type: z.literal("command"),
  id: z.string().min(1),
  label: z.string().min(1),
  scriptPath: z.string().min(1),
  args: z.array(z.string()).optional(),
  timeoutMs: z.number().int().positive().optional(),
  retryPolicy: z.object({
    maxRetries: z.number().int().nonnegative(),
    backoffMs: z.number().int().nonnegative()
  }).optional()
});
export type CommandStep = z.infer<typeof CommandStepSchema>;

export const AgentStepSchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.literal("agent"),
    id: z.string().min(1),
    label: z.string().min(1),
    agentId: z.string().min(1),
    model: z.string().min(1),
    providerFamily: z.enum(["anthropic", "openai"]).optional().default("anthropic"),
    runtimeKind: z.enum(["claude-code-subagent", "codex-subagent", "api"]).optional().default("claude-code-subagent"),
    skillIds: z.array(z.string().min(1)),
    outputSchema: z.custom<z.ZodType>((val) => val instanceof z.ZodType),
    timeoutMs: z.number().int().positive().optional(),
    retryPolicy: z.object({
      maxRetries: z.number().int().nonnegative(),
      backoffMs: z.number().int().nonnegative()
    }).optional()
  })
);
export interface AgentStep {
  type: "agent";
  id: string;
  label: string;
  agentId: string;
  model: string;
  providerFamily?: "anthropic" | "openai";
  runtimeKind?: "claude-code-subagent" | "codex-subagent" | "api";
  skillIds: string[];
  outputSchema: z.ZodType;
  timeoutMs?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

export const ApprovalStepSchema = z.object({
  type: z.literal("approval"),
  id: z.string().min(1),
  label: z.string().min(1),
  prompt: z.string().min(1),
  timeoutMs: z.number().int().positive().optional()
});
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;

export const WaitForEventStepSchema = z.object({
  type: z.literal("wait-for-event"),
  id: z.string().min(1),
  label: z.string().min(1),
  eventType: z.string().min(1),
  correlationKey: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().optional()
});
export type WaitForEventStep = z.infer<typeof WaitForEventStepSchema>;

export const ConditionStepSchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.literal("condition"),
    id: z.string().min(1),
    label: z.string().min(1),
    condition: z.custom<(context: Record<string, unknown>) => boolean>(
      (val) => typeof val === "function"
    ),
    trueBranch: z.array(WorkflowStepSchema),
    falseBranch: z.array(WorkflowStepSchema)
  })
);
export interface ConditionStep {
  type: "condition";
  id: string;
  label: string;
  condition: (context: Record<string, unknown>) => boolean;
  trueBranch: WorkflowStep[];
  falseBranch: WorkflowStep[];
}

export const ParallelStepSchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.literal("parallel"),
    id: z.string().min(1),
    label: z.string().min(1),
    branches: z.array(z.array(WorkflowStepSchema))
  })
);
export interface ParallelStep {
  type: "parallel";
  id: string;
  label: string;
  branches: WorkflowStep[][];
}

export const ChildWorkflowStepSchema: z.ZodType = z.lazy(() =>
  z.object({
    type: z.literal("child-workflow"),
    id: z.string().min(1),
    label: z.string().min(1),
    workflowName: z.string().min(1),
    inputMapping: z.record(z.string(), z.string()).optional()
  })
);
export interface ChildWorkflowStep {
  type: "child-workflow";
  id: string;
  label: string;
  workflowName: string;
  inputMapping?: Record<string, string>;
}

export const TimerStepSchema = z.object({
  type: z.literal("timer"),
  id: z.string().min(1),
  label: z.string().min(1),
  durationMs: z.number().int().positive()
});
export type TimerStep = z.infer<typeof TimerStepSchema>;

export const WorkflowStepSchema: z.ZodType = z.union([
  CommandStepSchema,
  ApprovalStepSchema,
  WaitForEventStepSchema,
  TimerStepSchema
]);
export type WorkflowStep =
  | CommandStep
  | AgentStep
  | ApprovalStep
  | WaitForEventStep
  | ConditionStep
  | ParallelStep
  | ChildWorkflowStep
  | TimerStep;

// ============================================================================
// Workflow Definition
// ============================================================================

export const WorkflowDefinitionSchema: z.ZodType = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    version: z.string().min(1),
    triggers: z.array(z.string().min(1)),
    inputSchema: z.custom<z.ZodType>((val) => val instanceof z.ZodType),
    steps: z.array(WorkflowStepSchema),
    retryPolicy: z.object({
      maxRetries: z.number().int().nonnegative(),
      backoffMs: z.number().int().nonnegative()
    }).optional(),
    timeoutMs: z.number().int().positive().optional()
  })
);
export interface WorkflowDefinition {
  name: string;
  version: string;
  triggers: string[];
  inputSchema: z.ZodType;
  steps: WorkflowStep[];
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
  timeoutMs?: number;
}

// ============================================================================
// Workflow Run State
// ============================================================================

export const WorkflowRunSchema = z.object({
  id: z.string().min(1),
  definitionName: z.string().min(1),
  version: z.string().min(1),
  status: WorkflowRunStatusSchema,
  currentStepId: z.string().min(1).optional(),
  contextJson: z.record(z.string(), z.unknown()),
  correlationId: z.string().min(1).optional(),
  parentRunId: z.string().min(1).optional(),
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional()
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

// ============================================================================
// Workflow Step Run
// ============================================================================

export const WorkflowStepRunSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  stepId: z.string().min(1),
  stepType: z.string().min(1),
  nodeType: StepNodeTypeSchema,
  agentId: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  skillIds: z.array(z.string().min(1)).optional(),
  inputJson: z.record(z.string(), z.unknown()).optional(),
  outputJson: z.record(z.string(), z.unknown()).optional(),
  errorJson: z.object({
    message: z.string(),
    code: z.string().optional()
  }).optional(),
  retryCount: z.number().int().nonnegative(),
  startedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional()
});
export type WorkflowStepRun = z.infer<typeof WorkflowStepRunSchema>;

// ============================================================================
// Workflow Effects (Side Effects)
// ============================================================================

export const ExecuteStepEffectSchema = z.object({
  type: z.literal("execute-step"),
  step: z.custom<WorkflowStep>((val) => !!val && typeof val === "object")
});
export interface ExecuteStepEffect {
  type: "execute-step";
  step: WorkflowStep;
}

export const EmitEventEffectSchema = z.object({
  type: z.literal("emit-event"),
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional()
});
export interface EmitEventEffect {
  type: "emit-event";
  eventType: string;
  payload?: Record<string, unknown>;
}

export const CreateApprovalEffectSchema = z.object({
  type: z.literal("create-approval"),
  stepId: z.string().min(1),
  prompt: z.string().min(1),
  timeoutMs: z.number().int().positive().optional()
});
export interface CreateApprovalEffect {
  type: "create-approval";
  stepId: string;
  prompt: string;
  timeoutMs?: number;
}

export const StartChildWorkflowEffectSchema = z.object({
  type: z.literal("start-child-workflow"),
  workflowName: z.string().min(1),
  input: z.record(z.string(), z.unknown())
});
export interface StartChildWorkflowEffect {
  type: "start-child-workflow";
  workflowName: string;
  input: Record<string, unknown>;
}

export const CompleteRunEffectSchema = z.object({
  type: z.literal("complete-run"),
  output: z.record(z.string(), z.unknown()).optional()
});
export interface CompleteRunEffect {
  type: "complete-run";
  output?: Record<string, unknown>;
}

export const FailRunEffectSchema = z.object({
  type: z.literal("fail-run"),
  error: z.object({
    message: z.string(),
    code: z.string().optional()
  })
});
export interface FailRunEffect {
  type: "fail-run";
  error: {
    message: string;
    code?: string;
  };
}

export const WorkflowEffectSchema: z.ZodType = z.union([
  ExecuteStepEffectSchema,
  EmitEventEffectSchema,
  CreateApprovalEffectSchema,
  StartChildWorkflowEffectSchema,
  CompleteRunEffectSchema,
  FailRunEffectSchema
]);
export type WorkflowEffect =
  | ExecuteStepEffect
  | EmitEventEffect
  | CreateApprovalEffect
  | StartChildWorkflowEffect
  | CompleteRunEffect
  | FailRunEffect;

// ============================================================================
// Workflow Run Effect (State Transition Result)
// ============================================================================

export const WorkflowRunEffectSchema = z.object({
  nextRun: WorkflowRunSchema,
  effects: z.array(WorkflowEffectSchema)
});
export interface WorkflowRunEffect {
  nextRun: WorkflowRun;
  effects: WorkflowEffect[];
}

// ============================================================================
// Step Result (for advanceRun)
// ============================================================================

export const StepResultSchema = z.union([
  z.object({
    type: z.literal("success"),
    output: z.record(z.string(), z.unknown()).optional()
  }),
  z.object({
    type: z.literal("failure"),
    error: z.object({
      message: z.string(),
      code: z.string().optional()
    })
  })
]);
export type StepResult = z.infer<typeof StepResultSchema>;

// ============================================================================
// Workflow Event (for signalRun)
// ============================================================================

export const WorkflowEventSchema = z.object({
  type: z.string().min(1),
  correlationKey: z.string().min(1).optional(),
  payload: z.record(z.string(), z.unknown()).optional()
});
export interface WorkflowEvent {
  type: string;
  correlationKey?: string;
  payload?: Record<string, unknown>;
}
