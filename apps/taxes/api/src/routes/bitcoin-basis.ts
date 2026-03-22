import type { FastifyInstance } from "fastify";
import { SaveBitcoinBasisProfileInputSchema } from "@taxes/shared";

import type { WorkspacePersistenceOptions } from "../services/context.js";
import { saveBitcoinBasisProfile } from "../services/bitcoin-basis.js";

export function registerBitcoinBasisRoutes(app: FastifyInstance, options: WorkspacePersistenceOptions = {}): void {
  app.post("/api/bitcoin-basis-profile", async (request, reply) => {
    const payload = SaveBitcoinBasisProfileInputSchema.parse(request.body);

    await saveBitcoinBasisProfile(payload, options);

    return reply.code(204).send();
  });
}
