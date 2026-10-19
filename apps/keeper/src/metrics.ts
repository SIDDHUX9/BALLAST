export class KeeperMetrics {
  public vaultsTracked: number = 0;
  public defensesSent: number = 0;
  public defensesSucceeded: number = 0;
  public defensesFailed: number = 0;
  public failuresTotal: number = 0;
  public loopLatencySeconds: number = 0;
  public balanceBtc: number = 0;
  public lastBlockNumber: number = 0;
  public circuitBreakerStatus: number = 0; // 0 = ok, 1 = tripped

  public incrementSent(): void {
    this.defensesSent++;
  }

  public incrementSuccess(): void {
    this.defensesSucceeded++;
  }

  public incrementDefenseFailure(): void {
    this.defensesFailed++;
    this.failuresTotal++;
  }

  public incrementGeneralFailure(): void {
    this.failuresTotal++;
  }

  public setLoopLatency(seconds: number): void {
    this.loopLatencySeconds = seconds;
  }

  public setBalanceBtc(btc: number): void {
    this.balanceBtc = btc;
  }

  public setVaultsTracked(count: number): void {
    this.vaultsTracked = count;
  }

  public setLastBlock(blockNumber: number): void {
    this.lastBlockNumber = blockNumber;
  }

  public setCircuitBreaker(tripped: boolean): void {
    this.circuitBreakerStatus = tripped ? 1 : 0;
  }

  public toPrometheusFormat(): string {
    const lines: string[] = [
      '# HELP keeper_vaults_tracked Total number of Ballast vaults indexed and tracked',
      '# TYPE keeper_vaults_tracked gauge',
      `keeper_vaults_tracked ${this.vaultsTracked}`,
      '',
      '# HELP keeper_defenses_total Total number of defense transactions by status',
      '# TYPE keeper_defenses_total counter',
      `keeper_defenses_total{status="sent"} ${this.defensesSent}`,
      `keeper_defenses_total{status="success"} ${this.defensesSucceeded}`,
      `keeper_defenses_total{status="failure"} ${this.defensesFailed}`,
      '',
      '# HELP keeper_failures_total Total number of unexpected failures in keeper operations',
      '# TYPE keeper_failures_total counter',
      `keeper_failures_total ${this.failuresTotal}`,
      '',
      '# HELP keeper_loop_latency_seconds Latency of the most recent monitor loop cycle in seconds',
      '# TYPE keeper_loop_latency_seconds gauge',
      `keeper_loop_latency_seconds ${this.loopLatencySeconds.toFixed(4)}`,
      '',
      '# HELP keeper_balance_btc Current native BTC balance of the keeper wallet',
      '# TYPE keeper_balance_btc gauge',
      `keeper_balance_btc ${this.balanceBtc.toFixed(8)}`,
      '',
      '# HELP keeper_last_block_number Last verified block number processed by keeper',
      '# TYPE keeper_last_block_number gauge',
      `keeper_last_block_number ${this.lastBlockNumber}`,
      '',
      '# HELP keeper_circuit_breaker_status Circuit breaker status (0 = operational, 1 = tripped)',
      '# TYPE keeper_circuit_breaker_status gauge',
      `keeper_circuit_breaker_status ${this.circuitBreakerStatus}`,
      '',
    ];

    return lines.join('\n');
  }
}
