import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Chain,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Logger } from 'pino';

export interface RpcHealthStatus {
  activeUrl: string;
  isHealthy: boolean;
  lastCheckedAt: string;
  lastBlockNumber: bigint;
  failoverCount: number;
}

export class ResilientRpcManager {
  private rpcUrls: string[];
  private currentIndex: number = 0;
  private chain: Chain;
  private publicClient: PublicClient;
  private walletClient?: WalletClient;
  private failoverCount: number = 0;
  private lastHealthyBlock: bigint = 0n;
  private isHealthy: boolean = true;
  private logger?: Logger;
  private privateKey?: Hex;

  constructor(
    rpcUrls: string[],
    chainId: number,
    privateKey?: Hex,
    logger?: Logger,
  ) {
    if (!rpcUrls || rpcUrls.length === 0) {
      throw new Error('At least one RPC URL is required');
    }
    this.rpcUrls = rpcUrls;
    this.logger = logger;
    this.privateKey = privateKey;

    this.chain = {
      id: chainId,
      name: 'Mezo',
      nativeCurrency: {
        decimals: 18,
        name: 'Bitcoin',
        symbol: 'BTC',
      },
      rpcUrls: {
        default: { http: [this.rpcUrls[0]] },
        public: { http: [this.rpcUrls[0]] },
      },
    };

    this.publicClient = this.buildPublicClient(this.rpcUrls[0]);
    if (this.privateKey) {
      this.walletClient = this.buildWalletClient(this.rpcUrls[0]);
    }
  }

  private buildPublicClient(url: string): PublicClient {
    return createPublicClient({
      chain: this.chain,
      transport: http(url, {
        timeout: 10000,
        retryCount: 2,
        retryDelay: 1000,
      }),
    });
  }

  private buildWalletClient(url: string): WalletClient | undefined {
    if (!this.privateKey) return undefined;
    const account = privateKeyToAccount(this.privateKey);
    return createWalletClient({
      account,
      chain: this.chain,
      transport: http(url, {
        timeout: 15000,
        retryCount: 2,
        retryDelay: 1000,
      }),
    });
  }

  public getPublicClient(): PublicClient {
    return this.publicClient;
  }

  public getWalletClient(): WalletClient {
    if (!this.walletClient) {
      throw new Error('WalletClient not initialized with private key');
    }
    return this.walletClient;
  }

  public getActiveRpcUrl(): string {
    return this.rpcUrls[this.currentIndex];
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const blockNumber = await this.publicClient.getBlockNumber();
      this.lastHealthyBlock = blockNumber;
      this.isHealthy = true;
      return true;
    } catch (err) {
      this.isHealthy = false;
      this.logger?.warn(
        { err, failedRpc: this.rpcUrls[this.currentIndex] },
        'RPC health check failed, evaluating failover',
      );

      if (this.rpcUrls.length > 1) {
        this.failover();
        try {
          const blockNumber = await this.publicClient.getBlockNumber();
          this.lastHealthyBlock = blockNumber;
          this.isHealthy = true;
          return true;
        } catch (failoverErr) {
          this.logger?.error({ failoverErr }, 'Failover RPC also failed');
          this.isHealthy = false;
          return false;
        }
      }
      return false;
    }
  }

  public failover(): void {
    if (this.rpcUrls.length <= 1) return;
    this.currentIndex = (this.currentIndex + 1) % this.rpcUrls.length;
    this.failoverCount++;
    const nextUrl = this.rpcUrls[this.currentIndex];
    this.logger?.warn({ nextUrl, failoverCount: this.failoverCount }, 'Switched to next RPC endpoint');

    this.publicClient = this.buildPublicClient(nextUrl);
    if (this.privateKey) {
      this.walletClient = this.buildWalletClient(nextUrl);
    }
  }

  public getHealthStatus(): RpcHealthStatus {
    return {
      activeUrl: this.rpcUrls[this.currentIndex],
      isHealthy: this.isHealthy,
      lastCheckedAt: new Date().toISOString(),
      lastBlockNumber: this.lastHealthyBlock,
      failoverCount: this.failoverCount,
    };
  }
}
