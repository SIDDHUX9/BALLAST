import { type Address, type PublicClient, zeroAddress } from 'viem';
import type { Logger } from 'pino';

const TROVE_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getEntireDebtAndColl',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [
      { name: 'debt', type: 'uint256' },
      { name: 'coll', type: 'uint256' },
      { name: 'pendingDebtReward', type: 'uint256' },
      { name: 'pendingCollReward', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

// Also support alternative 6-tuple signature from Mezo TroveManager if used:
const TROVE_MANAGER_ALT_ABI = [
  {
    type: 'function',
    name: 'getEntireDebtAndColl',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [
      { name: 'coll', type: 'uint256' },
      { name: 'principal', type: 'uint256' },
      { name: 'interest', type: 'uint256' },
      { name: 'pendingCollateral', type: 'uint256' },
      { name: 'pendingPrincipal', type: 'uint256' },
      { name: 'pendingInterest', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

const SORTED_TROVES_ABI = [
  {
    type: 'function',
    name: 'getFirst',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLast',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'findInsertPosition',
    inputs: [
      { name: '_NICR', type: 'uint256' },
      { name: '_prevId', type: 'address' },
      { name: '_nextId', type: 'address' },
    ],
    outputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' },
    ],
    stateMutability: 'view',
  },
] as const;

export interface HintPair {
  upperHint: Address;
  lowerHint: Address;
}

export async function computeDefenseHints(
  client: PublicClient,
  vault: Address,
  troveManager: Address,
  sortedTroves: Address,
  musdToRepay: bigint,
  btcToAdd: bigint,
  logger?: Logger,
): Promise<HintPair> {
  const fallbackHints: HintPair = {
    upperHint: zeroAddress,
    lowerHint: zeroAddress,
  };

  try {
    let totalColl = 0n;
    let totalDebt = 0n;

    try {
      const res = await client.readContract({
        address: troveManager,
        abi: TROVE_MANAGER_ALT_ABI,
        functionName: 'getEntireDebtAndColl',
        args: [vault],
      });
      // 6-tuple: coll, principal, interest, pendingCollateral, pendingPrincipal, pendingInterest
      totalColl = res[0] + res[3];
      totalDebt = res[1] + res[2] + res[4] + res[5];
    } catch {
      // Fallback to 4-tuple
      const res4 = await client.readContract({
        address: troveManager,
        abi: TROVE_MANAGER_ABI,
        functionName: 'getEntireDebtAndColl',
        args: [vault],
      });
      totalColl = res4[1] + res4[3];
      totalDebt = res4[0] + res4[2];
    }

    const newColl = totalColl + btcToAdd;
    const newDebt = totalDebt > musdToRepay ? totalDebt - musdToRepay : 0n;

    if (newDebt === 0n) {
      return fallbackHints;
    }

    // NICR = (coll * 1e20) / debt
    const nicr = (newColl * 10n ** 20n) / newDebt;

    // Read head and tail
    let first: Address = zeroAddress;
    let last: Address = zeroAddress;

    try {
      const [headRes, tailRes] = await Promise.all([
        client.readContract({
          address: sortedTroves,
          abi: SORTED_TROVES_ABI,
          functionName: 'getFirst',
        }),
        client.readContract({
          address: sortedTroves,
          abi: SORTED_TROVES_ABI,
          functionName: 'getLast',
        }),
      ]);
      first = headRes;
      last = tailRes;
    } catch {
      // ignore, first and last remain zeroAddress
    }

    const hints = await client.readContract({
      address: sortedTroves,
      abi: SORTED_TROVES_ABI,
      functionName: 'findInsertPosition',
      args: [nicr, first, last],
    });

    return {
      upperHint: hints[0] as Address,
      lowerHint: hints[1] as Address,
    };
  } catch (err) {
    logger?.debug({ err, vault }, 'Hint computation used fallback zero hints');
    return fallbackHints;
  }
}
