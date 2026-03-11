import type { FastifyInstance } from "fastify";

import { MAX_UPLOAD_FILE_BYTES } from "../config.js";
import type { WorkspacePersistenceOptions } from "../services/context.js";
import { saveUploadedDocument } from "../services/document-store.js";

export function registerDocumentRoutes(app: FastifyInstance, options: WorkspacePersistenceOptions = {}): void {
  app.post("/api/documents", async (request, reply) => {
    const upload = await request.file();

    if (upload === undefined) {
      return reply.code(400).send({
        message: "Expected a multipart file upload."
      });
    }

    const document = await saveUploadedDocument(upload, inferActiveTaxYear(), options);

    return reply.code(201).send({
      document,
      maxUploadBytes: MAX_UPLOAD_FILE_BYTES
    });
  });
}

function inferActiveTaxYear(now: Date = new Date()): number {
  return now.getMonth() <= 5 ? now.getFullYear() - 1 : now.getFullYear();
}
