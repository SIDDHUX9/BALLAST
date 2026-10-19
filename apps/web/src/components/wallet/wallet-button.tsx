'use client';

import React, { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Button } from '../ui/button';
import { AccountModal } from './account-modal';
import { AlertCircle, Wallet } from 'lucide-react';

export function WalletButton() {
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  return (
    <>
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openConnectModal,
          openChainModal,
          mounted,
        }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          if (!ready) {
            return (
              <Button size="sm" variant="secondary" disabled className="opacity-50">
                <span className="w-16 h-4 bg-hairline rounded animate-pulse" />
              </Button>
            );
          }

          if (!connected) {
            return (
              <Button
                size="sm"
                variant="primary"
                onClick={openConnectModal}
                className="flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 stroke-[1.5]" />
                Connect Wallet
              </Button>
            );
          }

          if (chain.unsupported) {
            return (
              <Button
                size="sm"
                variant="danger"
                onClick={openChainModal}
                className="flex items-center gap-1.5"
              >
                <AlertCircle className="w-3.5 h-3.5 stroke-[1.5]" />
                Wrong Network
              </Button>
            );
          }

          return (
            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              className="flex items-center gap-2 h-8 px-2.5 rounded-sm border border-hairline bg-paper-surface hover:border-hairline-strong transition-colors text-xs font-mono text-ink focus-visible:outline-none"
              title="View account details"
            >
              <span className="w-2 h-2 rounded-full bg-safe shrink-0" />
              <span className="font-semibold">{account.displayName}</span>
              {account.displayBalance && (
                <>
                  <span className="text-hairline-strong">|</span>
                  <span className="text-ink-muted tabular-nums">{account.displayBalance}</span>
                </>
              )}
            </button>
          );
        }}
      </ConnectButton.Custom>

      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
      />
    </>
  );
}
