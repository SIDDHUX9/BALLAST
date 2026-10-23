'use client';

import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useBlockNumber, useAccount } from 'wagmi';
import { type Address, isAddress, zeroAddress } from 'viem';
import {
  BallastVaultAbi,
  MusdAbi,
  MATSNET_PROTOCOL_ADDRESSES,
  computeAbsorptionCapacity,
  PROTOCOL_CONSTANTS,
} from '@ballast/shared';

export interface UseReservesParams {
  vaultAddress?: Address;
  collateral?: bigint | null;
  debt?: bigint | null;
  price?: bigint | null;
  targetICR?: bigint | null;
}

export interface UseReservesResult {
  musdReserve: bigint | null;
  btcReserve: bigint | null;
  userMusdBalance: bigint | null;
  userBtcBalance: bigint | null;
  musdAllowance: bigint | null;
  defenseCapacity: {
    criticalPrice: bigint;
    absorbableDropPercent: number;
  } | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useReserves({
  vaultAddress,
  collateral,
  debt,
  price,
  targetICR,
}: UseReservesParams = {}): UseReservesResult {
  const publicClient = usePublicClient();
  const { address: userAddress } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const query = useQuery({
    queryKey: [
      'reserves',
      vaultAddress?.toLowerCase(),
      userAddress?.toLowerCase(),
    ],
    enabled: Boolean(publicClient && vaultAddress && isAddress(vaultAddress) && vaultAddress !== zeroAddress),
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      if (!publicClient || !vaultAddress) return null;

      const calls: Promise<unknown>[] = [
        publicClient.readContract({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'musdReserve',
        }),
        publicClient.readContract({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'btcReserve',
        }),
      ];

      if (userAddress) {
        calls.push(
          publicClient.readContract({
            address: MATSNET_PROTOCOL_ADDRESSES.musd,
            abi: MusdAbi,
            functionName: 'balanceOf',
            args: [userAddress],
          }),
          publicClient.getBalance({ address: userAddress }),
          publicClient.readContract({
            address: MATSNET_PROTOCOL_ADDRESSES.musd,
            abi: MusdAbi,
            functionName: 'allowance',
            args: [userAddress, vaultAddress],
          }),
        );
      }

      const results = await Promise.all(calls);

      const musdReserve = results[0] as bigint;
      const btcReserve = results[1] as bigint;
      const userMusdBalance = userAddress ? (results[2] as bigint) : 0n;
      const userBtcBalance = userAddress ? (results[3] as bigint) : 0n;
      const musdAllowance = userAddress ? (results[4] as bigint) : 0n;

      return {
        musdReserve,
        btcReserve,
        userMusdBalance,
        userBtcBalance,
        musdAllowance,
      };
    },
    staleTime: 10_000,
  });

  useEffect(() => {
    if (blockNumber) {
      query.refetch();
    }
  }, [blockNumber]);

  const defenseCapacity = useMemo(() => {
    const musdReserve = query.data?.musdReserve;
    const btcReserve = query.data?.btcReserve;
    if (
      musdReserve !== undefined &&
      musdReserve !== null &&
      btcReserve !== undefined &&
      btcReserve !== null &&
      collateral !== undefined &&
      collateral !== null &&
      debt !== undefined &&
      debt !== null &&
      price !== undefined &&
      price !== null &&
      targetICR !== undefined &&
      targetICR !== null &&
      targetICR > 0n
    ) {
      return computeAbsorptionCapacity(
        collateral,
        debt,
        price,
        targetICR,
        musdReserve,
        btcReserve,
        PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT,
      );
    }
    return null;
  }, [query.data?.musdReserve, query.data?.btcReserve, collateral, debt, price, targetICR]);

  return {
    musdReserve: query.data?.musdReserve ?? null,
    btcReserve: query.data?.btcReserve ?? null,
    userMusdBalance: query.data?.userMusdBalance ?? null,
    userBtcBalance: query.data?.userBtcBalance ?? null,
    musdAllowance: query.data?.musdAllowance ?? null,
    defenseCapacity,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
