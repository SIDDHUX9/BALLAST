import { parseAbiItem, type Address, type PublicClient } from 'viem';
import type { Logger } from 'pino';
import type { KeeperDatabase } from './db.js';
import type { TrackedVault } from './types.js';

const VAULT_CREATED_EVENT = parseAbiItem(
  'event VaultCreated(address indexed owner, address indexed vault)',
);

export interface DiscoveryOptions {
  factoryAddress: Address;
  deployBlockNumber: number;
  chunkSize?: number;
  confirmationDepth?: number;
}

export class VaultDiscoveryService {
  private client: PublicClient;
  private db: KeeperDatabase;
  private factoryAddress: Address;
  private deployBlockNumber: number;
  private chunkSize: number;
  private confirmationDepth: number;
  private logger?: Logger;

  constructor(
    client: PublicClient,
    db: KeeperDatabase,
    options: DiscoveryOptions,
    logger?: Logger,
  ) {
    this.client = client;
    this.db = db;
    this.factoryAddress = options.factoryAddress;
    this.deployBlockNumber = options.deployBlockNumber;
    this.chunkSize = options.chunkSize ?? 2000;
    this.confirmationDepth = options.confirmationDepth ?? 6;
    this.logger = logger;
  }

  public async sync(): Promise<{ newVaultsCount: number; totalVaultsCount: number; currentCursor: number }> {
    const latestBlockBigInt = await this.client.getBlockNumber();
    const latestBlock = Number(latestBlockBigInt);

    // Reorg protection: index up to (latestBlock - confirmationDepth)
    const safeTargetBlock = Math.max(this.deployBlockNumber, latestBlock - this.confirmationDepth);

    const savedCursor = this.db.getCursor();
    let currentBlock = savedCursor !== null
      ? Math.max(this.deployBlockNumber, savedCursor - this.confirmationDepth)
      : this.deployBlockNumber;

    let newlyDiscovered = 0;

    if (currentBlock > safeTargetBlock) {
      return {
        newVaultsCount: 0,
        totalVaultsCount: this.db.getVaultCount(),
        currentCursor: savedCursor ?? currentBlock,
      };
    }

    this.logger?.debug(
      { fromBlock: currentBlock, toBlock: safeTargetBlock, chunkSize: this.chunkSize },
      'Scanning for VaultCreated events',
    );

    while (currentBlock <= safeTargetBlock) {
      const chunkTo = Math.min(safeTargetBlock, currentBlock + this.chunkSize - 1);

      try {
        const logs = await this.client.getLogs({
          address: this.factoryAddress,
          event: VAULT_CREATED_EVENT,
          fromBlock: BigInt(currentBlock),
          toBlock: BigInt(chunkTo),
        });

        if (logs.length > 0) {
          for (const log of logs) {
            const owner = log.args.owner as Address;
            const vault = log.args.vault as Address;
            if (owner && vault) {
              const tracked: TrackedVault = {
                address: vault,
                owner,
                createdBlock: Number(log.blockNumber),
                txHash: log.transactionHash,
                discoveredAt: new Date().toISOString(),
              };
              this.db.saveVault(tracked);
              newlyDiscovered++;
              this.logger?.info(
                { vault, owner, blockNumber: Number(log.blockNumber), txHash: log.transactionHash },
                'Discovered Ballast vault',
              );
            }
          }
        }

        // Persist cursor update
        this.db.saveCursor(chunkTo);
        currentBlock = chunkTo + 1;
      } catch (err) {
        this.logger?.error(
          { err, fromBlock: currentBlock, toBlock: chunkTo },
          'Error indexing VaultCreated events in block range',
        );
        throw err;
      }
    }

    return {
      newVaultsCount: newlyDiscovered,
      totalVaultsCount: this.db.getVaultCount(),
      currentCursor: safeTargetBlock,
    };
  }
}
