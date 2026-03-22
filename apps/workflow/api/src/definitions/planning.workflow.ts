import { z } from "zod";
import type {
  WorkflowDefinition,
  ApprovalStep,
  AgentStep
} from "@taxes/shared";

/**
 * Planning workflow definition — PO interview pipeline.
 *
 * A 4-phase structured discovery session that takes a raw idea and produces
 * a refined, ready-to-implement work item through Socratic questioning,
 * A/B/C options framing, and iterative draft review.
 *
 * Phases:
 * 0. Entry — capture the raw idea or problem statement
 * 1. Discovery — JTBD-style questions to surface goals, constraints, and unknowns
 * 2. Options — three implementation paths (A: minimal, B: balanced, C: expansive)
 * 3. Draft — structured work item with acceptance criteria and implementation tasks
 */

const planningInputSchema = z.object({
  idea: z.string().min(1).describe("Raw idea, problem statement, or feature request to explore"),
  projectKey: z.string().optional().describe("Planning project to file the work item under (default: planning)")
});

// Phase 0: Entry point — accept the raw idea
const ideaCaptureApproval: ApprovalStep = {
  type: "approval",
  id: "phase-0-idea-capture",
  label: "Phase 0: Capture raw idea",
  prompt:
    "Describe your idea, problem, or opportunity in a few sentences. " +
    "What do you want to explore or build? What problem does it solve? " +
    "Why does it matter now?"
};

// Phase 1a: Discovery agent — generate JTBD-style questions
const discoveryQuestionsAgent: AgentStep = {
  type: "agent",
  id: "phase-1-discovery-questions",
  label: "Phase 1a: Generate discovery questions",
  agentId: "planning-discovery",
  model: "claude-sonnet-4.6-20250514",
  providerFamily: "anthropic",
  runtimeKind: "claude-code-subagent",
  skillIds: ["planning-workflow"],
  outputSchema: z.object({
    questions: z
      .array(z.string())
      .min(3)
      .max(5)
      .describe("3-5 JTBD-style discovery questions that surface goals, constraints, and unknowns"),
    ideaSummary: z
      .string()
      .describe("Brief synthesis of the idea as understood from the raw input")
  }),
  timeoutMs: 600000
};

// Phase 1b: Approval — user answers the discovery questions
const discoveryAnswersApproval: ApprovalStep = {
  type: "approval",
  id: "phase-1-discovery-answers",
  label: "Phase 1b: Answer discovery questions",
  prompt:
    "Review the discovery questions generated above. " +
    "Answer each question to help clarify scope, priority, and constraints. " +
    "Your answers will be used to generate implementation options."
};

// Phase 2a: Options agent — generate A/B/C framing
const optionsAgent: AgentStep = {
  type: "agent",
  id: "phase-2-options",
  label: "Phase 2a: Generate A/B/C options",
  agentId: "planning-options",
  model: "claude-sonnet-4.6-20250514",
  providerFamily: "anthropic",
  runtimeKind: "claude-code-subagent",
  skillIds: ["planning-workflow"],
  outputSchema: z.object({
    optionA: z.object({
      title: z.string().describe("Option A title (minimal / focused)"),
      description: z.string().describe("What this option does"),
      tradeoffs: z.string().describe("Key tradeoffs and constraints")
    }),
    optionB: z.object({
      title: z.string().describe("Option B title (balanced)"),
      description: z.string().describe("What this option does"),
      tradeoffs: z.string().describe("Key tradeoffs and constraints")
    }),
    optionC: z.object({
      title: z.string().describe("Option C title (expansive / ambitious)"),
      description: z.string().describe("What this option does"),
      tradeoffs: z.string().describe("Key tradeoffs and constraints")
    }),
    recommendation: z
      .string()
      .describe("Agent recommendation with rationale for which option fits best")
  }),
  timeoutMs: 600000
};

// Phase 2b: Approval — user picks an option
const optionSelectionApproval: ApprovalStep = {
  type: "approval",
  id: "phase-2-option-selection",
  label: "Phase 2b: Select your preferred option (A, B, or C)",
  prompt:
    "Review the three options above. " +
    "Select Option A (minimal), B (balanced), or C (expansive) and explain any refinements. " +
    "Your selection will be used to draft the final work item."
};

// Phase 3a: Draft agent — produce a structured work item
const draftWorkItemAgent: AgentStep = {
  type: "agent",
  id: "phase-3-draft-work-item",
  label: "Phase 3a: Draft structured work item",
  agentId: "planning-drafter",
  model: "claude-sonnet-4.6-20250514",
  providerFamily: "anthropic",
  runtimeKind: "claude-code-subagent",
  skillIds: ["planning-workflow"],
  outputSchema: z.object({
    title: z.string().min(1).describe("Work item title"),
    summary: z.string().min(1).describe("Work item summary explaining scope and value"),
    acceptanceCriteria: z
      .array(z.string())
      .min(1)
      .describe("Acceptance criteria as user-observable outcomes"),
    tasks: z.array(z.string()).describe("Implementation tasks in order"),
    kind: z.enum(["feature", "defect", "spike", "chore"]).describe("Work item kind"),
    priority: z.enum(["high", "medium", "low"]).describe("Priority level")
  }),
  timeoutMs: 600000
};

// Phase 3b: Approval — review and approve the draft
const draftReviewApproval: ApprovalStep = {
  type: "approval",
  id: "phase-3-draft-review",
  label: "Phase 3b: Review and approve the draft work item",
  prompt:
    "Review the drafted work item above. " +
    "Approve to commit it to the planning backlog as-is, " +
    "or provide feedback to refine the title, summary, acceptance criteria, or tasks."
};

/**
 * Complete planning workflow — PO interview pipeline.
 *
 * Steps:
 * 0. idea-capture: Collect raw idea from the user (approval gate)
 * 1. discovery-questions: Agent generates 3-5 JTBD discovery questions
 * 1b. discovery-answers: User answers the questions (approval gate)
 * 2. options: Agent generates A/B/C implementation options
 * 2b. option-selection: User picks an option (approval gate)
 * 3. draft-work-item: Agent drafts structured work item
 * 3b. draft-review: User reviews and approves (approval gate)
 */
export const planningWorkflow: WorkflowDefinition = {
  name: "planning",
  version: "1.0.0",
  triggers: ["manual"],
  inputSchema: planningInputSchema,
  steps: [
    // Phase 0: Entry
    ideaCaptureApproval,

    // Phase 1: Discovery
    discoveryQuestionsAgent,
    discoveryAnswersApproval,

    // Phase 2: Options
    optionsAgent,
    optionSelectionApproval,

    // Phase 3: Draft
    draftWorkItemAgent,
    draftReviewApproval
  ],
  retryPolicy: {
    maxRetries: 1,
    backoffMs: 3000
  },
  timeoutMs: 7200000 // 2 hours for the full session
};
