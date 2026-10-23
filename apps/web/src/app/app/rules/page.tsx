'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import {
  useVault,
  usePosition,
  useRule,
  useBallastWrite,
} from '../../../hooks';
import { useNotifications } from '../../../components/notifications/notifications-provider';
import {
  BallastVaultAbi,
} from '@ballast/shared';
import { HealthGauge } from '../../../components/ui/health-gauge';
import { Slider } from '../../../components/ui/slider';
import { Switch } from '../../../components/ui/switch';
import { Button } from '../../../components/ui/button';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatusBadge } from '../../../components/ui/status-badge';
import { AddressChip } from '../../../components/ui/address-chip';
import { TxStatus } from '../../../components/ui/tx-status';
import {
  Sliders,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Info,
  Lock,
  ArrowRight,
} from 'lucide-react';

export default function RulesPage() {
  const { address: userAddress, isConnected } = useAccount();
  const { notify } = useNotifications();

  const { vaultAddress, exists: vaultExists, isLoading: vaultLoading } = useVault(userAddress);
  const position = usePosition(vaultAddress);
  const rule = useRule(vaultAddress);
  const writeHook = useBallastWrite();

  // Local rule form state
  const [enabled, setEnabled] = useState(true);
  const [triggerPercent, setTriggerPercent] = useState(125);
  const [targetPercent, setTargetPercent] = useState(150);
  const [tipBps, setTipBps] = useState(50); // 50 bps = 0.50%
  const [hasInitialized, setHasInitialized] = useState(false);

  // Sync with on-chain rule once loaded
  useEffect(() => {
    if (rule.enabled !== null && !hasInitialized) {
      setEnabled(rule.enabled);
      if (rule.triggerPercent && rule.triggerPercent >= 112) {
        setTriggerPercent(rule.triggerPercent);
      }
      if (rule.targetPercent && rule.targetPercent >= 117) {
        setTargetPercent(rule.targetPercent);
      }
      if (rule.maxTipBps !== null && rule.maxTipBps !== undefined) {
        setTipBps(rule.maxTipBps);
      }
      setHasInitialized(true);
    }
  }, [rule.enabled, rule.triggerPercent, rule.targetPercent, rule.maxTipBps, hasInitialized]);

  // Ensure target is always at least trigger + 5%
  const handleTriggerChange = (newVal: number) => {
    setTriggerPercent(newVal);
    if (targetPercent < newVal + 5) {
      setTargetPercent(newVal + 5);
    }
  };

  const handleTargetChange = (newVal: number) => {
    if (newVal >= triggerPercent + 5) {
      setTargetPercent(newVal);
    }
  };

  // On-chain original values
  const onChainEnabled = rule.enabled ?? false;
  const onChainTrigger = rule.triggerPercent ?? 125;
  const onChainTarget = rule.targetPercent ?? 150;
  const onChainTipBps = rule.maxTipBps ?? 50;

  // Has changed check
  const hasChanges = useMemo(() => {
    if (rule.isLoading || rule.enabled === null) return false;
    return (
      enabled !== onChainEnabled ||
      Math.abs(triggerPercent - onChainTrigger) > 0.01 ||
      Math.abs(targetPercent - onChainTarget) > 0.01 ||
      tipBps !== onChainTipBps
    );
  }, [enabled, triggerPercent, targetPercent, tipBps, onChainEnabled, onChainTrigger, onChainTarget, onChainTipBps, rule.isLoading, rule.enabled]);

  // Risky settings analysis
  const warnings = useMemo(() => {
    const list: { type: 'danger' | 'warning' | 'info'; title: string; message: string }[] = [];

    if (!enabled) {
      list.push({
        type: 'danger',
        title: 'Autonomous Defense Disarmed',
        message:
          'When disabled, keepers cannot deploy reserves even if your trove is moments away from liquidation. You bear 100% of the manual monitoring burden.',
      });
      return list;
    }

    if (triggerPercent < 115) {
      list.push({
        type: 'danger',
        title: 'Trigger Too Close to Liquidation (110% MCR)',
        message: `Your trigger is only ${(triggerPercent - 110).toFixed(1)}% above the protocol liquidation threshold. Keepers monitor blocks on a 15–30s cadence. During a sudden price collapse, an abrupt slippage could liquidate your position before a defense transaction confirms on-chain.`,
      });
    }

    if (targetPercent - triggerPercent < 10) {
      list.push({
        type: 'warning',
        title: 'Target Buffer Too Narrow',
        message: `Your restoration target is only ${(targetPercent - triggerPercent).toFixed(1)}% above your trigger. A minor market wiggle after defense will immediately re-trigger another keeper run, causing you to pay unnecessary keeper tips twice.`,
      });
    }

    if (tipBps > 80) {
      list.push({
        type: 'warning',
        title: 'High Keeper Tip Cap',
        message: `A tip cap of ${(tipBps / 100).toFixed(2)}% offers strong keeper incentives, but repeated volatility defenses will consume your defense reserves noticeably faster.`,
      });
    } else if (tipBps < 20) {
      list.push({
        type: 'info',
        title: 'Low Keeper Incentive',
        message: `A tip cap below 0.20% (${(tipBps / 100).toFixed(2)}%) might cause altruistic keepers to delay defense during high testnet gas spikes if network execution costs exceed the reward.`,
      });
    }

    return list;
  }, [enabled, triggerPercent, targetPercent, tipBps]);

  // Plain-Language Consequence Text
  const consequenceText = useMemo(() => {
    if (!enabled) {
      return 'Defense is currently turned OFF. No automated repayments or collateral top-ups will occur. Reserves remain dormant until manually withdrawn or rules are re-enabled.';
    }

    return `When your position ICR falls below ${triggerPercent.toFixed(1)}%, any permissionless keeper is authorized to execute defense using your reserves. The keeper will repay MUSD and deposit BTC until your position reaches ${targetPercent.toFixed(1)}% ICR. The keeper receives a tip of ${(tipBps / 100).toFixed(2)}% on the exact assets moved.`;
  }, [enabled, triggerPercent, targetPercent, tipBps]);

  // Save Rule Execution
  const handleSave = async () => {
    if (!vaultAddress) return;

    try {
      const triggerWei = BigInt(Math.round(triggerPercent * 100)) * (10n ** 16n);
      const targetWei = BigInt(Math.round(targetPercent * 100)) * (10n ** 16n);

      const receipt = await writeHook.writeAsync({
        address: vaultAddress,
        abi: BallastVaultAbi,
        functionName: 'setRule',
        args: [enabled, triggerWei, targetWei, tipBps],
      });

      if (receipt) {
        notify({
          type: 'success',
          title: 'Defense Rules Updated',
          description: `Updated parameters: Trigger ${triggerPercent}%, Target ${targetPercent}%, Tip ${(tipBps / 100).toFixed(2)}%, ${enabled ? 'Enabled' : 'Disabled'}.`,
          txHash: receipt.transactionHash,
        });
        rule.refetch();
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      notify({
        type: 'error',
        title: 'Rule Update Failed',
        description: errObj.message || 'Transaction was rejected or reverted by the contract.',
      });
    }
  };

  // 1. Disconnected
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Autonomous Defense Parameters
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Defense Rules Configuration</h1>
        </div>
        <EmptyState
          icon={<Sliders className="w-6 h-6 stroke-[1.5]" />}
          title="Connect Wallet to Configure Defense Rules"
          description="Adjust your trigger threshold, restoration waterline, and keeper tip cap for your automated BallastVault."
        />
      </div>
    );
  }

  // 2. Loading
  if (vaultLoading || rule.isLoading) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  // 3. No Vault
  if (!vaultExists || !vaultAddress) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Autonomous Defense Parameters
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Defense Rules Configuration</h1>
        </div>
        <EmptyState
          icon={<Lock className="w-6 h-6 stroke-[1.5]" />}
          title="No BallastVault Proxy Deployed"
          description="Deploy your BallastVault proxy on Mezo Matsnet to configure autonomous defense rules."
          action={
            <Link href="/app">
              <Button variant="primary">Launch Setup Wizard</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-hairline pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Autonomous Defense Parameters
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Defense Rules Configuration</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-muted">Vault:</span>
          <AddressChip address={vaultAddress} showCopy showExplorer size="sm" />
          <StatusBadge
            status={onChainEnabled ? 'active' : 'inactive'}
            label={onChainEnabled ? 'Rules Active' : 'Rules Paused'}
          />
        </div>
      </div>

      {/* Visual Health Gauge reflecting the pending settings */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono uppercase tracking-wider font-semibold text-ink">
            Waterline Visualization (Pending Simulation)
          </span>
          <span className="text-xs font-mono text-ink-muted">
            Current Position: {position.icrPercent ? `${position.icrPercent.toFixed(1)}%` : 'No Trove'}
          </span>
        </div>
        <HealthGauge
          current={position.icrPercent}
          trigger={enabled ? triggerPercent : null}
          target={enabled ? targetPercent : null}
          mcr={110}
          ccr={150}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive Settings Controls */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-6">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <div>
                <h3 className="text-sm font-mono font-bold uppercase text-ink">
                  Autonomous Protection Switch
                </h3>
                <p className="text-xs font-mono text-ink-muted mt-0.5">
                  Enable or suspend permissionless keeper defense triggers
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                ariaLabel="Toggle defense rules"
              />
            </div>

            {/* Trigger ICR Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-ink uppercase tracking-wider">
                    Defense Trigger ICR
                  </span>
                  <p className="text-[11px] font-mono text-ink-muted">
                    Threshold where keepers step in to defend (Solidity range: 112% – 250%)
                  </p>
                </div>
                <span className="text-base font-serif font-bold text-ink tabular-nums px-2 py-0.5 rounded bg-paper-surface border border-hairline">
                  {triggerPercent.toFixed(1)}%
                </span>
              </div>
              <Slider
                value={triggerPercent}
                min={112}
                max={200}
                step={1}
                disabled={!enabled}
                onValueChange={handleTriggerChange}
              />
              <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                <span>112% (Protocol Floor)</span>
                <span>125% (Recommended)</span>
                <span>200% (Conservative)</span>
              </div>
            </div>

            {/* Target ICR Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-ink uppercase tracking-wider">
                    Restoration Target ICR
                  </span>
                  <p className="text-[11px] font-mono text-ink-muted">
                    Safe waterline to restore position to (Min: Trigger + 5%, Max: 300%)
                  </p>
                </div>
                <span className="text-base font-serif font-bold text-ink tabular-nums px-2 py-0.5 rounded bg-paper-surface border border-hairline">
                  {targetPercent.toFixed(1)}%
                </span>
              </div>
              <Slider
                value={targetPercent}
                min={Math.max(117, Math.round(triggerPercent + 5))}
                max={250}
                step={1}
                disabled={!enabled}
                onValueChange={handleTargetChange}
              />
              <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                <span>{(triggerPercent + 5).toFixed(0)}% (Minimum Allowed)</span>
                <span>150% (Standard Target)</span>
                <span>250% (Max Buffer)</span>
              </div>
            </div>

            {/* Max Tip Cap Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-ink uppercase tracking-wider">
                    Keeper Tip Cap
                  </span>
                  <p className="text-[11px] font-mono text-ink-muted">
                    Maximum fee paid to keeper per asset moved (Max: 100 bps / 1.00%)
                  </p>
                </div>
                <span className="text-base font-serif font-bold text-ink tabular-nums px-2 py-0.5 rounded bg-paper-surface border border-hairline">
                  {(tipBps / 100).toFixed(2)}% ({tipBps} bps)
                </span>
              </div>
              <Slider
                value={tipBps}
                min={0}
                max={100}
                step={5}
                disabled={!enabled}
                onValueChange={setTipBps}
              />
              <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                <span>0.00% (No tip)</span>
                <span>0.50% (Recommended)</span>
                <span>1.00% (Protocol Cap)</span>
              </div>
            </div>

            {/* Plain-Language Consequence Box */}
            <div className="p-4 bg-paper-surface border border-hairline rounded-sm space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-ink uppercase tracking-wider">
                <Info className="w-3.5 h-3.5 text-ember stroke-[1.5]" />
                <span>Plain-Language Rule Consequence</span>
              </div>
              <p className="text-xs font-mono text-ink-muted leading-relaxed">
                {consequenceText}
              </p>
            </div>

            {/* Feedback & Save Button */}
            {writeHook.status !== 'idle' && (
              <TxStatus
                status={writeHook.status}
                txHash={writeHook.txHash || undefined}
                error={writeHook.error || undefined}
              />
            )}

            <div className="pt-2">
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                disabled={writeHook.isPending || !hasChanges}
                onClick={handleSave}
              >
                {writeHook.isPending
                  ? 'Submitting to Mezo...'
                  : hasChanges
                  ? 'Save Rule Updates On-Chain'
                  : 'No Changes to Save'}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: Before vs After Diff & Risk Warnings */}
        <div className="lg:col-span-5 space-y-6">
          {/* Before vs After Diff Card */}
          <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink border-b border-hairline pb-2">
              Parameter Diff: Before vs. After
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div className="flex items-center justify-between p-2 rounded bg-paper-surface border border-hairline">
                <span className="text-ink-muted uppercase">Rule Status</span>
                <div className="flex items-center gap-2">
                  <span className={onChainEnabled ? 'text-safe' : 'text-danger'}>
                    {onChainEnabled ? 'ENABLED' : 'PAUSED'}
                  </span>
                  <ArrowRight className="w-3 h-3 text-ink-muted" />
                  <span className={`font-bold ${enabled ? 'text-safe' : 'text-danger'}`}>
                    {enabled ? 'ENABLED' : 'PAUSED'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-paper-surface border border-hairline">
                <span className="text-ink-muted uppercase">Trigger Threshold</span>
                <div className="flex items-center gap-2">
                  <span>{onChainTrigger.toFixed(1)}%</span>
                  <ArrowRight className="w-3 h-3 text-ink-muted" />
                  <span className="font-bold text-ink">{triggerPercent.toFixed(1)}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-paper-surface border border-hairline">
                <span className="text-ink-muted uppercase">Restoration Target</span>
                <div className="flex items-center gap-2">
                  <span>{onChainTarget.toFixed(1)}%</span>
                  <ArrowRight className="w-3 h-3 text-ink-muted" />
                  <span className="font-bold text-ink">{targetPercent.toFixed(1)}%</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-2 rounded bg-paper-surface border border-hairline">
                <span className="text-ink-muted uppercase">Keeper Tip Cap</span>
                <div className="flex items-center gap-2">
                  <span>{(onChainTipBps / 100).toFixed(2)}%</span>
                  <ArrowRight className="w-3 h-3 text-ink-muted" />
                  <span className="font-bold text-ink">{(tipBps / 100).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Warnings Card */}
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
              Safety & Risk Evaluation
            </h3>

            {warnings.length === 0 ? (
              <div className="p-4 border border-safe/30 bg-safe/10 rounded-sm flex items-start gap-3 text-xs font-mono text-safe">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Sound Configuration</span>
                  <p className="text-[11px] leading-relaxed">
                    Your parameters provide ample time for keeper discovery and execution without excessive tipping overhead.
                  </p>
                </div>
              </div>
            ) : (
              warnings.map((w, idx) => (
                <div
                  key={idx}
                  className={`p-4 border rounded-sm flex items-start gap-3 text-xs font-mono ${
                    w.type === 'danger'
                      ? 'border-danger/30 bg-danger/10 text-danger'
                      : w.type === 'warning'
                      ? 'border-watch/30 bg-watch/10 text-watch'
                      : 'border-hairline bg-paper-surface text-ink'
                  }`}
                >
                  {w.type === 'danger' ? (
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1">
                    <span className="font-bold">{w.title}</span>
                    <p className="text-[11px] leading-relaxed">{w.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
