import { z } from "zod";

export const TaxYearSchema = z.number().int().min(2000).max(2100);
export const CurrencyCodeSchema = z.literal("USD");
export const MoneySchema = z.object({
  amountInCents: z.int(),
  currencyCode: CurrencyCodeSchema
});
export const ReviewSeveritySchema = z.enum(["info", "warning", "required"]);
export const MissingFactSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  reason: z.string().min(1),
  severity: ReviewSeveritySchema
});

export type MissingFact = z.infer<typeof MissingFactSchema>;
export type Money = z.infer<typeof MoneySchema>;
export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;

export function makeUsd(amountInCents: number): Money {
  return {
    amountInCents,
    currencyCode: "USD"
  };
}

export function formatUsd(value: Money): string {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency"
  }).format(value.amountInCents / 100);
}
