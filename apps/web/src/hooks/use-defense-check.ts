'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useBlockNumber } from 'wagmi';
import { type Address, isAddress, zeroAddress } from 'viem';
import { BallastVaultAbi, PRECISION } from '@ballast/shared';

export interface UseDefenseCheckResult {
  defendable: boolean | null;
  currentICR: bigint | null;
  icrPercent: number | null;
  musdToRepay: bigint | null;
  btcToAdd: bigint | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useDefenseCheck(vaultAddress?: Address): UseDefenseCheckResult {
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const query = useQuery({
    queryKey: ['defense-check', vaultAddress?.toLowerCase(), Number(blockNumber ?? 0n)],
    enabled: Boolean(publicClient && vaultAddress && isAddress(vaultAddress) && vaultAddress !== zeroAddress),
    queryFn: async () => {
      if (!publicClient || !vaultAddress) return null;

      const res = (await publicClient.readContract({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'checkDefense',
      })) as [boolean, bigint, bigint, bigint];

      const defendable = res[0];
      const currentICR = res[1];
      const musdToRepay = res[2];
      const btcToAdd = res[3];
      const icrPercent = currentICR > 0n ? Number((currentICR * 10000n) / PRECISION) / 100 : null;

      return {
        defendable,
        currentICR,
        icrPercent,
        musdToRepay,
        btcToAdd,
      };
    },
    staleTime: 10_000,
  });

  return {
    defendable: query.data?.defendable ?? null,
    currentICR: query.data?.currentICR ?? null,
    icrPercent: query.data?.icrPercent ?? null,
    musdToRepay: query.data?.musdToRepay ?? null,
    btcToAdd: query.data?.btcToAdd ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
