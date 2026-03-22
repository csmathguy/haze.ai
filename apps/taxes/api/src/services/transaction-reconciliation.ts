import {
  BitcoinBasisProfileSchema,
  type BitcoinBasisProfile,
  TransferMatchSchema,
  type LedgerTransaction,
  type ReviewTask,
  type TransferMatch
} from "@taxes/shared";
import type { PrismaClient } from "@taxes/db";

const MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;
const BITCOIN_TRANSITION_DATE = "2025-01-01";

export async function syncTransferMatches(
  prisma: PrismaClient,
  transactions: readonly LedgerTransaction[],
  taxYear: number
): Promise<TransferMatch[]> {
  const outgoing = transactions.filter((transaction) => transaction.entryKind === "transfer-out" && transaction.taxYear === taxYear);
  const incoming = transactions.filter((transaction) => transaction.entryKind === "transfer-in" && transaction.taxYear === taxYear);
  const matches = outgoing.map((outbound) => buildTransferMatch(outbound, incoming, taxYear));

  await prisma.transferMatch.deleteMany({
    where: {
      taxYear
    }
  });

  if (matches.length > 0) {
    await prisma.transferMatch.createMany({
      data: matches.map((match) => ({
        confidence: match.confidence,
        id: match.id,
        notes: match.notes,
        outboundTransactionId: match.outboundTransactionId,
        ...(match.inboundTransactionId === undefined ? {} : { inboundTransactionId: match.inboundTransactionId }),
        status: match.status,
        taxYear: match.taxYear
      }))
    });
  }

  return matches;
}

export function createTransferReviewTasks(matches: readonly TransferMatch[]): ReviewTask[] {
  return matches
    .filter((match) => match.status === "unmatched")
    .map((match) => ({
      actionLabel: "Resolve transfer",
      id: `review-${match.id}`,
      reason: match.notes,
      severity: "warning",
      title: `Transfer review: ${match.outboundTransactionId}`
    }));
}

export function createBasisReviewTasks(transactions: readonly LedgerTransaction[]): ReviewTask[] {
  return transactions.flatMap((transaction) => {
    if (requiresAcquisitionBasisReview(transaction)) {
      return [
        {
          actionLabel: "Resolve cost basis",
          id: `review-basis-${transaction.id}`,
          reason: `No cash-value or basis support was imported for ${transaction.assetSymbol} ${transaction.quantity}. Add source pricing or basis records before gain calculations are trusted.`,
          severity: "required",
          title: `Cost basis review: ${transaction.assetSymbol} ${transaction.id}`
        }
      ];
    }

    if (requiresDispositionBasisReview(transaction, transactions)) {
      return [
        {
          actionLabel: "Resolve cost basis",
          id: `review-disposal-basis-${transaction.id}`,
          reason: `This ${transaction.entryKind} disposition does not yet have sufficient prior basis support for ${transaction.assetSymbol}.`,
          severity: "required",
          title: `Disposition basis review: ${transaction.assetSymbol} ${transaction.id}`
        }
      ];
    }

    return [];
  });
}

export function buildBitcoinBasisProfile(input: {
  explanation: string;
  method: BitcoinBasisProfile["method"];
  recordedAt: string;
  taxYear: number;
  transactions: readonly LedgerTransaction[];
  updatedAt: string;
}): BitcoinBasisProfile {
  const bitcoinTransactions = input.transactions.filter((transaction) => transaction.assetSymbol === "BTC");
  const accounts = [...new Set(bitcoinTransactions.map((transaction) => transaction.accountLabel))].sort((left, right) =>
    left.localeCompare(right)
  );
  const hasPre2025Holdings = bitcoinTransactions.some(
    (transaction) =>
      isAcquisitionEntry(transaction.entryKind) && Date.parse(transaction.occurredAt) < Date.parse(`${BITCOIN_TRANSITION_DATE}T00:00:00.000Z`)
  );
  const hasPost2024Activity = bitcoinTransactions.some(
    (transaction) => Date.parse(transaction.occurredAt) >= Date.parse(`${BITCOIN_TRANSITION_DATE}T00:00:00.000Z`)
  );

  return BitcoinBasisProfileSchema.parse({
    accounts,
    assetSymbol: "BTC",
    effectiveDate: BITCOIN_TRANSITION_DATE,
    explanation: input.explanation,
    hasPost2024Activity,
    hasPre2025Holdings,
    method: input.method,
    recordedAt: input.recordedAt,
    taxYear: input.taxYear,
    transitionStatus: deriveBitcoinBasisTransitionStatus({
      accounts,
      hasPost2024Activity,
      hasPre2025Holdings,
      method: input.method
    }),
    updatedAt: input.updatedAt
  });
}

