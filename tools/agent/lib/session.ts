import { readFile } from "node:fs/promises";
import * as path from "node:path";

export const DEFAULT_SESSION_FILE = path.resolve(".agent-session.json");

export interface AgentSession {
  projectKey?: string;
  runId: string;
  startedAt: string;
  task?: string;
  workflowName: string;
  workItemId?: string;
}

export async function readAgentSession(filePath: string = DEFAULT_SESSION_FILE): Promise<AgentSession | undefined> {
  try {
    const contents = await readFile(filePath, "utf8");
    const raw = JSON.parse(contents) as Record<string, unknown>;

    if (typeof raw.runId !== "string" || typeof raw.workflowName !== "string" || typeof raw.startedAt !== "string") {
      return undefined;
    }

    const session: AgentSession = {
      runId: raw.runId,
      startedAt: raw.startedAt,
      workflowName: raw.workflowName
    };

    if (typeof raw.projectKey === "string") {
      session.projectKey = raw.projectKey;
    }

    if (typeof raw.task === "string") {
      session.task = raw.task;
    }

    if (typeof raw.workItemId === "string") {
      session.workItemId = raw.workItemId;
    }

    return session;
  } catch {
    return undefined;
  }
}
