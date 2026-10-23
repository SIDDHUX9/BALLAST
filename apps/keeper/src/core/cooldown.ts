import type { Clock } from './types.js';

export class CooldownTracker {
  private lastActionTime: Map<string, number> = new Map();
  private cooldownMs: number;
  private nowFn: Clock;

  constructor(cooldownMs: number = 60000, nowFn: Clock = () => Date.now()) {
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
