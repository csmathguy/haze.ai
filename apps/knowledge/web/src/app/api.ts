import type {
  CreateKnowledgeEntryDraftInput,
  CreateKnowledgeSubjectDraftInput,
  KnowledgeWorkspace
} from "@taxes/shared";

export async function fetchKnowledgeWorkspace(): Promise<KnowledgeWorkspace> {
  const response = await fetch("/api/knowledge/workspace");
  return parseJsonResponse<{ workspace: KnowledgeWorkspace }>(response, "Failed to load the knowledge workspace.").then(
    (payload) => payload.workspace
  );
}

export async function createKnowledgeSubject(input: CreateKnowledgeSubjectDraftInput): Promise<void> {
  await sendJsonRequest("/api/knowledge/subjects", "POST", input);
}

export async function createKnowledgeEntry(input: CreateKnowledgeEntryDraftInput): Promise<void> {
  await sendJsonRequest("/api/knowledge/entries", "POST", input);
}

export async function syncRepositoryDocs(): Promise<void> {
  await sendJsonRequest("/api/knowledge/bootstrap/repository-docs", "POST");
}

async function sendJsonRequest(url: string, method: "POST" | "PATCH", body?: unknown): Promise<void> {
  const response = await fetch(url, {
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" }
        }),
    method
  });

  await parseJsonResponse(response, `Knowledge request ${method} ${url} failed.`);
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as { error?: string } | T | null;

  if (!response.ok) {
    const errorMessage = payload !== null && typeof payload === "object" && "error" in payload ? payload.error : undefined;
    throw new Error(errorMessage ?? fallbackMessage);
  }

  return payload as T;
}
