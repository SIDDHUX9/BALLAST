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

export class CooldownTracker {
  private lastActionTime: Map<string, number> = new Map();
  private cooldownMs: number;
  private nowFn: () => number;

  constructor(cooldownMs: number = 60000, nowFn: () => number = () => Date.now()) {
    this.cooldownMs = cooldownMs;
    this.nowFn = nowFn;
  }

  public isCoolingDown(vault: string): boolean {
    const key = vault.toLowerCase();
    const lastTime = this.lastActionTime.get(key);
    if (!lastTime) return false;

    const elapsed = this.nowFn() - lastTime;
    return elapsed < this.cooldownMs;
  }

  public recordAction(vault: string): void {
    const key = vault.toLowerCase();
    this.lastActionTime.set(key, this.nowFn());
  }

  public reset(vault?: string): void {
    if (vault) {
      this.lastActionTime.delete(vault.toLowerCase());
    } else {
      this.lastActionTime.clear();
    }
  }

  public getRemainingCooldownMs(vault: string): number {
    const key = vault.toLowerCase();
    const lastTime = this.lastActionTime.get(key);
    if (!lastTime) return 0;
    const elapsed = this.nowFn() - lastTime;
    return Math.max(0, this.cooldownMs - elapsed);
  }
}

export class CircuitBreaker {
  private consecutiveFailures: number = 0;
  private maxFailures: number;
  private isTripped: boolean = false;
  private trippedAt: number | null = null;

  constructor(maxFailures: number = 5) {
    this.maxFailures = maxFailures;
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.isTripped = false;
    this.trippedAt = null;
  }

  public recordFailure(): boolean {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= this.maxFailures) {
      this.isTripped = true;
      this.trippedAt = Date.now();
    }
    return this.isTripped;
  }

  public checkTripped(): boolean {
    return this.isTripped;
  }

  public getFailuresCount(): number {
    return this.consecutiveFailures;
  }

  public reset(): void {
    this.consecutiveFailures = 0;
    this.isTripped = false;
    this.trippedAt = null;
  }
}
