import { type Address, zeroAddress, type PublicClient } from 'viem';
import { MATSNET_PROTOCOL_ADDRESSES, SortedTrovesAbi } from '@ballast/shared';

/**
 * Computes off-chain SortedTroves insertion hints for borrower operations.
 * NICR = (collateral * 1e20) / debt
 */
export async function getInsertionHints(
  publicClient: PublicClient,
  collateral: bigint,
  debt: bigint
): Promise<{ upperHint: Address; lowerHint: Address }> {
  if (debt === 0n || collateral === 0n) {
    return { upperHint: zeroAddress, lowerHint: zeroAddress };
  }

  try {
    const nicr = (collateral * 10n ** 20n) / debt;
    const [first, last] = await Promise.all([
      publicClient.readContract({
        address: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
        abi: SortedTrovesAbi,
        functionName: 'getFirst',
      }) as Promise<Address>,
      publicClient.readContract({
        address: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
        abi: SortedTrovesAbi,
        functionName: 'getLast',
      }) as Promise<Address>,
    ]);

    const hints = (await publicClient.readContract({
      address: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
      abi: SortedTrovesAbi,
      functionName: 'findInsertPosition',
      args: [nicr, first, last],
    })) as [Address, Address];

    return {
      upperHint: hints[0] || zeroAddress,
      lowerHint: hints[1] || zeroAddress,
    };
  } catch {
    return { upperHint: zeroAddress, lowerHint: zeroAddress };
  }
}

export const computeInsertHints = getInsertionHints;

