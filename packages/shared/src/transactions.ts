import { z } from "zod";

import { MoneySchema, TaxYearSchema } from "./common.js";

export const TransactionEntryKindSchema = z.enum([
  "buy",
  "sell",
  "swap",
  "send",
  "receive",
  "transfer-in",
  "transfer-out",
  "fee",
  "income",
  "other"
]);
export const TransactionImportSessionStatusSchema = z.enum(["completed", "failed", "staged"]);
export const TransactionImportSourceKindSchema = z.enum(["csv-upload", "document-upload", "manual"]);
export const TransferMatchStatusSchema = z.enum(["matched", "unmatched"]);
export const TransferMatchConfidenceSchema = z.enum(["high", "medium"]);
export const BitcoinBasisMethodSchema = z.enum([
  "undocumented",
  "carryforward-single-wallet",
  "wallet-based-tracking",
  "manual-review"
]);
export const BitcoinBasisTransitionStatusSchema = z.enum(["not-needed", "pending-history", "ready", "blocked"]);

export const TransactionImportSessionSchema = z.object({
  createdAt: z.iso.datetime(),
  id: z.string().min(1),
  sourceDocumentId: z.string().min(1).optional(),
  sourceFileName: z.string().min(1),
  sourceKind: TransactionImportSourceKindSchema,
  sourceLabel: z.string().min(1),
  status: TransactionImportSessionStatusSchema,
  taxYear: TaxYearSchema,
  transactionCount: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime()
});

export const LedgerTransactionSchema = z.object({
  accountLabel: z.string().min(1),
  cashValue: MoneySchema.optional(),
  occurredAt: z.iso.datetime(),
  assetSymbol: z.string().min(1),
  entryKind: TransactionEntryKindSchema,
  id: z.string().min(1),
  importSessionId: z.string().min(1),
  quantity: z.string().min(1),
  sourceDocumentId: z.string().min(1).optional(),
  taxYear: TaxYearSchema
});
export const TransferMatchSchema = z.object({
  confidence: TransferMatchConfidenceSchema,
  id: z.string().min(1),
  inboundTransactionId: z.string().min(1).optional(),
  notes: z.string().min(1),
  outboundTransactionId: z.string().min(1),
  status: TransferMatchStatusSchema,
  taxYear: TaxYearSchema
});
export const BitcoinBasisProfileSchema = z.object({
  accounts: z.array(z.string().min(1)),
  assetSymbol: z.literal("BTC"),
  effectiveDate: z.iso.date(),
  explanation: z.string().min(1),
  hasPost2024Activity: z.boolean(),
  hasPre2025Holdings: z.boolean(),
  method: BitcoinBasisMethodSchema,
  recordedAt: z.iso.datetime(),
  taxYear: TaxYearSchema,
  transitionStatus: BitcoinBasisTransitionStatusSchema,
  updatedAt: z.iso.datetime()
});
export const SaveBitcoinBasisProfileInputSchema = z.object({
  explanation: z.string().trim().min(1),
  method: BitcoinBasisMethodSchema,
  taxYear: TaxYearSchema
});

export type BitcoinBasisProfile = z.infer<typeof BitcoinBasisProfileSchema>;
export type LedgerTransaction = z.infer<typeof LedgerTransactionSchema>;
export type SaveBitcoinBasisProfileInput = z.infer<typeof SaveBitcoinBasisProfileInputSchema>;
export type TransferMatch = z.infer<typeof TransferMatchSchema>;
export type TransactionImportSession = z.infer<typeof TransactionImportSessionSchema>;
