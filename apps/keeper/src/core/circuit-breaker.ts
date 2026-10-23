import type { Clock } from './types.js';

export class CircuitBreaker {
  private consecutiveFailures: number = 0;
  private maxFailures: number;
  private isTripped: boolean = false;
  private trippedAt: number | null = null;
  private nowFn: Clock;

  constructor(maxFailures: number = 5, nowFn: Clock = () => Date.now()) {
    this.maxFailures = maxFailures;
    this.nowFn = nowFn;
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
      this.trippedAt = this.nowFn();
    }
    return this.isTripped;
  }

  public checkTripped(): boolean {
    return this.isTripped;
  }

  public getFailuresCount(): number {
    return this.consecutiveFailures;
  }

  public getTrippedAt(): number | null {
    return this.trippedAt;
  }

  public reset(): void {
    this.consecutiveFailures = 0;
    this.isTripped = false;
    this.trippedAt = null;
  }
}
