import { readFile } from "node:fs/promises";

import type { PrismaClient } from "@taxes/db";

interface ParsedTransactionRow {
  accountLabel: string;
  assetSymbol: string;
  cashValueInCents?: number;
  entryKind: "buy" | "fee" | "income" | "other" | "receive" | "sell" | "send" | "swap" | "transfer-in" | "transfer-out";
  occurredAt: Date;
  quantity: string;
}

export async function importLedgerTransactionsFromCsv(input: {
  defaultAccountLabel: string;
  documentId: string;
  filePath: string;
  importSessionId: string;
  prisma: PrismaClient;
  taxYear: number;
}): Promise<number> {
  const csvContent = await readFile(input.filePath, "utf8");
  const rows = parseTransactionCsv(csvContent, input.defaultAccountLabel);

  if (rows.length === 0) {
    await input.prisma.transactionImportSession.update({
      data: {
        status: "staged",
        transactionCount: 0
      },
      where: {
        id: input.importSessionId
      }
    });

    return 0;
  }

  await input.prisma.ledgerTransaction.createMany({
    data: rows.map((row, index) => ({
      accountLabel: row.accountLabel,
      assetSymbol: row.assetSymbol,
      ...(row.cashValueInCents === undefined ? {} : { cashValueInCents: row.cashValueInCents }),
      entryKind: row.entryKind,
      id: `${input.importSessionId}-tx-${(index + 1).toString()}`,
      importSessionId: input.importSessionId,
      occurredAt: row.occurredAt,
      quantity: row.quantity,
      sourceDocumentId: input.documentId,
      taxYear: input.taxYear
    }))
  });
  await input.prisma.transactionImportSession.update({
    data: {
      status: "completed",
      transactionCount: rows.length
    },
    where: {
      id: input.importSessionId
    }
  });

  return rows.length;
}

function parseTransactionCsv(csvContent: string, defaultAccountLabel: string): ParsedTransactionRow[] {
  const [headerLine, ...valueLines] = csvContent
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (headerLine === undefined) {
    return [];
  }

  const headers = splitCsvLine(headerLine).map((header) => header.trim().toLowerCase());

  return valueLines
    .map((line) => mapCsvRow(headers, splitCsvLine(line), defaultAccountLabel))
    .filter((row): row is ParsedTransactionRow => row !== null);
}

function mapCsvRow(headers: string[], values: string[], defaultAccountLabel: string): ParsedTransactionRow | null {
  const getValue = (...names: string[]) => {
    const index = headers.findIndex((header) => names.includes(header));
    return index === -1 ? undefined : values[index]?.trim();
  };

  const timestamp = getValue("timestamp", "date", "time", "date & time", "datetime", "transaction datetime");
  const type = getValue("type", "transaction type", "transaction_type", "side");
  const asset = getValue("asset", "currency", "symbol", "asset acquired", "base currency");
  const quantity = getValue("quantity", "amount", "asset amount", "quantity transacted", "size");
  const cashValue = getValue(
    "total",
    "subtotal",
    "amount (usd)",
    "native amount",
    "usd total",
    "value",
    "proceeds"
  );
  const account = getValue("account", "wallet", "source", "platform") ?? defaultAccountLabel;

  if (
    timestamp === undefined ||
    type === undefined ||
    asset === undefined ||
    quantity === undefined
  ) {
    return null;
  }

  const occurredAt = new Date(timestamp);

  if (Number.isNaN(occurredAt.getTime())) {
    return null;
  }

  const parsedCashValueInCents = cashValue === undefined ? undefined : parseCurrencyToCents(cashValue);

  return {
    accountLabel: account,
    assetSymbol: asset.toUpperCase(),
    ...(parsedCashValueInCents === undefined ? {} : { cashValueInCents: parsedCashValueInCents }),
    entryKind: normalizeEntryKind(type),
    occurredAt,
    quantity
  };
}

function normalizeEntryKind(input: string): ParsedTransactionRow["entryKind"] {
  const value = input.trim().toLowerCase();
  const matchers: readonly {
    readonly kind: ParsedTransactionRow["entryKind"];
    readonly matches: (value: string) => boolean;
  }[] = [
    { kind: "transfer-out", matches: (candidate) => candidate.includes("transfer") && candidate.includes("out") },
    { kind: "transfer-in", matches: (candidate) => candidate.includes("transfer") && candidate.includes("in") },
    { kind: "transfer-out", matches: (candidate) => candidate.includes("withdraw") },
    { kind: "transfer-in", matches: (candidate) => candidate.includes("deposit") },
    { kind: "buy", matches: (candidate) => candidate.includes("buy") },
    { kind: "sell", matches: (candidate) => candidate.includes("sell") },
    { kind: "swap", matches: (candidate) => candidate.includes("swap") || candidate.includes("convert") },
    { kind: "send", matches: (candidate) => candidate.includes("send") },
    { kind: "receive", matches: (candidate) => candidate.includes("receive") },
    { kind: "income", matches: (candidate) => candidate.includes("reward") || candidate.includes("income") || candidate.includes("staking") },
    { kind: "fee", matches: (candidate) => candidate.includes("fee") }
  ];

  return matchers.find((matcher) => matcher.matches(value))?.kind ?? "other";
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = "";
  let isQuoted = false;

  for (const character of line) {
    if (character === "\"") {
      isQuoted = !isQuoted;
      continue;
    }

    if (character === "," && !isQuoted) {
      values.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

function parseCurrencyToCents(input: string): number | undefined {
  const normalized = input.replace(/[$,\s]/gu, "");

  if (normalized.length === 0) {
    return undefined;
  }

  const parsed = Number(normalized);

  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return Math.round(parsed * 100);
}
