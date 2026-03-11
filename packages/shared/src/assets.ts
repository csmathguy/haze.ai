import { z } from "zod";

import { MoneySchema } from "./common.js";

export const AssetKindSchema = z.enum(["equity", "etf", "fund", "digital-asset", "cash", "other"]);
export const HoldingTermSchema = z.enum(["short-term", "long-term", "unknown"]);
export const LotSelectionMethodSchema = z.enum(["fifo", "highest-basis", "specific-identification"]);
export const AssetLotSchema = z.object({
  accountName: z.string().min(1),
  acquiredOn: z.string().min(1),
  assetKind: AssetKindSchema,
  assetKey: z.string().min(1),
  costBasis: MoneySchema,
  displayName: z.string().min(1),
  holdingTerm: HoldingTermSchema,
  id: z.string().min(1),
  quantity: z.string().min(1),
  sourceDocumentId: z.string().min(1).optional()
});
export const TaxScenarioSchema = z.object({
  description: z.string().min(1),
  estimatedFederalTax: MoneySchema,
  id: z.string().min(1),
  lotSelectionMethod: LotSelectionMethodSchema,
  name: z.string().min(1),
  realizedLongTermGain: MoneySchema,
  realizedShortTermGain: MoneySchema
});

export type AssetKind = z.infer<typeof AssetKindSchema>;
export type AssetLot = z.infer<typeof AssetLotSchema>;
export type LotSelectionMethod = z.infer<typeof LotSelectionMethodSchema>;
export type TaxScenario = z.infer<typeof TaxScenarioSchema>;
