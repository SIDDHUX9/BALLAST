import { type Address, type PublicClient, zeroAddress } from 'viem';
import { MATSNET_PROTOCOL_ADDRESSES, SortedTrovesAbi, HintHelpersAbi } from '@ballast/shared';

export interface HintPair {
  upperHint: Address;
  lowerHint: Address;
}

/**
 * Computes upper and lower insert hints for SortedTroves using HintHelpers and SortedTroves.
 */
export async function computeInsertHints(
  publicClient: PublicClient,
  collateral: bigint,
  debt: bigint,
): Promise<HintPair> {
  if (debt === 0n || collateral === 0n) {
    return { upperHint: zeroAddress, lowerHint: zeroAddress };
  }

  // NICR = (collateral * 1e20) / debt
  const nicr = (collateral * 10n ** 20n) / debt;

  try {
    // 1. Check head and tail of SortedTroves for fast O(1) boundary insert
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

    if (first === zeroAddress) {
      // Empty list
      return { upperHint: zeroAddress, lowerHint: zeroAddress };
    }

    // Try finding insert position directly
    const [prevId, nextId] = (await publicClient.readContract({
      address: MATSNET_PROTOCOL_ADDRESSES.sortedTroves,
      abi: SortedTrovesAbi,
      functionName: 'findInsertPosition',
      args: [nicr, first, last],
    })) as [Address, Address];

    return {
      upperHint: prevId,
      lowerHint: nextId,
    };
  } catch {
    // Return zero hints as fallback; protocol will search from head if hints are 0
    return { upperHint: zeroAddress, lowerHint: zeroAddress };
  }
}
