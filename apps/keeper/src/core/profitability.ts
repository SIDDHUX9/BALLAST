import { computeTip } from '@ballast/shared';

export interface ProfitabilityInput {
  musdToRepay: bigint;
  btcToAdd: bigint;
  maxTipBps: number;
  btcPriceWei: bigint;
  estimatedGas: bigint;
  gasPriceWei: bigint;
  minProfitMargin: number; // e.g. 0.10 for 10%
  altruistic: boolean;
}

export interface ProfitabilityResult {
  isProfitable: boolean;
  expectedTipMusd: bigint;
  expectedTipBtc: bigint;
  expectedTipUsd: number;
  estimatedGasCostUsd: number;
  netProfitUsd: number;
}

export function calculateProfitability(input: ProfitabilityInput): ProfitabilityResult {
  const expectedTipMusd = computeTip(input.musdToRepay, input.maxTipBps);
  const expectedTipBtc = computeTip(input.btcToAdd, input.maxTipBps);

  const btcPriceNum = Number(input.btcPriceWei) / 1e18;
  const tipMusdUsd = Number(expectedTipMusd) / 1e18; // MUSD is $1
  const tipBtcUsd = (Number(expectedTipBtc) / 1e18) * btcPriceNum;
  const totalTipUsd = tipMusdUsd + tipBtcUsd;

  const gasCostWei = input.estimatedGas * input.gasPriceWei;
  const gasCostBtc = Number(gasCostWei) / 1e18;
  const estimatedGasCostUsd = gasCostBtc * btcPriceNum;

  const netProfitUsd = totalTipUsd - estimatedGasCostUsd;

  if (input.altruistic) {
    return {
      isProfitable: true,
      expectedTipMusd,
      expectedTipBtc,
      expectedTipUsd: totalTipUsd,
      estimatedGasCostUsd,
      netProfitUsd,
    };
  }

  // Check required margin: tipUsd >= gasCostUsd * (1 + margin)
  const requiredUsd = estimatedGasCostUsd * (1 + input.minProfitMargin);
  const isProfitable = totalTipUsd >= requiredUsd;

  return {
    isProfitable,
    expectedTipMusd,
    expectedTipBtc,
    expectedTipUsd: totalTipUsd,
    estimatedGasCostUsd,
    netProfitUsd,
  };
}
