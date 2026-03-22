import type { SaveBitcoinBasisProfileInput, SaveBitcoinLotSelectionInput, WorkspaceSnapshot } from "@taxes/shared";

interface WorkspaceResponse {
  snapshot: WorkspaceSnapshot;
}

interface UploadResponse {
  document: {
    fileName: string;
    id: string;
  };
}

export interface SaveQuestionnaireResponseInput {
  promptKey: string;
  sourceDocumentId?: string;
  sourceGapId?: string;
  taxYear: number;
  value: string;
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

export async function saveQuestionnaireResponse(input: SaveQuestionnaireResponseInput): Promise<void> {
  const response = await fetch("/api/questionnaire-responses", {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`Questionnaire save failed with ${response.status.toString()}.`);
  }
}

export async function saveBitcoinBasisProfile(input: SaveBitcoinBasisProfileInput): Promise<void> {
  const response = await fetch("/api/bitcoin-basis-profile", {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`BTC basis save failed with ${response.status.toString()}.`);
  }
}

export async function saveBitcoinLotSelection(input: SaveBitcoinLotSelectionInput): Promise<void> {
  const response = await fetch("/api/bitcoin-lot-selections", {
    body: JSON.stringify(input),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`BTC lot selection save failed with ${response.status.toString()}.`);
  }
}
