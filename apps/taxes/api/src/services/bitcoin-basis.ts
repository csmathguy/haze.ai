import { BitcoinBasisMethodSchema, SaveBitcoinBasisProfileInputSchema, type SaveBitcoinBasisProfileInput } from "@taxes/shared";

import { getPrismaClient } from "../db/client.js";
import type { WorkspacePersistenceOptions } from "./context.js";

export async function saveBitcoinBasisProfile(
  input: SaveBitcoinBasisProfileInput,
  options: WorkspacePersistenceOptions = {}
): Promise<void> {
  const prisma = await getPrismaClient(options.databaseUrl);
  const payload = SaveBitcoinBasisProfileInputSchema.parse(input);

  await prisma.bitcoinTaxConfiguration.upsert({
    create: {
      assetSymbol: "BTC",
      explanation: payload.explanation,
      recordedAt: new Date(),
      taxYear: payload.taxYear,
      transitionMethod: BitcoinBasisMethodSchema.parse(payload.method)
    },
    update: {
      explanation: payload.explanation,
      transitionMethod: BitcoinBasisMethodSchema.parse(payload.method)
    },
    where: {
      taxYear: payload.taxYear
    }
  });
}
