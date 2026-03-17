/**
 * Workflow types and utilities.
 */

export type WorkflowStatus = "pending" | "running" | "paused" | "failed" | "completed" | "cancelled";
export type WorkflowNodeType = "deterministic" | "agent" | "approval" | "wait";

export function getStatusColor(status: WorkflowStatus): "default" | "primary" | "error" | "success" | "info" | "warning" {
  switch (status) {
    case "pending":
      return "default";
    case "running":
      return "primary";
    case "paused":
      return "warning";
    case "failed":
      return "error";
    case "completed":
      return "success";
    case "cancelled":
      return "default";
    default:
      return "default";
  }
}

export function getNodeTypeColor(nodeType: WorkflowNodeType): "primary" | "secondary" | "error" | "info" | "success" | "warning" {
  switch (nodeType) {
    case "deterministic":
      return "primary";
    case "agent":
      return "secondary";
    case "approval":
      return "warning";
    case "wait":
      return "info";
    default:
      return "info";
  }
}
