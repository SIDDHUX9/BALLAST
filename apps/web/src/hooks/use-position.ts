'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useBlockNumber } from 'wagmi';
import { type Address, isAddress, zeroAddress } from 'viem';
import {
  MATSNET_PROTOCOL_ADDRESSES,
  TroveManagerAbi,
  PriceFeedAbi,
  computeICR,
  computeLiquidationPrice,
  PROTOCOL_CONSTANTS,
  PRECISION,
} from '@ballast/shared';

export type TroveStatusString =
  | 'nonExistent'
  | 'active'
  | 'closedByOwner'
  | 'closedByLiquidation'
  | 'closedByRedemption';

export interface UsePositionResult {
  collateral: bigint | null;
  debt: bigint | null;
  netDebt: bigint | null;
  status: TroveStatusString | null;
  statusRaw: number | null;
  price: bigint | null;
  icr: bigint | null;
  icrPercent: number | null;
  liquidationPrice: bigint | null;
  tcr: bigint | null;
  tcrPercent: number | null;
  isRecoveryMode: boolean | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

function parseTroveStatus(code: number): TroveStatusString {
  switch (code) {
    case 1:
      return 'active';
    case 2:
      return 'closedByOwner';
    case 3:
      return 'closedByLiquidation';
    case 4:
      return 'closedByRedemption';
    default:
      return 'nonExistent';
  }
}

export function usePosition(vaultAddress?: Address): UsePositionResult {
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const query = useQuery({
    queryKey: ['position', vaultAddress?.toLowerCase(), Number(blockNumber ?? 0n)],
    enabled: Boolean(publicClient && vaultAddress && isAddress(vaultAddress) && vaultAddress !== zeroAddress),
    queryFn: async () => {
      if (!publicClient || !vaultAddress) {
        return null;
      }

      // Step 1: Read Trove state & Price in parallel
      const [collRes, debtRes, statusRes, priceRes] = await Promise.all([
        publicClient.readContract({
          address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
          abi: TroveManagerAbi,
          functionName: 'getTroveColl',
          args: [vaultAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
          abi: TroveManagerAbi,
          functionName: 'getTroveDebt',
          args: [vaultAddress],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
          abi: TroveManagerAbi,
          functionName: 'getTroveStatus',
          args: [vaultAddress],
        }) as Promise<number>,
        publicClient.readContract({
          address: MATSNET_PROTOCOL_ADDRESSES.priceFeed,
          abi: PriceFeedAbi,
          functionName: 'fetchPrice',
        }) as Promise<bigint>,
      ]);

      const status = parseTroveStatus(statusRes);
      const netDebt = debtRes > PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION
        ? debtRes - PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION
        : 0n;

      // Step 2: Read system TCR and Recovery Mode using current price
      let tcr = 0n;
      let isRecoveryMode = false;

      try {
        const [tcrRes, recoveryRes] = await Promise.all([
          publicClient.readContract({
            address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
            abi: TroveManagerAbi,
            functionName: 'getTCR',
            args: [priceRes],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
            abi: TroveManagerAbi,
            functionName: 'checkRecoveryMode',
            args: [priceRes],
          }) as Promise<boolean>,
        ]);
        tcr = tcrRes;
        isRecoveryMode = recoveryRes;
      } catch {
        // Fallback if price is zero or call reverts
      }

      // Derived calculations
      let icr: bigint | null = null;
      let icrPercent: number | null = null;
      let liquidationPrice: bigint | null = null;

      if (status === 'active' && debtRes > 0n && collRes > 0n && priceRes > 0n) {
        icr = computeICR(collRes, debtRes, priceRes);
        icrPercent = Number((icr * 10000n) / PRECISION) / 100;
        liquidationPrice = computeLiquidationPrice(collRes, debtRes, PROTOCOL_CONSTANTS.MCR);
      }

      const tcrPercent = tcr > 0n ? Number((tcr * 10000n) / PRECISION) / 100 : null;

      return {
        collateral: collRes,
        debt: debtRes,
        netDebt,
        status,
        statusRaw: statusRes,
        price: priceRes,
        icr,
        icrPercent,
        liquidationPrice,
        tcr: tcr > 0n ? tcr : null,
        tcrPercent,
        isRecoveryMode,
      };
    },
    staleTime: 10_000,
  });

  return {
    collateral: query.data?.collateral ?? null,
    debt: query.data?.debt ?? null,
    netDebt: query.data?.netDebt ?? null,
    status: query.data?.status ?? null,
    statusRaw: query.data?.statusRaw ?? null,
    price: query.data?.price ?? null,
    icr: query.data?.icr ?? null,
    icrPercent: query.data?.icrPercent ?? null,
    liquidationPrice: query.data?.liquidationPrice ?? null,
    tcr: query.data?.tcr ?? null,
    tcrPercent: query.data?.tcrPercent ?? null,
    isRecoveryMode: query.data?.isRecoveryMode ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
