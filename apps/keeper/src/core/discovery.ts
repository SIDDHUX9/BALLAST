import { parseAbiItem, type Address, type PublicClient } from 'viem';
import type { StoreInterface } from './types.js';
import type { TrackedVault } from '../types.js';

const VAULT_CREATED_EVENT = parseAbiItem(
  'event VaultCreated(address indexed owner, address indexed vault)',
);

export interface DiscoveryOptions {
  factoryAddress: Address;
  deployBlockNumber: number;
  chunkSize?: number;
  confirmationDepth?: number;
  maxBlocks?: number;
}

export interface DiscoveryResult {
  newVaultsCount: number;
  totalVaultsCount: number;
  currentCursor: number;
  fromBlock: number;
  toBlock: number;
}

export async function discoverVaults(
  client: PublicClient,
  store: StoreInterface,
  options: DiscoveryOptions,
  logger?: { debug: Function; info: Function; error: Function },
): Promise<DiscoveryResult> {
  const latestBlockBigInt = await client.getBlockNumber();
  const latestBlock = Number(latestBlockBigInt);
  const confirmationDepth = options.confirmationDepth ?? 6;
  const chunkSize = options.chunkSize ?? 2000;

  // Reorg protection: index up to (latestBlock - confirmationDepth)
  let safeTargetBlock = Math.max(options.deployBlockNumber, latestBlock - confirmationDepth);

  const savedCursor = await store.getCursor();
  let currentBlock = savedCursor !== null
    ? Math.max(options.deployBlockNumber, savedCursor - confirmationDepth)
    : options.deployBlockNumber;

  if (options.maxBlocks && safeTargetBlock > currentBlock + options.maxBlocks) {
    safeTargetBlock = currentBlock + options.maxBlocks;
  }

  let newlyDiscovered = 0;
  const startBlock = currentBlock;

  if (currentBlock > safeTargetBlock) {
    const totalCount = await store.getVaultCount();
    return {
      newVaultsCount: 0,
      totalVaultsCount: totalCount,
      currentCursor: savedCursor ?? currentBlock,
      fromBlock: startBlock,
      toBlock: safeTargetBlock,
    };
  }

  logger?.debug?.(
    { fromBlock: currentBlock, toBlock: safeTargetBlock, chunkSize },
    'Scanning for VaultCreated events',
  );

  while (currentBlock <= safeTargetBlock) {
    const chunkTo = Math.min(safeTargetBlock, currentBlock + chunkSize - 1);

    try {
      const logs = await client.getLogs({
        address: options.factoryAddress,
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
            await store.saveVault(tracked);
            newlyDiscovered++;
            logger?.info?.(
              { vault, owner, blockNumber: Number(log.blockNumber), txHash: log.transactionHash },
              'Discovered Ballast vault',
            );
          }
        }
      }

      await store.saveCursor(chunkTo);
      currentBlock = chunkTo + 1;
    } catch (err) {
      logger?.error?.(
        { err, fromBlock: currentBlock, toBlock: chunkTo },
        'Error indexing VaultCreated events in block range',
      );
      throw err;
    }
  }

  const totalVaultsCount = await store.getVaultCount();

  return {
    newVaultsCount: newlyDiscovered,
    totalVaultsCount,
    currentCursor: safeTargetBlock,
    fromBlock: startBlock,
    toBlock: safeTargetBlock,
  };
}
