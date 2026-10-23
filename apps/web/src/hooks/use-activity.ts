'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useBlockNumber } from 'wagmi';
import { type Address, parseEventLogs, isAddress, zeroAddress } from 'viem';
import { BallastVaultAbi } from '@ballast/shared';
import matsnetDeployment from '../../../../deployments/matsnet.json';

const DEPLOY_BLOCK = BigInt(matsnetDeployment.deployBlockNumber || 16251639);

export interface ActivityItem {
  id: string;
  eventName: string;
  blockNumber: bigint;
  timestamp: number | null;
  txHash: `0x${string}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Viem event log args vary by event type
  args: any;
  summary: string;
}

export interface UseActivityResult {
  activities: ActivityItem[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useActivity(vaultAddress?: Address): UseActivityResult {
  const publicClient = usePublicClient();
  const { data: currentBlock } = useBlockNumber({ watch: true });

  const query = useQuery({
    queryKey: ['activity', vaultAddress?.toLowerCase()],
    enabled: Boolean(publicClient && vaultAddress && isAddress(vaultAddress) && vaultAddress !== zeroAddress),
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      if (!publicClient || !vaultAddress) return [];

      const latestBlock = currentBlock ?? (await publicClient.getBlockNumber());
      // Query bounded window of recent blocks or from deploy block
      const fromBlock = latestBlock > 50000n ? latestBlock - 50000n : DEPLOY_BLOCK;

      const rawLogs = await publicClient.getLogs({
        address: vaultAddress,
        fromBlock,
        toBlock: latestBlock,
      });

      const parsed = parseEventLogs({
        abi: BallastVaultAbi,
        logs: rawLogs,
      });

      // Fetch timestamps for blocks
      const blockNumbers = Array.from(new Set(parsed.map((l) => l.blockNumber)));
      const blockTimes = new Map<bigint, number>();

      await Promise.all(
        blockNumbers.slice(-20).map(async (b) => {
          try {
            const blk = await publicClient.getBlock({ blockNumber: b });
            blockTimes.set(b, Number(blk.timestamp));
          } catch {
            // ignore
          }
        }),
      );

      const items: ActivityItem[] = parsed.map((log) => {
        const eventName = log.eventName;
        const txHash = log.transactionHash;
        const id = `${txHash}-${log.logIndex}`;
        const timestamp = blockTimes.get(log.blockNumber) ?? null;

        let summary = `${eventName} executed`;
        if (eventName === 'Defended') {
          summary = 'Keeper defense executed';
        } else if (eventName === 'ReserveDeposited') {
          summary = 'Reserves deposited';
        } else if (eventName === 'ReserveWithdrawn') {
          summary = 'Reserves withdrawn';
        } else if (eventName === 'RuleSet') {
          summary = 'Protection rule updated';
        } else if (eventName === 'TroveOpened') {
          summary = 'MUSD trove opened';
        } else if (eventName === 'TroveAdjusted') {
          summary = 'Trove collateral/debt adjusted';
        } else if (eventName === 'TroveClosed') {
          summary = 'Trove closed';
        }

        return {
          id,
          eventName,
          blockNumber: log.blockNumber,
          timestamp,
          txHash,
          args: log.args,
          summary,
        };
      });

      // Sort descending by block number
      return items.reverse();
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (currentBlock) {
      query.refetch();
    }
  }, [currentBlock]);

  return {
    activities: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
