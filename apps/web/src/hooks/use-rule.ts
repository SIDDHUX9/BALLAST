'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useBlockNumber } from 'wagmi';
import { type Address, isAddress, zeroAddress } from 'viem';
import { BallastVaultAbi, PRECISION } from '@ballast/shared';

export interface UseRuleResult {
  enabled: boolean | null;
  triggerICR: bigint | null;
  targetICR: bigint | null;
  maxTipBps: number | null;
  triggerPercent: number | null;
  targetPercent: number | null;
  maxTipPercent: number | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useRule(vaultAddress?: Address): UseRuleResult {
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const query = useQuery({
    queryKey: ['rule', vaultAddress?.toLowerCase()],
    enabled: Boolean(publicClient && vaultAddress && isAddress(vaultAddress) && vaultAddress !== zeroAddress),
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      if (!publicClient || !vaultAddress) return null;

      const ruleRes = (await publicClient.readContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'rule',
      })) as [boolean, bigint, bigint, number];

      const enabled = ruleRes[0];
      const triggerICR = ruleRes[1];
      const targetICR = ruleRes[2];
      const maxTipBps = ruleRes[3];

      const triggerPercent = triggerICR > 0n ? Number((triggerICR * 10000n) / PRECISION) / 100 : 0;
      const targetPercent = targetICR > 0n ? Number((targetICR * 10000n) / PRECISION) / 100 : 0;
      const maxTipPercent = maxTipBps > 0 ? maxTipBps / 100 : 0;

      return {
        enabled,
        triggerICR,
        targetICR,
        maxTipBps,
        triggerPercent,
        targetPercent,
        maxTipPercent,
      };
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (blockNumber) {
      query.refetch();
    }
  }, [blockNumber]);

  return {
    enabled: query.data?.enabled ?? null,
    triggerICR: query.data?.triggerICR ?? null,
    targetICR: query.data?.targetICR ?? null,
    maxTipBps: query.data?.maxTipBps ?? null,
    triggerPercent: query.data?.triggerPercent ?? null,
    targetPercent: query.data?.targetPercent ?? null,
    maxTipPercent: query.data?.maxTipPercent ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
