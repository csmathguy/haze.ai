import type { WorkspaceSnapshot } from "@taxes/shared";

interface WorkspaceResponse {
  snapshot: WorkspaceSnapshot;
}

interface UploadResponse {
  document: {
    fileName: string;
    id: string;
  };
}

export async function fetchWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const response = await fetch("/api/workspace");

  if (!response.ok) {
    throw new Error(`Workspace request failed with ${response.status.toString()}.`);
  }

  const payload = (await response.json()) as WorkspaceResponse;
  return payload.snapshot;
}

export async function uploadTaxDocument(file: File): Promise<string> {
  const formData = new FormData();

  formData.set("file", file);

  const response = await fetch("/api/documents", {
    body: formData,
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status.toString()}.`);
  }

  const payload = (await response.json()) as UploadResponse;
  return payload.document.id;
}
