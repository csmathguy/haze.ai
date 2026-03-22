import { SaveBitcoinLotSelectionInputSchema, type SaveBitcoinLotSelectionInput } from "@taxes/shared";

import { getPrismaClient } from "../db/client.js";
import type { WorkspacePersistenceOptions } from "./context.js";
import { saveBitcoinLotSelection } from "./bitcoin-lot-selection.js";
import { getWorkspaceSnapshot } from "./workspace.js";

export async function saveBitcoinLotSelectionForWorkspace(
  input: SaveBitcoinLotSelectionInput,
  options: WorkspacePersistenceOptions = {}
): Promise<void> {
  const payload = SaveBitcoinLotSelectionInputSchema.parse(input);
  const prisma = await getPrismaClient(options.databaseUrl);
  const snapshot = await getWorkspaceSnapshot(options);

  await saveBitcoinLotSelection(payload, prisma, {
    dispositions: snapshot.bitcoinDispositions,
    lots: snapshot.bitcoinLots
  });
}
