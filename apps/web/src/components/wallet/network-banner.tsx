'use client';

import React, { useState } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { MEZO_TESTNET_CHAIN_ID } from '../../lib/chains';
import { AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';

export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If not connected or already on Mezo Testnet, render nothing
  if (!isConnected || chainId === MEZO_TESTNET_CHAIN_ID) {
    return null;
  }

  const handleSwitch = async () => {
    setErrorMsg(null);
    try {
      await switchChainAsync({ chainId: MEZO_TESTNET_CHAIN_ID });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('rejected') || msg.includes('denied')) {
        setErrorMsg('Network switch cancelled in wallet.');
      } else {
        setErrorMsg('Failed to switch network. Please add Mezo Testnet manually.');
      }
    }
  };

  return (
    <div
      role="alert"
      className="bg-danger/10 border-b border-danger/30 text-ink px-4 py-2.5 text-xs font-mono transition-colors"
    >
      <div className="max-w-container mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0 stroke-[1.5]" />
          <span>
            <strong className="font-semibold text-danger">WRONG NETWORK:</strong> Connected to chain{' '}
            <code className="px-1 py-0.5 rounded-sm bg-danger/15 text-danger font-mono font-bold">
              {chainId ?? 'unknown'}
            </code>
            . Ballast operates strictly on Mezo Testnet (Chain ID: 31611). All actions are locked.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {errorMsg && <span className="text-danger text-[11px]">{errorMsg}</span>}
          <Button
            size="sm"
            variant="danger"
            onClick={handleSwitch}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs h-7 px-2.5"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Switching...
              </>
            ) : (
              <>
                Switch to Mezo Testnet
                <ArrowRight className="w-3.5 h-3.5 stroke-[1.5]" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