export function createBitcoinBasisReviewTasks(profile: BitcoinBasisProfile): ReviewTask[] {
  if (!profile.hasPost2024Activity || profile.transitionStatus === "not-needed" || profile.transitionStatus === "ready") {
    return [];
  }

  if (profile.transitionStatus === "pending-history") {
    return [
      {
        actionLabel: "Record BTC basis method",
        id: `review-btc-basis-${profile.taxYear.toString()}`,
        reason:
          "BTC activity in tax year 2025 or later needs a documented wallet-based basis transition method before gains are treated as reliable.",
        severity: "required",
        title: `BTC basis transition review: ${profile.taxYear.toString()}`
      }
    ];
  }

  return [
    {
      actionLabel: "Escalate BTC basis review",
      id: `review-btc-basis-blocked-${profile.taxYear.toString()}`,
      reason:
        "The recorded BTC basis assumption does not safely support the observed wallet/account history. This return should stay blocked for manual or professional review.",
      severity: "required",
      title: `BTC basis transition blocked: ${profile.taxYear.toString()}`
    }
  ];
}

function buildTransferMatch(
  outbound: LedgerTransaction,
  incoming: readonly LedgerTransaction[],
  taxYear: number
): TransferMatch {
  const candidate = incoming.find((transaction) => isLikelyTransferPair(outbound, transaction));

  return TransferMatchSchema.parse(
    candidate === undefined
      ? {
          confidence: "medium",
          id: `transfer-match-${outbound.id}`,
          notes: `No matching inbound transfer was found for ${outbound.assetSymbol} ${outbound.quantity}. Review the destination wallet history and transfer timing.`,
          outboundTransactionId: outbound.id,
          status: "unmatched",
          taxYear
        }
      : {
          confidence: "high",
          id: `transfer-match-${outbound.id}`,
          inboundTransactionId: candidate.id,
          notes: `Matched ${outbound.assetSymbol} ${outbound.quantity} transfer between ${outbound.accountLabel} and ${candidate.accountLabel}.`,
          outboundTransactionId: outbound.id,
          status: "matched",
          taxYear
        }
  );
}

function isLikelyTransferPair(outbound: LedgerTransaction, inbound: LedgerTransaction): boolean {
  if (outbound.id === inbound.id) {
    return false;
  }

  if (outbound.assetSymbol !== inbound.assetSymbol || outbound.quantity !== inbound.quantity) {
    return false;
  }

  if (outbound.accountLabel === inbound.accountLabel) {
    return false;
  }

  const deltaMs = Math.abs(Date.parse(outbound.occurredAt) - Date.parse(inbound.occurredAt));
  return deltaMs <= MATCH_WINDOW_MS;
}

function requiresAcquisitionBasisReview(transaction: LedgerTransaction): boolean {
  return (
    (transaction.entryKind === "buy" || transaction.entryKind === "income" || transaction.entryKind === "receive") &&
    transaction.cashValue === undefined
  );
}

function deriveBitcoinBasisTransitionStatus(input: {
  accounts: readonly string[];
  hasPost2024Activity: boolean;
  hasPre2025Holdings: boolean;
  method: BitcoinBasisProfile["method"];
}): BitcoinBasisProfile["transitionStatus"] {
  if (!input.hasPost2024Activity) {
    return "not-needed";
  }

  if (input.method === "undocumented") {
    return "pending-history";
  }

  if (input.method === "manual-review") {
    return "blocked";
  }

  if (input.hasPre2025Holdings && input.accounts.length > 1 && input.method === "carryforward-single-wallet") {
    return "blocked";
  }

  return "ready";
}

function isAcquisitionEntry(entryKind: LedgerTransaction["entryKind"]): boolean {
  return entryKind === "buy" || entryKind === "income" || entryKind === "receive";
}

function requiresDispositionBasisReview(
  transaction: LedgerTransaction,
  transactions: readonly LedgerTransaction[]
): boolean {
  if (transaction.entryKind !== "sell" && transaction.entryKind !== "swap" && transaction.entryKind !== "send") {
    return false;
  }

  const hasPriorBasisSupportedAcquisition = transactions.some((candidate) => {
    if (candidate.assetSymbol !== transaction.assetSymbol) {
      return false;
    }

    if (Date.parse(candidate.occurredAt) > Date.parse(transaction.occurredAt)) {
      return false;
    }

    return (
      (candidate.entryKind === "buy" || candidate.entryKind === "income" || candidate.entryKind === "receive") &&
      candidate.cashValue !== undefined
    );
  });

  return !hasPriorBasisSupportedAcquisition;
}
