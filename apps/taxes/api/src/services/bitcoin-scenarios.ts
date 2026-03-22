import { makeUsd, type TaxScenario } from "@taxes/shared";

import { summarizeBitcoinTaxScenario } from "./bitcoin-lot-selection.js";

export function buildBitcoinScenarioTemplates(
  bitcoinDispositions: Parameters<typeof summarizeBitcoinTaxScenario>[0]["dispositions"],
  originalBitcoinLots: NonNullable<Parameters<typeof summarizeBitcoinTaxScenario>[0]["lots"]>
): TaxScenario[] {
  const fifoScenario = summarizeBitcoinTaxScenario({
    dispositions: bitcoinDispositions,
    lots: originalBitcoinLots,
    method: "fifo"
  });
  const highestBasisScenario = summarizeBitcoinTaxScenario({
    dispositions: bitcoinDispositions,
    lots: originalBitcoinLots,
    method: "highest-basis"
  });
  const specificIdentificationScenario = summarizeBitcoinTaxScenario({
    dispositions: bitcoinDispositions,
    method: "specific-identification"
  });

  return [
    {
      description: "Baseline comparison using FIFO disposal assumptions.",
      estimatedFederalTax: makeUsd(fifoScenario.estimatedFederalTaxInCents),
      id: "scenario-fifo",
      lotSelectionMethod: "fifo",
      name: "FIFO baseline",
      realizedLongTermGain: makeUsd(fifoScenario.realizedLongTermGainInCents),
      realizedShortTermGain: makeUsd(fifoScenario.realizedShortTermGainInCents)
    },
    {
      description: "Prioritize higher basis lots when specific identification is available.",
      estimatedFederalTax: makeUsd(highestBasisScenario.estimatedFederalTaxInCents),
      id: "scenario-high-basis",
      lotSelectionMethod: "highest-basis",
      name: "High basis focus",
      realizedLongTermGain: makeUsd(highestBasisScenario.realizedLongTermGainInCents),
      realizedShortTermGain: makeUsd(highestBasisScenario.realizedShortTermGainInCents)
    },
    {
      description: "User-directed lot selection once all acquisition data is reconciled.",
      estimatedFederalTax: makeUsd(specificIdentificationScenario.estimatedFederalTaxInCents),
      id: "scenario-specific-id",
      lotSelectionMethod: "specific-identification",
      name: "Specific identification",
      realizedLongTermGain: makeUsd(specificIdentificationScenario.realizedLongTermGainInCents),
      realizedShortTermGain: makeUsd(specificIdentificationScenario.realizedShortTermGainInCents)
    }
  ];
}
