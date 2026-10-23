'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient, useSwitchChain } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
  BallastVaultAbi,
} from '@ballast/shared';
import {
  useVault,
  usePosition,
  useRule,
  useReserves,
  useDefenseCheck,
  useActivity,
  useBallastWrite,
} from '../../../hooks';
import { computeInsertHints } from '../../../lib/hints';
import { MEZO_TESTNET_CHAIN_ID } from '../../../lib/chains';
import { HealthGauge } from '../../../components/ui/health-gauge';
import { Stat } from '../../../components/ui/stat';
import { StatusBadge, type StatusBadgeState } from '../../../components/ui/status-badge';
import { TxStatus } from '../../../components/ui/tx-status';
import { Banner } from '../../../components/ui/banner';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { WalletButton } from '../../../components/wallet/wallet-button';
import {
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Shield,
  RefreshCw,
  Wallet,
  AlertTriangle,
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();

  // On-Chain Reads
  const vault = useVault(address);
  const position = usePosition(vault.vaultAddress);
  const rule = useRule(vault.vaultAddress);
  const defense = useDefenseCheck(vault.vaultAddress);
  const activity = useActivity(vault.vaultAddress);
  const reserves = useReserves({
    vaultAddress: vault.vaultAddress,
    collateral: position.collateral,
    debt: position.debt,
    price: position.price,
    targetICR: rule.targetICR,
  });

  // Universal Transaction Writer
  const writeHook = useBallastWrite();

  // Quick Action Modal/Drawer State
  const [activeAction, setActiveAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [actionMusdInput, setActionMusdInput] = useState<string>('');
  const [actionBtcInput, setActionBtcInput] = useState<string>('');

  // Determine Badge State
  let badgeState: StatusBadgeState = 'Disarmed';
  let badgeLabel = 'DISARMED';

  if (rule.enabled) {
    if (position.icrPercent && rule.triggerPercent && position.icrPercent < rule.triggerPercent + 5) {
      badgeState = 'Watch';
      badgeLabel = 'WATCH LEVEL';
    } else if (
      reserves.defenseCapacity &&
      reserves.defenseCapacity.absorbableDropPercent < 10
    ) {
      badgeState = 'Watch';
      badgeLabel = 'RESERVE LOW';
    } else if (defense.defendable) {
      badgeState = 'Danger';
      badgeLabel = 'DEFENSE REQUIRED';
    } else {
      badgeState = 'Armed';
      badgeLabel = 'ARMED & HEALTHY';
    }
  }

  // Self-Rescue Handler ("Defend Now")
  const handleDefendNow = async () => {
    if (!publicClient || !vault.vaultAddress) return;

    // Compute hints for defense
    const hints = await computeInsertHints(
      publicClient,
      (position.collateral ?? 0n) + (defense.btcToAdd ?? 0n),
      (position.debt ?? 0n) > (defense.musdToRepay ?? 0n)
        ? (position.debt ?? 0n) - (defense.musdToRepay ?? 0n)
        : 0n,
    );

    await writeHook.writeAsync({
      address: vault.vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'defend',
      args: [hints.upperHint, hints.lowerHint],
    });

    position.refetch();
    reserves.refetch();
    defense.refetch();
  };

  // Quick Action Deposit Handler
  const handleDeposit = async () => {
    if (!vault.vaultAddress) return;
    const musdWei = actionMusdInput ? parseEther(actionMusdInput) : 0n;
    const btcWei = actionBtcInput ? parseEther(actionBtcInput) : 0n;

    await writeHook.writeAsync({
      address: vault.vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'depositReserves',
      args: [musdWei],
      value: btcWei,
    });

    reserves.refetch();
    setActiveAction(null);
    setActionMusdInput('');
    setActionBtcInput('');
  };

  // Quick Action Withdraw Handler
  const handleWithdraw = async () => {
    if (!vault.vaultAddress) return;
    const musdWei = actionMusdInput ? parseEther(actionMusdInput) : 0n;
    const btcWei = actionBtcInput ? parseEther(actionBtcInput) : 0n;

    await writeHook.writeAsync({
      address: vault.vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'withdrawReserves',
      args: [musdWei, btcWei],
    });

    reserves.refetch();
    setActiveAction(null);
    setActionMusdInput('');
    setActionBtcInput('');
  };

  // 1. Wallet Disconnected
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Borrower Console
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Overview & Vault Status</h1>
        </div>

        <EmptyState
          icon={<Wallet className="w-8 h-8 stroke-[1.5]" />}
          title="Connect Wallet to View Dashboard"
          description="Connect your browser wallet or Mezo smart account to inspect your on-chain trove, manage defense thresholds, and observe live health."
          action={<WalletButton />}
        />
      </div>
    );
  }

  // 2. Wrong Network
  if (chainId !== MEZO_TESTNET_CHAIN_ID) {
    return (
      <div className="space-y-8">
        <Banner
          variant="warning"
          title="Unsupported Network"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => switchChain?.({ chainId: MEZO_TESTNET_CHAIN_ID })}
            >
              Switch to Mezo Testnet
            </Button>
          }
        >
          Ballast operates on Mezo Testnet (Matsnet, Chain ID 31611). Please switch your network to inspect your position.
        </Banner>
      </div>
    );
  }

  // 3. No Vault Deployed Yet
  if (!vault.isLoading && !vault.exists) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Borrower Console
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Overview & Vault Status</h1>
        </div>

        <EmptyState
          icon={<Shield className="w-8 h-8 stroke-[1.5] text-ember" />}
          title="No Personal Vault Deployed"
          description="You haven't deployed a personal BallastVault yet. Launch the setup wizard to deploy your vault, open an MUSD position, and configure autonomous defense."
          action={
            <Link href="/app">
              <Button variant="primary">Launch Setup Wizard →</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // 4. Vault Exists but No Active Trove
  if (
    !vault.isLoading &&
    vault.exists &&
    !position.isLoading &&
    position.status !== 'active'
  ) {
    let title = 'No Active Trove Found';
    let desc = 'Your personal vault is deployed, but has no active MUSD trove open on Mezo.';

    if (position.status === 'closedByOwner') {
      title = 'Trove Closed by Owner';
      desc = 'Your trove was closed. You can open a new position at any time using your vault.';
    } else if (position.status === 'closedByLiquidation') {
      title = 'Trove Liquidated';
      desc = 'This trove was liquidated. Any residual collateral surplus can be claimed from the CollSurplusPool.';
    } else if (position.status === 'closedByRedemption') {
      title = 'Trove Redeemed';
      desc = 'This trove was redeemed against MUSD. You can re-open an active trove at any time.';
    }

    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Borrower Console
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Overview & Vault Status</h1>
        </div>

        <EmptyState
          icon={<AlertTriangle className="w-8 h-8 stroke-[1.5] text-watch" />}
          title={title}
          description={desc}
          action={
            <Link href="/app">
              <Button variant="primary">Open MUSD Trove →</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const isLoading = vault.isLoading || position.isLoading;

  return (
    <div className="space-y-8">
      {/* Title & Status Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Borrower Console
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Overview & Vault Status</h1>
        </div>

        <div className="flex items-center gap-3">
          <StatusBadge status={badgeState} label={badgeLabel} />

          <a
            href={`https://explorer.test.mezo.org/address/${vault.vaultAddress}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-mono text-ink-muted hover:text-ink border border-hairline px-2.5 py-1 rounded-sm bg-paper-surface"
            title="View Vault Contract on Mezo Explorer"
          >
            <span className="truncate max-w-[120px] sm:max-w-[200px]">
              {vault.vaultAddress}
            </span>
            <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
          </a>
        </div>
      </div>

      {/* Recovery Mode Warning if Active */}
      {position.isRecoveryMode && (
        <Banner
          variant="warning"
          title="System Recovery Mode Active (TCR < 150%)"
        >
          The total collateral ratio of the Mezo MUSD system is below 150%. The Minimum Collateral Ratio (MCR) is temporarily elevated to 150%. Troves with ICR below 150% are subject to liquidation.
        </Banner>
      )}

      {/* Permissionless Self-Rescue ("DEFEND NOW") Banner */}
      {defense.defendable && (
        <div className="p-4 border border-danger/40 bg-danger/10 rounded-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-danger shrink-0 stroke-[2]" />
            <div>
              <h2 className="text-sm font-mono font-bold text-danger uppercase tracking-wider">
                Defense Condition Triggered
              </h2>
              <p className="text-xs font-sans text-ink-muted mt-0.5">
                Your ICR ({position.icrPercent?.toFixed(1)}%) is below your safety trigger (
                {rule.triggerPercent?.toFixed(1)}%). Self-rescue is available now using your pre-funded
                vault reserve.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleDefendNow}
            disabled={writeHook.isPending}
            loading={writeHook.isPending}
            className="bg-danger hover:bg-danger/90 text-white"
          >
            Defend Position Now
          </Button>
        </div>
      )}

      {/* Transaction Notifications */}
      {writeHook.txHash && (
        <TxStatus
          status={writeHook.isSuccess ? 'confirmed' : writeHook.isError ? 'failed' : 'pending'}
          hash={writeHook.txHash}
        />
      )}

      {writeHook.error && (
        <Banner
          variant="danger"
          title="Transaction Failed"
          action={
            <Button variant="secondary" size="sm" onClick={() => writeHook.reset()}>
              Dismiss
            </Button>
          }
        >
          {writeHook.error}
        </Banner>
      )}

      {/* Stat Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat
          label="Collateral Locked"
          value={
            isLoading
              ? null
              : Number(formatEther(position.collateral ?? 0n)).toFixed(4)
          }
          unit="BTC"
          tooltip="Total native Bitcoin locked in your Trove on Mezo"
        />

        <Stat
          label="Total Debt"
          value={
            isLoading
              ? null
              : Number(formatEther(position.debt ?? 0n)).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })
          }
          unit="MUSD"
          tooltip="Principal + accrued interest + 200 MUSD liquidation reserve"
        />

        <Stat
          label="Individual ICR"
          value={isLoading ? null : `${position.icrPercent?.toFixed(1) ?? '—'}%`}
          tooltip="Individual Collateral Ratio = (Collateral * Price) / Debt"
        />

        <Stat
          label="Liquidation Price"
          value={
            isLoading
              ? null
              : `$${Number(formatEther(position.liquidationPrice ?? 0n)).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}`
          }
          tooltip="Price of Bitcoin at which your position reaches 110% MCR"
        />

        <Stat
          label="Reserve Capacity"
          value={
            isLoading
              ? null
              : reserves.defenseCapacity
                ? `${reserves.defenseCapacity.absorbableDropPercent.toFixed(1)}% drop`
                : '—'
          }
          tooltip="Maximum absorbable BTC price drop before reserves are depleted"
        />
      </div>

      {/* Hero Health Gauge */}
      <div className="p-6 border border-hairline bg-paper-surface rounded-sm space-y-4">
        <div className="flex justify-between items-center border-b border-hairline pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-ink">Collateral Health Instrument</h2>
            <span className="text-xs font-mono text-ink-muted">
              Live ratio compared against your defense trigger and target levels
            </span>
          </div>

          <div className="text-xs font-mono text-ink-muted flex items-center gap-2">
            <span>Trigger: {rule.triggerPercent?.toFixed(1) ?? '125.0'}%</span>
            <span>•</span>
            <span>Target: {rule.targetPercent?.toFixed(1) ?? '140.0'}%</span>
          </div>
        </div>

        <HealthGauge
          current={position.icrPercent}
          trigger={rule.triggerPercent}
          target={rule.targetPercent}
          loading={isLoading}
        />
      </div>

      {/* Two-Column Detail Cards: Defense Reserves & Rule Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reserves Card */}
        <div className="border border-hairline bg-paper-surface p-5 rounded-sm space-y-4">
          <div className="flex justify-between items-center border-b border-hairline pb-2.5">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-ember stroke-[1.5]" />
              <h3 className="text-sm font-mono uppercase tracking-wider font-semibold text-ink">
                Defense Reserves
              </h3>
            </div>
            <span className="text-xs font-mono text-safe font-semibold">
              {reserves.defenseCapacity
                ? `${reserves.defenseCapacity.absorbableDropPercent.toFixed(1)}% absorbable`
                : 'No reserves'}
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center p-2.5 bg-paper border border-hairline rounded-sm">
              <span className="text-ink-muted">MUSD Reserve</span>
              <span className="text-ink font-semibold">
                {Number(formatEther(reserves.musdReserve ?? 0n)).toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
                MUSD
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-paper border border-hairline rounded-sm">
              <span className="text-ink-muted">BTC Reserve</span>
              <span className="text-ink font-semibold">
                {Number(formatEther(reserves.btcReserve ?? 0n)).toFixed(4)} BTC
              </span>
            </div>
          </div>

          {/* Quick Reserve Actions Drawer/Buttons */}
          {activeAction === null ? (
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveAction('deposit')}
                className="w-full"
              >
                + Deposit Reserves
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setActiveAction('withdraw')}
                className="w-full"
              >
                Withdraw
              </Button>
            </div>
          ) : (
            <div className="p-3 border border-hairline bg-paper rounded-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono uppercase text-ink font-semibold">
                  {activeAction === 'deposit' ? 'Deposit to Reserves' : 'Withdraw from Reserves'}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveAction(null)}
                  className="text-xs font-mono text-ink-muted hover:text-ink"
                >
                  ✕ Close
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="MUSD amount"
                  value={actionMusdInput}
                  onChange={(e) => setActionMusdInput(e.target.value)}
                  className="px-2 py-1 text-xs font-mono bg-paper-surface border border-hairline rounded-sm"
                />
                <input
                  type="text"
                  placeholder="BTC amount"
                  value={actionBtcInput}
                  onChange={(e) => setActionBtcInput(e.target.value)}
                  className="px-2 py-1 text-xs font-mono bg-paper-surface border border-hairline rounded-sm"
                />
              </div>

              <Button
                variant="primary"
                size="sm"
                onClick={activeAction === 'deposit' ? handleDeposit : handleWithdraw}
                disabled={writeHook.isPending}
                loading={writeHook.isPending}
                className="w-full"
              >
                Confirm {activeAction === 'deposit' ? 'Deposit' : 'Withdrawal'}
              </Button>
            </div>
          )}
        </div>

        {/* Protection Rule Card */}
        <div className="border border-hairline bg-paper-surface p-5 rounded-sm space-y-4">
          <div className="flex justify-between items-center border-b border-hairline pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-safe stroke-[1.5]" />
              <h3 className="text-sm font-mono uppercase tracking-wider font-semibold text-ink">
                Autonomous Rule
              </h3>
            </div>
            <StatusBadge status={rule.enabled ? 'Armed' : 'Disarmed'} />
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center p-2.5 bg-paper border border-hairline rounded-sm">
              <span className="text-ink-muted">Trigger Ratio</span>
              <span className="text-ink font-semibold">
                {rule.triggerPercent?.toFixed(1) ?? '125.0'}%
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-paper border border-hairline rounded-sm">
              <span className="text-ink-muted">Target Ratio</span>
              <span className="text-ink font-semibold">
                {rule.targetPercent?.toFixed(1) ?? '140.0'}%
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-paper border border-hairline rounded-sm">
              <span className="text-ink-muted">Keeper Incentive Tip</span>
              <span className="text-ink font-semibold">
                {rule.maxTipPercent?.toFixed(2) ?? '0.50'}%
              </span>
            </div>
          </div>

          <div className="pt-1">
            <Link href="/app">
              <Button variant="quiet" size="sm" className="w-full">
                Adjust Rule in Setup Wizard →
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent On-Chain Activity Feed */}
      <div className="border border-hairline bg-paper-surface p-5 rounded-sm space-y-4">
        <div className="flex justify-between items-center border-b border-hairline pb-3">
          <div>
            <h2 className="text-base font-serif font-bold text-ink">Recent Vault Activity</h2>
            <span className="text-xs font-mono text-ink-muted">
              On-chain event logs indexed directly from your personal vault proxy
            </span>
          </div>

          <button
            type="button"
            onClick={() => activity.refetch()}
            className="flex items-center gap-1 text-xs font-mono text-ink-muted hover:text-ink"
            title="Refresh logs from Mezo RPC"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {activity.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : activity.activities.length === 0 ? (
          <div className="py-8 text-center text-xs font-mono text-ink-muted border border-dashed border-hairline rounded-sm">
            No defense or reserve events recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-hairline border border-hairline rounded-sm bg-paper font-mono text-xs">
            {activity.activities.slice(0, 10).map((act) => (
              <div
                key={act.id}
                className="p-3 flex flex-wrap items-center justify-between gap-3 hover:bg-paper-surface transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-ember shrink-0" />
                  <span className="font-semibold text-ink">{act.summary}</span>
                  <span className="text-ink-muted">Block #{act.blockNumber.toString()}</span>
                </div>

                <div className="flex items-center gap-3 text-ink-muted">
                  {act.timestamp && (
                    <span>{new Date(act.timestamp * 1000).toLocaleTimeString()}</span>
                  )}
                  <a
                    href={`https://explorer.test.mezo.org/tx/${act.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-ink hover:text-ember"
                    title={act.txHash}
                  >
                    <span>{`${act.txHash.slice(0, 6)}…${act.txHash.slice(-4)}`}</span>
                    <ExternalLink className="w-3 h-3 stroke-[1.5]" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
