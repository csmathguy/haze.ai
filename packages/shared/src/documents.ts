import { z } from "zod";

import { MissingFactSchema } from "./common.js";

export const DocumentKindSchema = z.enum([
  "1098",
  "1099-b",
  "1099-da",
  "1099-div",
  "1099-int",
  "brokerage-statement",
  "charitable-contribution",
  "crypto-wallet-export",
  "other-income",
  "property-tax-statement",
  "retirement-distribution",
  "schedule-k-1",
  "w-2",
  "unknown"
]);
export const DocumentStatusSchema = z.enum(["imported", "mapped", "needs-review"]);
export const ImportedDocumentSchema = z.object({
  fileName: z.string().min(1),
  fileSizeBytes: z.number().int().nonnegative(),
  id: z.string().min(1),
  importedAt: z.iso.datetime(),
  kind: DocumentKindSchema,
  mimeType: z.string().min(1),
  missingFacts: z.array(MissingFactSchema),
  status: DocumentStatusSchema,
  taxYear: z.number().int().min(2000).max(2100)
});

export type DocumentKind = z.infer<typeof DocumentKindSchema>;
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type ImportedDocument = z.infer<typeof ImportedDocumentSchema>;

const DOCUMENT_PATTERNS: readonly (readonly [DocumentKind, RegExp])[] = [
  ["w-2", /\bw[\s-]?2\b/iu],
  ["1099-int", /\b1099[\s-]?int\b/iu],
  ["1099-div", /\b1099[\s-]?div\b/iu],
  ["1099-b", /\b1099[\s-]?b\b/iu],
  ["1099-da", /\b1099[\s-]?da\b/iu],
  ["1098", /\b1098\b/iu],
  ["schedule-k-1", /\bk[\s-]?1\b/iu],
  ["brokerage-statement", /\bbroker(age)?\b|\bstatement\b/iu],
  ["crypto-wallet-export", /\bcrypto\b|\bbitcoin\b|\beth\b|\bwallet\b|\bcoinbase\b/iu],
  ["charitable-contribution", /\bcharit(y|able)\b|\bdonation\b/iu],
  ["property-tax-statement", /\bproperty\b.*\btax\b|\breal[\s-]?estate\b/iu],
  ["retirement-distribution", /\b1099[\s-]?r\b|\bretirement\b/iu]
];

export function inferDocumentKindFromFileName(fileName: string): DocumentKind {
  for (const [kind, pattern] of DOCUMENT_PATTERNS) {
    if (pattern.test(fileName)) {
      return kind;
    }
  }

  return "unknown";
}

export function buildDocumentMissingFacts(kind: DocumentKind): string[] {
  switch (kind) {
    case "1098":
      return ["lender details", "mortgage interest allocation"];
    case "1099-b":
    case "1099-da":
      return ["acquisition date", "cost basis method", "lot identification"];
    case "1099-div":
      return ["qualified dividend classification"];
    case "1099-int":
      return ["tax-exempt interest split"];
    case "brokerage-statement":
      return ["covered versus uncovered basis", "wash sale adjustments"];
    case "charitable-contribution":
      return ["receipt valuation", "charity confirmation"];
    case "crypto-wallet-export":
      return ["wallet transfer matching", "fair market value at disposal"];
    case "property-tax-statement":
      return ["deductible tax portion"];
    case "retirement-distribution":
      return ["distribution code interpretation", "rollover status"];
    case "schedule-k-1":
      return ["entity classification", "state apportionment"];
    case "w-2":
      return ["state withholding reconciliation"];
    case "other-income":
    case "unknown":
      return ["document classification", "field mapping review"];
  }
}
