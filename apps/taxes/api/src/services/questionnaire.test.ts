import { Readable } from "node:stream";

import type { MultipartFile } from "@fastify/multipart";
import { afterEach, describe, expect, it } from "vitest";

import { getPrismaClient } from "../db/client.js";
import type { TestWorkspaceContext } from "../test/database.js";
import { createTestWorkspaceContext } from "../test/database.js";
import { saveUploadedDocument } from "./document-store.js";
import { saveQuestionnaireResponse } from "./questionnaire.js";

describe("questionnaire service", () => {
  const workspaces: TestWorkspaceContext[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0, workspaces.length).map(async (workspace) => workspace.cleanup()));
  });

  it("upserts questionnaire responses by prompt key and tax year", async () => {
    const workspace = await createTestWorkspaceContext("taxes-questionnaire-service");
    workspaces.push(workspace);
    const document = await saveUploadedDocument(createMultipartFile("broker-1099-B.pdf"), 2025, workspace);
    const prisma = await getPrismaClient(workspace.databaseUrl);
    const gap = await prisma.dataGap.findFirstOrThrow({
      where: {
        documentId: document.id
      }
    });

    await saveQuestionnaireResponse(
      {
        promptKey: "optimization-capital-loss-carryover",
        sourceDocumentId: document.id,
        sourceGapId: gap.id,
        taxYear: 2025,
        value: "yes"
      },
      workspace
    );
    await saveQuestionnaireResponse(
      {
        promptKey: "optimization-capital-loss-carryover",
        sourceDocumentId: document.id,
        sourceGapId: gap.id,
        taxYear: 2025,
        value: "no"
      },
      workspace
    );

    const responses = await prisma.questionnaireResponse.findMany({
      where: {
        promptKey: "optimization-capital-loss-carryover",
        taxYear: 2025
      }
    });

    expect(responses).toHaveLength(1);
    expect(responses[0]).toEqual(
      expect.objectContaining({
        promptKey: "optimization-capital-loss-carryover",
        sourceDocumentId: document.id,
        sourceGapId: gap.id,
        taxYear: 2025,
        value: "no"
      })
    );
  });
});

function createMultipartFile(fileName: string): MultipartFile {
  return {
    file: Readable.from(["test file contents"]),
    filename: fileName,
    mimetype: "application/pdf"
  } as MultipartFile;
}
