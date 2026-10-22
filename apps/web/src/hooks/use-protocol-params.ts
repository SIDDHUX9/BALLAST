'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import {
  BorrowerOperationsAbi,
  MATSNET_PROTOCOL_ADDRESSES,
  PROTOCOL_CONSTANTS,
  PRECISION,
} from '@ballast/shared';

export interface ProtocolParams {
  mcr: bigint;
  mcrPercent: number;
  ccr: bigint;
  ccrPercent: number;
  minNetDebt: bigint;
  gasCompensation: bigint;
  musdDecimals: number;
  btcDecimals: number;
  getBorrowingFee: (amount: bigint) => Promise<bigint>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useProtocolParams(): ProtocolParams {
  const publicClient = usePublicClient();

  const query = useQuery({
    queryKey: ['protocol-params'],
    queryFn: async () => {
      let minNetDebt: bigint = PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT;

      if (publicClient) {
        try {
          const res = (await publicClient.readContract({
            address: MATSNET_PROTOCOL_ADDRESSES.borrowerOperations,
            abi: BorrowerOperationsAbi,
            functionName: 'minNetDebt',
          })) as bigint;
          if (res > 0n) {
            minNetDebt = res;
          }
        } catch {
          // Fallback to default 1,800 MUSD
        }
      }

      return {
        minNetDebt,
      };
    },
    staleTime: 60_000,
  });

  const minNetDebt = query.data?.minNetDebt ?? PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT;

  const getBorrowingFee = async (musdAmount: bigint): Promise<bigint> => {
    if (!publicClient || musdAmount === 0n) return 0n;
    try {
      const fee = (await publicClient.readContract({
        address: MATSNET_PROTOCOL_ADDRESSES.borrowerOperations,
        abi: BorrowerOperationsAbi,
        functionName: 'getBorrowingFee',
        args: [musdAmount],
      })) as bigint;
      return fee;
    } catch {
      // 0.5% default borrowing fee if RPC view fails
      return (musdAmount * 5n) / 1000n;
    }
  };

  return {
    mcr: PROTOCOL_CONSTANTS.MCR,
    mcrPercent: Number((PROTOCOL_CONSTANTS.MCR * 10000n) / PRECISION) / 100,
    ccr: PROTOCOL_CONSTANTS.CCR,
    ccrPercent: Number((PROTOCOL_CONSTANTS.CCR * 10000n) / PRECISION) / 100,
    minNetDebt,
    gasCompensation: PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION,
    musdDecimals: PROTOCOL_CONSTANTS.MUSD_DECIMALS,
    btcDecimals: PROTOCOL_CONSTANTS.BTC_DECIMALS,
    getBorrowingFee,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
