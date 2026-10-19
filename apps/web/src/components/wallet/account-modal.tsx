'use client';

import React, { useState } from 'react';
import { useAccount, useBalance, useDisconnect, useReadContract } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';
import { useWalletAccount } from '@mezo-org/passport/dist/src/hooks/useWalletAccount.js';
import { MATSNET_PROTOCOL_ADDRESSES } from '@ballast/shared';
import { MEZO_TESTNET_CHAIN_ID, EXPLORER_URL, FAUCET_URL } from '../../lib/chains';
import { Dialog } from '../ui/dialog';
import { Button } from '../ui/button';
import { Copy, Check, ExternalLink, LogOut, ShieldCheck, Droplet } from 'lucide-react';

export interface AccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountModal({ open, onOpenChange }: AccountModalProps) {
  const { isConnected } = useAccount();
  const { accountAddress, walletAddress, networkFamily, connector } = useWalletAccount();
  const { disconnect } = useDisconnect();

  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedBtc, setCopiedBtc] = useState(false);

  // Read native BTC balance on Mezo
  const { data: btcBalance, isLoading: btcLoading } = useBalance({
    address: accountAddress,
    chainId: MEZO_TESTNET_CHAIN_ID,
  });

  // Read MUSD token balance on Mezo
  const { data: musdRaw, isLoading: musdLoading } = useReadContract({
    address: MATSNET_PROTOCOL_ADDRESSES.musd,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: accountAddress ? [accountAddress] : undefined,
    chainId: MEZO_TESTNET_CHAIN_ID,
  });

  const formattedMusd =
    musdRaw !== undefined
      ? Number(formatUnits(musdRaw, 18)).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        })
      : '0.00';
  const formattedBtc = btcBalance
    ? Number(formatUnits(btcBalance.value, btcBalance.decimals)).toLocaleString('en-US', {
        minimumFractionDigits: 4,
        maximumFractionDigits: 6,
      })
    : '0.0000';

  const copyToClipboard = (text: string, type: 'account' | 'btc') => {
    navigator.clipboard.writeText(text);
    if (type === 'account') {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } else {
      setCopiedBtc(true);
      setTimeout(() => setCopiedBtc(false), 2000);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    onOpenChange(false);
  };

  if (!isConnected || !accountAddress) {
    return null;
  }

  const isBitcoinWallet = networkFamily === 'bitcoin';
  const walletTypeLabel = isBitcoinWallet
    ? 'Bitcoin wallet via Mezo smart account'
    : 'EVM wallet';

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Connected Account"
      description={`Mezo Testnet (Chain ID: ${MEZO_TESTNET_CHAIN_ID}) — ${connector?.name ?? 'Wallet'}`}
      className="max-w-md"
    >
      <div className="space-y-4 py-2 text-xs font-mono">
        {/* Wallet Type Badge */}
        <div className="p-2.5 rounded-sm border border-hairline bg-paper flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-safe stroke-[1.5]" />
            <span className="text-ink-muted">Architecture:</span>
          </div>
          <span className="font-semibold text-ink text-right">{walletTypeLabel}</span>
        </div>

        {/* On-Chain Mezo Account (Smart Account for Bitcoin wallets or EVM Address) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-ink-muted text-[11px]">
            <span>ON-CHAIN MSG.SENDER (MEZO ACCOUNT)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyToClipboard(accountAddress, 'account')}
                className="hover:text-ink flex items-center gap-1 focus-visible:outline-none"
                title="Copy address"
              >
                {copiedAccount ? <Check className="w-3.5 h-3.5 text-safe" /> : <Copy className="w-3.5 h-3.5 stroke-[1.5]" />}
                <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
              </button>
              <a
                href={`${EXPLORER_URL}/address/${accountAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink flex items-center gap-1"
                title="View in explorer"
              >
                <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
                <span>Explorer</span>
              </a>
            </div>
          </div>
          <div className="p-2.5 rounded-sm border border-hairline bg-paper-surface font-mono text-ink break-all text-[12px] select-all">
            {accountAddress}
          </div>
        </div>

        {/* Bitcoin Address (if applicable) */}
        {isBitcoinWallet && walletAddress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-ink-muted text-[11px]">
              <span>SIGNER BITCOIN ADDRESS</span>
              <button
                type="button"
                onClick={() => copyToClipboard(walletAddress, 'btc')}
                className="hover:text-ink flex items-center gap-1 focus-visible:outline-none"
                title="Copy Bitcoin address"
              >
                {copiedBtc ? <Check className="w-3.5 h-3.5 text-safe" /> : <Copy className="w-3.5 h-3.5 stroke-[1.5]" />}
                <span>{copiedBtc ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-2.5 rounded-sm border border-hairline bg-paper-surface font-mono text-ink break-all text-[12px] select-all">
              {walletAddress}
            </div>
          </div>
        )}

        {/* On-Chain Balances */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-sm border border-hairline bg-paper space-y-1">
            <div className="text-[11px] text-ink-muted uppercase">Native BTC</div>
            <div className="text-sm font-bold font-mono text-ink tabular-nums">
              {btcLoading ? 'Loading...' : `${formattedBtc} BTC`}
            </div>
          </div>

          <div className="p-3 rounded-sm border border-hairline bg-paper space-y-1">
            <div className="text-[11px] text-ink-muted uppercase">MUSD Debt / Stablecoin</div>
            <div className="text-sm font-bold font-mono text-ink tabular-nums">
              {musdLoading ? 'Loading...' : `${formattedMusd} MUSD`}
            </div>
          </div>
        </div>

        {/* Faucet Link */}
        <div className="pt-2">
          <a
            href={FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-2.5 rounded-sm border border-hairline bg-paper hover:border-hairline-strong transition-colors text-ink group"
          >
            <div className="flex items-center gap-2">
              <Droplet className="w-4 h-4 text-watch stroke-[1.5]" />
              <span className="font-semibold">Get testnet BTC</span>
            </div>
            <span className="text-[11px] text-ink-muted flex items-center gap-1 group-hover:text-ink">
              Mezo Faucet
              <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
            </span>
          </a>
        </div>
      </div>

      {/* Modal Actions */}
      <div className="border-t border-hairline pt-4 mt-2 flex items-center justify-between">
        <Button
          size="sm"
          variant="quiet"
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>

        <Button
          size="sm"
          variant="danger"
          onClick={handleDisconnect}
          className="flex items-center gap-1.5"
        >
          <LogOut className="w-3.5 h-3.5 stroke-[1.5]" />
          Disconnect
        </Button>
      </div>
    </Dialog>
  );
}
