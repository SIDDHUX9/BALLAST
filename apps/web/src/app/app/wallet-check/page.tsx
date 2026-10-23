'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccount, useBalance, useReadContract } from 'wagmi';
import { formatUnits, erc20Abi } from 'viem';
import { useWalletAccount } from '@mezo-org/passport/dist/src/hooks/useWalletAccount.js';
import { MATSNET_PROTOCOL_ADDRESSES } from '@ballast/shared';
import { MEZO_TESTNET_CHAIN_ID, EXPLORER_URL } from '../../../lib/chains';
import { useBallastWrite } from '../../../hooks/use-ballast-write';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Stat } from '../../../components/ui/stat';
import { DataRow } from '../../../components/ui/data-row';
import { StatusBadge } from '../../../components/ui/status-badge';
import { AddressChip } from '../../../components/ui/address-chip';
import { MezoBadge } from '../../../components/ui/mezo-badge';
import { TxStatus } from '../../../components/ui/tx-status';
import { WalletButton } from '../../../components/wallet/wallet-button';
import { ArrowLeft, ShieldCheck, Check, Copy, ExternalLink, Activity, Send } from 'lucide-react';

const TROVE_STATUS_NAMES = [
  'Non-Existent',
  'Active',
  'Closed by Owner',
  'Closed by Liquidation',
  'Closed by Redemption',
];

