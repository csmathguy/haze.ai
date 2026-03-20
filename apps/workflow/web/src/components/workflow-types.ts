export interface WorkflowStep {
  id: string;
  type: "deterministic" | "agent" | "approval" | "condition" | "wait";
  label: string;
  scriptPath?: string;
  agentName?: string;
  model?: string;
  skills?: string[];
  timeout?: number;
  retryPolicy?: Record<string, unknown>;
  branches?: Record<string, string>;
  nextStep?: string;
}
