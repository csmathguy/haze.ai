/**
 * Workflow definitions registry.
 *
 * This module exports all workflow definitions that are available in the system.
 * Each definition is a TypeScript object that conforms to the WorkflowDefinition interface.
 */

export { implementationWorkflow } from "./implementation.workflow.js";
export { conflictRepairWorkflow } from "./conflict-repair.workflow.js";
