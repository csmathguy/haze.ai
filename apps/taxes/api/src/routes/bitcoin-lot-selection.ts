import type { FastifyInstance } from "fastify";
import { SaveBitcoinLotSelectionInputSchema } from "@taxes/shared";

import type { WorkspacePersistenceOptions } from "../services/context.js";
import { saveBitcoinLotSelectionForWorkspace } from "../services/bitcoin-lot-selection-save.js";

export function registerBitcoinLotSelectionRoutes(app: FastifyInstance, options: WorkspacePersistenceOptions = {}): void {
  app.post("/api/bitcoin-lot-selections", async (request, reply) => {
    const payload = SaveBitcoinLotSelectionInputSchema.parse(request.body);

    await saveBitcoinLotSelectionForWorkspace(payload, options);

    return reply.code(204).send();
  });
}
