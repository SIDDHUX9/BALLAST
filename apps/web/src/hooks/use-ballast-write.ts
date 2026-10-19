'use client';

import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { Address, Abi, encodeFunctionData, TransactionReceipt } from 'viem';
import { useWalletAccount } from '@mezo-org/passport/dist/src/hooks/useWalletAccount.js';
import { useSendTransaction as useOrangeKitSendTx } from '@mezo-org/passport/dist/src/hooks/index.js';
import { mezoTestnet, MEZO_TESTNET_CHAIN_ID } from '../lib/chains';
import { decodeContractError } from '../lib/errors';

export type WriteStatus =
  | 'idle'
  | 'simulating'
  | 'awaiting_signature'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export interface BallastWriteArgs<TAbi extends Abi = Abi, TFunctionName extends string = string> {
  address: Address;
  abi: TAbi;
  functionName: TFunctionName;
  args?: readonly unknown[];
  value?: bigint;
}

export interface UseBallastWriteReturn {
  write: (params: BallastWriteArgs) => Promise<TransactionReceipt | undefined>;
  writeAsync: (params: BallastWriteArgs) => Promise<TransactionReceipt>;
  status: WriteStatus;
  txHash: `0x${string}` | null;
  receipt: TransactionReceipt | null;
  error: string | null;
  reset: () => void;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Universal transaction execution hook for Ballast.
 * Routes automatically between Bitcoin smart accounts (OrangeKit) and native EVM wallets.
 * Always simulates before asking for wallet signatures.
 * Surfaces typed status states and human-readable error messages.
 */
export function useBallastWrite(): UseBallastWriteReturn {
  const [status, setStatus] = useState<WriteStatus>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { chainId, isConnected } = useAccount();
  const { accountAddress, networkFamily } = useWalletAccount();
  const publicClient = usePublicClient({ chainId: MEZO_TESTNET_CHAIN_ID });
  const { data: walletClient } = useWalletClient();
  const { sendTransaction: orangeKitSendTx } = useOrangeKitSendTx();

  const reset = useCallback(() => {
    setStatus('idle');
    setTxHash(null);
    setReceipt(null);
    setError(null);
  }, []);

  const writeAsync = useCallback(
    async ({ address, abi, functionName, args = [], value = 0n }: BallastWriteArgs): Promise<TransactionReceipt> => {
      // 1. Connection & Chain Pre-checks
      if (!isConnected || !accountAddress) {
        const msg = 'Wallet not connected. Please connect your wallet.';
        setError(msg);
        setStatus('failed');
        throw new Error(msg);
      }

      if (chainId !== MEZO_TESTNET_CHAIN_ID) {
        const msg = 'Wallet connected to wrong network. Please switch to Mezo Testnet (31611).';
        setError(msg);
        setStatus('failed');
        throw new Error(msg);
      }

      if (!publicClient) {
        const msg = 'Public client not initialized for Mezo Testnet.';
        setError(msg);
        setStatus('failed');
        throw new Error(msg);
      }

      reset();

      // 2. Pre-flight Simulation
      setStatus('simulating');
      try {
        await publicClient.simulateContract({
          address,
          abi,
          functionName,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Viem ABI type mapping requires explicit argument casting
          args: args as any,
          value,
          account: accountAddress,
        });
      } catch (simError) {
        const decoded = decodeContractError(simError);
        setError(decoded);
        setStatus('failed');
        throw new Error(decoded, { cause: simError });
      }

      // 3. Execution Routing
      setStatus('awaiting_signature');
      let hash: `0x${string}`;

      try {
        if (networkFamily === 'bitcoin') {
          // Route via OrangeKit smart account relay
          const callData = encodeFunctionData({
            abi,
            functionName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Viem encodeFunctionData requires internal argument inference
            args: args as any,
          });

          const result = await orangeKitSendTx(address, value, callData);
          if (!result || !result.hash) {
            throw new Error('OrangeKit transaction submission failed: no hash returned.');
          }
          hash = result.hash as `0x${string}`;
        } else {
          // Route via standard EVM wallet
          if (!walletClient) {
            throw new Error('EVM Wallet client is not available. Please ensure your wallet is unlocked.');
          }

          hash = await walletClient.writeContract({
            address,
            abi,
            functionName,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Viem writeContract requires internal argument inference
            args: args as any,
            value,
            chain: mezoTestnet,
            account: accountAddress,
          });
        }
      } catch (signError) {
        const decoded = decodeContractError(signError);
        setError(decoded);
        setStatus('failed');
        throw new Error(decoded, { cause: signError });
      }

      // 4. Wait for On-Chain Confirmation
      setTxHash(hash);
      setStatus('submitted');

      try {
        const txReceipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });

        if (txReceipt.status === 'reverted') {
          const revertMsg = 'Transaction reverted on-chain.';
          setError(revertMsg);
          setStatus('failed');
          throw new Error(revertMsg);
        }

        setReceipt(txReceipt);
        setStatus('confirmed');
        return txReceipt;
      } catch (waitError) {
        const decoded = decodeContractError(waitError);
        setError(decoded);
        setStatus('failed');
        throw new Error(decoded, { cause: waitError });
      }
    },
    [
      isConnected,
      accountAddress,
      chainId,
      publicClient,
      walletClient,
      networkFamily,
      orangeKitSendTx,
      reset,
    ]
  );

  const write = useCallback(
    async (params: BallastWriteArgs) => {
      try {
        return await writeAsync(params);
      } catch {
        return undefined;
      }
    },
    [writeAsync]
  );

  return {
    write,
    writeAsync,
    status,
    txHash,
    receipt,
    error,
    reset,
    isPending: status === 'simulating' || status === 'awaiting_signature' || status === 'submitted',
    isSuccess: status === 'confirmed',
    isError: status === 'failed',
  };
}
