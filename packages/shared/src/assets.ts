import { z } from "zod";

import { MoneySchema } from "./common.js";

export const AssetKindSchema = z.enum(["equity", "etf", "fund", "digital-asset", "cash", "other"]);
export const HoldingTermSchema = z.enum(["short-term", "long-term", "unknown"]);
export const LotSelectionMethodSchema = z.enum(["fifo", "highest-basis", "specific-identification"]);
export const BitcoinLotSelectionMethodSchema = z.enum([
  "broker-reported",
  "fifo",
  "highest-basis",
  "specific-identification"
]);
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
export const BitcoinLotSchema = z.object({
  accountLabel: z.string().min(1),
  acquiredAt: z.iso.datetime(),
  costBasis: MoneySchema,
  id: z.string().min(1),
  quantity: z.string().min(1),
  remainingQuantity: z.string().min(1),
  sourceTransactionId: z.string().min(1)
});
export const BitcoinLotSelectionSchema = z.object({
  createdAt: z.iso.datetime(),
  dispositionTransactionId: z.string().min(1),
  id: z.string().min(1),
  lotId: z.string().min(1),
  quantity: z.string().min(1),
  selectionMethod: BitcoinLotSelectionMethodSchema
});
export const BitcoinDispositionSchema = z.object({
  accountLabel: z.string().min(1),
  assignedCostBasis: MoneySchema.optional(),
  id: z.string().min(1),
  occurredAt: z.iso.datetime(),
  proceeds: MoneySchema.optional(),
  quantity: z.string().min(1),
  recommendedLotIds: z.array(z.string().min(1)),
  realizedGainOrLoss: MoneySchema.optional(),
  selectedQuantity: z.string().min(1),
  sourceTransactionId: z.string().min(1),
  status: z.enum(["blocked", "fully-assigned", "partially-assigned", "ready-to-pick"]),
  unassignedQuantity: z.string().min(1)
});
export const SaveBitcoinLotSelectionInputSchema = z.object({
  dispositionTransactionId: z.string().min(1),
  lotId: z.string().min(1),
  quantity: z.string().min(1),
  selectionMethod: BitcoinLotSelectionMethodSchema,
  taxYear: z.number().int().min(2000).max(2100)
});

export type AssetKind = z.infer<typeof AssetKindSchema>;
export type AssetLot = z.infer<typeof AssetLotSchema>;
export type BitcoinDisposition = z.infer<typeof BitcoinDispositionSchema>;
export type BitcoinLot = z.infer<typeof BitcoinLotSchema>;
export type BitcoinLotSelection = z.infer<typeof BitcoinLotSelectionSchema>;
export type BitcoinLotSelectionMethod = z.infer<typeof BitcoinLotSelectionMethodSchema>;
export type LotSelectionMethod = z.infer<typeof LotSelectionMethodSchema>;
export type SaveBitcoinLotSelectionInput = z.infer<typeof SaveBitcoinLotSelectionInputSchema>;
export type TaxScenario = z.infer<typeof TaxScenarioSchema>;
