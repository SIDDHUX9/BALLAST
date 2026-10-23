'use client';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicClient, useBlockNumber } from 'wagmi';
import { type Address, zeroAddress, isAddress } from 'viem';
import { BallastFactoryAbi } from '@ballast/shared';
import matsnetDeployment from '../../../../deployments/matsnet.json';

export const FACTORY_ADDRESS = (matsnetDeployment.ballastFactory || '0x8d5b392839300b487addeecc35f5bc534111cd33') as Address;

export interface UseVaultResult {
  vaultAddress: Address | undefined;
  predictedAddress: Address | undefined;
  exists: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useVault(owner?: Address): UseVaultResult {
  const publicClient = usePublicClient();
  const { data: blockNumber } = useBlockNumber({ watch: true });

  const query = useQuery({
    queryKey: ['vault', owner?.toLowerCase(), FACTORY_ADDRESS.toLowerCase()],
    enabled: Boolean(publicClient && owner && isAddress(owner)),
    placeholderData: (previousData) => previousData,
    queryFn: async (): Promise<{ vaultAddress: Address | undefined; predictedAddress: Address | undefined; exists: boolean }> => {
      if (!publicClient || !owner) {
        return { vaultAddress: undefined, predictedAddress: undefined, exists: false };
      }

      const results = await publicClient.multicall({
        contracts: [
          {
            address: FACTORY_ADDRESS,
            abi: BallastFactoryAbi,
            functionName: 'vaultOf',
            args: [owner],
          },
          {
            address: FACTORY_ADDRESS,
            abi: BallastFactoryAbi,
            functionName: 'predictVault',
            args: [owner],
          },
        ],
        allowFailure: false,
      });

      const deployedVault = results[0] as Address;
      const predictedVault = results[1] as Address;

      const exists = deployedVault !== zeroAddress && deployedVault.toLowerCase() !== zeroAddress.toLowerCase();

      return {
        vaultAddress: exists ? deployedVault : undefined,
        predictedAddress: predictedVault,
        exists,
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
    vaultAddress: query.data?.vaultAddress,
    predictedAddress: query.data?.predictedAddress,
    exists: query.data?.exists ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
  };
}