const TROVE_MANAGER_ABI = [
  {
    name: 'Troves',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_borrower', type: 'address' }],
    outputs: [
      { name: 'debt', type: 'uint256' },
      { name: 'coll', type: 'uint256' },
      { name: 'stake', type: 'uint256' },
      { name: 'status', type: 'uint8' },
      { name: 'arrayIndex', type: 'uint128' },
    ],
  },
  {
    name: 'getCurrentICR',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '_borrower', type: 'address' },
      { name: '_price', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const PRICE_FEED_ABI = [
  {
    name: 'lastGoodPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export default function WalletCheckPage() {
  const { isConnected, chainId } = useAccount();
  const { accountAddress, walletAddress, networkFamily, connector } = useWalletAccount();
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [copiedBtc, setCopiedBtc] = useState(false);

  // Ballast universal write abstraction for testing writes
  const { writeAsync, status: writeStatus, txHash, error: writeError, isPending } = useBallastWrite();

  // 1. Native BTC Balance
  const { data: btcBalance, isLoading: btcLoading } = useBalance({
    address: accountAddress,
    chainId: MEZO_TESTNET_CHAIN_ID,
  });

  // 2. MUSD Token Balance
  const { data: musdRaw, isLoading: musdLoading } = useReadContract({
    address: MATSNET_PROTOCOL_ADDRESSES.musd,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: accountAddress ? [accountAddress] : undefined,
    chainId: MEZO_TESTNET_CHAIN_ID,
  });

  // 3. Oracle Price
  const { data: oraclePriceRaw, isLoading: priceLoading } = useReadContract({
    address: MATSNET_PROTOCOL_ADDRESSES.priceFeed,
    abi: PRICE_FEED_ABI,
    functionName: 'lastGoodPrice',
    chainId: MEZO_TESTNET_CHAIN_ID,
  });

  // 4. Trove Status
  const { data: troveDataRaw, isLoading: troveLoading } = useReadContract({
    address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
    abi: TROVE_MANAGER_ABI,
    functionName: 'Troves',
    args: accountAddress ? [accountAddress] : undefined,
    chainId: MEZO_TESTNET_CHAIN_ID,
  });

  // 5. Current ICR
  const { data: currentICRRaw, isLoading: icrLoading } = useReadContract({
    address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
    abi: TROVE_MANAGER_ABI,
    functionName: 'getCurrentICR',
    args: accountAddress && oraclePriceRaw ? [accountAddress, oraclePriceRaw] : undefined,
    chainId: MEZO_TESTNET_CHAIN_ID,
  });

  const copyText = (text: string, type: 'account' | 'btc') => {
    navigator.clipboard.writeText(text);
    if (type === 'account') {
      setCopiedAccount(true);
      setTimeout(() => setCopiedAccount(false), 2000);
    } else {
      setCopiedBtc(true);
      setTimeout(() => setCopiedBtc(false), 2000);
    }
  };

  const handleTestApprove = async () => {
    try {
      // Test contract write: approve 0 MUSD to BorrowerOperations (simulates cleanly & verifies write path)
      await writeAsync({
        address: MATSNET_PROTOCOL_ADDRESSES.musd,
        abi: erc20Abi,
        functionName: 'approve',
        args: [MATSNET_PROTOCOL_ADDRESSES.borrowerOperations, 0n],
      });
    } catch {
      // Error handled by useBallastWrite
    }
  };

  if (!isConnected || !accountAddress) {
    return (
      <div className="py-12 max-w-container mx-auto px-4 md:px-6">
        <div className="mb-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
            Back to App
          </Link>
        </div>

        <EmptyState
          title="Wallet Not Connected"
          description="Connect an EVM wallet (MetaMask, Rabby) or a Bitcoin wallet (UniSat, OKX, Xverse) to verify real on-chain reads and contract writes."
          action={<WalletButton />}
        />
      </div>
    );
  }

  const isBitcoin = networkFamily === 'bitcoin';
  const troveStatusNum = troveDataRaw ? Number(troveDataRaw[3]) : 0;
  const troveStatusName = TROVE_STATUS_NAMES[troveStatusNum] || 'Unknown';
  const troveDebt = troveDataRaw ? Number(formatUnits(troveDataRaw[0], 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00';
  const troveColl = troveDataRaw ? Number(formatUnits(troveDataRaw[1], 18)).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }) : '0.0000';
  const formattedBtc = btcBalance ? Number(formatUnits(btcBalance.value, btcBalance.decimals)).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 }) : '0.0000';
  const formattedMusd = musdRaw !== undefined ? Number(formatUnits(musdRaw, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '0.00';
  const formattedPrice = oraclePriceRaw ? `$${Number(formatUnits(oraclePriceRaw, 18)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Loading...';
  const formattedICR = currentICRRaw ? `${(Number(formatUnits(currentICRRaw, 18)) * 100).toFixed(1)}%` : troveStatusNum === 1 ? 'Calculating...' : 'N/A';

  return (
    <div className="py-8 max-w-container mx-auto px-4 md:px-6 space-y-8">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-6">
        <div>
          <div className="mb-2">
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-ink-muted hover:text-ink transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
              Back to App
            </Link>
          </div>
          <h1 className="font-serif font-bold text-2xl text-ink tracking-tight">
            Wallet & Protocol Integration Verification
          </h1>
          <p className="text-xs font-mono text-ink-muted mt-1">
            Real-time on-chain inspection of connected signer, Mezo smart account, balances, and TroveManager status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge
            status={chainId === MEZO_TESTNET_CHAIN_ID ? 'Armed' : 'Danger'}
            label={chainId === MEZO_TESTNET_CHAIN_ID ? 'Mezo Testnet (31611)' : `Wrong Chain (${chainId})`}
          />
        </div>
      </div>

      {/* 1. Account Identity & Architecture Card */}
      <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-safe stroke-[1.5]" />
            <h2 className="font-serif font-semibold text-base text-ink">Signer & Account Topology</h2>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded-sm border border-hairline bg-paper text-ink-muted">
            Connector: {connector?.name} ({connector?.type})
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="space-y-1">
            <span className="text-ink-muted text-[11px] uppercase">Wallet Type</span>
            <div className="font-semibold text-ink text-sm">
              {isBitcoin ? 'Bitcoin wallet via Mezo smart account' : 'Native EVM wallet'}
            </div>
            <p className="text-[11px] text-ink-muted">
              {isBitcoin
                ? 'Your Bitcoin wallet signs ECDSA/Schnorr authorizations. Transactions execute on-chain via your Mezo Smart Account.'
                : 'Direct EVM signer issuing standard Ethereum-compatible transactions on Mezo.'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-ink-muted text-[11px]">
              <span>ON-CHAIN MSG.SENDER (MEZO ADDRESS)</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText(accountAddress, 'account')}
                  className="hover:text-ink flex items-center gap-1 focus-visible:outline-none"
                >
                  {copiedAccount ? <Check className="w-3.5 h-3.5 text-safe" /> : <Copy className="w-3.5 h-3.5 stroke-[1.5]" />}
                  <span>{copiedAccount ? 'Copied' : 'Copy'}</span>
                </button>
                <a
                  href={`${EXPLORER_URL}/address/${accountAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-ink flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Explorer</span>
                </a>
              </div>
            </div>
            <div className="p-2.5 rounded-sm border border-hairline bg-paper font-mono text-ink break-all text-[12px] select-all">
              {accountAddress}
            </div>

            {isBitcoin && walletAddress && (
              <>
                <div className="flex items-center justify-between text-ink-muted text-[11px] pt-1">
                  <span>BITCOIN NATIVE SIGNER ADDRESS</span>
                  <button
                    type="button"
                    onClick={() => copyText(walletAddress, 'btc')}
                    className="hover:text-ink flex items-center gap-1 focus-visible:outline-none"
                  >
                    {copiedBtc ? <Check className="w-3.5 h-3.5 text-safe" /> : <Copy className="w-3.5 h-3.5 stroke-[1.5]" />}
                    <span>{copiedBtc ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded-sm border border-hairline bg-paper font-mono text-ink break-all text-[12px] select-all">
                  {walletAddress}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. On-Chain Balances & Oracle Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat
          label="Native BTC Balance"
          value={btcLoading ? 'Loading...' : `${formattedBtc} BTC`}
          tooltip="Native gas and collateral asset on Mezo"
        />
        <Stat
          label="MUSD Token Balance"
          value={musdLoading ? 'Loading...' : `${formattedMusd} MUSD`}
          tooltip="MUSD ERC20 token held in account on Mezo"
        />
        <Stat
          label="BTC Oracle Price"
          value={priceLoading ? 'Loading...' : formattedPrice}
          tooltip="Live PriceFeed contract answer on Mezo Testnet"
        />
        <Stat
          label="Trove Status"
          value={troveLoading ? 'Loading...' : troveStatusName}
          tooltip="Status from TroveManager contract (0=None, 1=Active, 2=Closed)"
        />
      </div>

      {/* 3. Detailed Trove Parameters */}
      <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-ink stroke-[1.5]" />
            <h2 className="font-serif font-semibold text-base text-ink">On-Chain Trove Position</h2>
            <MezoBadge size="xs" variant="pill" />
          </div>
          <AddressChip
            address={MATSNET_PROTOCOL_ADDRESSES.troveManager}
            label="TroveManager"
            size="sm"
          />
        </div>

        <div className="divide-y divide-hairline">
          <DataRow
            label="Trove Owner Address (msg.sender)"
            value={accountAddress}
          />
          <DataRow
            label="Collateral Locked"
            value={troveLoading ? 'Loading...' : `${troveColl} BTC`}
          />
          <DataRow
            label="Total MUSD Debt"
            value={troveLoading ? 'Loading...' : `${troveDebt} MUSD`}
          />
          <DataRow
            label="Individual Collateral Ratio (ICR)"
            value={icrLoading ? 'Loading...' : formattedICR}
          />
          <DataRow
            label="Minimum Collateral Ratio (MCR)"
            value="110.0%"
          />
        </div>
      </div>

      {/* 4. Transaction Path Empirical Verification (useBallastWrite) */}
      <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-ember stroke-[1.5]" />
            <h2 className="font-serif font-semibold text-base text-ink">Contract Write Verification (useBallastWrite)</h2>
          </div>
          <span className="text-xs font-mono text-ink-muted">
            Universal Routing: {isBitcoin ? 'OrangeKit Smart Account' : 'EVM Client'}
          </span>
        </div>

        <p className="text-xs font-mono text-ink-muted">
          Click below to test the complete transaction pipeline: pre-flight simulation, wallet signature routing, on-chain confirmation, and revert decoding. This executes a 0-allowance approval to BorrowerOperations.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Button
            size="sm"
            variant="primary"
            onClick={handleTestApprove}
            disabled={isPending}
            className="flex items-center gap-1.5"
          >
            {isPending ? 'Processing Simulation & Write...' : 'Test Contract Write (Approve 0 MUSD)'}
          </Button>

          {writeStatus !== 'idle' && (
            <div className="text-xs font-mono flex items-center gap-2">
              <span className="text-ink-muted">Status:</span>
              <span className="font-bold text-ink uppercase tracking-wider">{writeStatus}</span>
            </div>
          )}
        </div>

        {/* Transaction Status Component */}
        {txHash && (
          <div className="pt-2">
            <TxStatus
              status={writeStatus === 'confirmed' ? 'confirmed' : writeStatus === 'failed' ? 'failed' : 'pending'}
              hash={txHash}
              explorerUrl={`${EXPLORER_URL}/tx/${txHash}`}
            />
          </div>
        )}

        {/* Error Display */}
        {writeError && (
          <div className="p-3 rounded-sm border border-danger/30 bg-danger/10 text-danger text-xs font-mono">
            <strong>Execution Error:</strong> {writeError}
          </div>
        )}
      </div>
    </div>
  );
}
