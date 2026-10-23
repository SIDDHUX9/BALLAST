'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
  useVault,
  usePosition,
  useRule,
  useReserves,
  useProtocolParams,
  useBallastWrite,
} from '../../../hooks';
import { useNotifications } from '../../../components/notifications/notifications-provider';
import {
  BallastVaultAbi,
  MusdAbi,
  MATSNET_PROTOCOL_ADDRESSES,
  simulateStressTest,
  PROTOCOL_CONSTANTS,
  PRECISION,
} from '@ballast/shared';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Tabs } from '../../../components/ui/tabs';
import { Table } from '../../../components/ui/table';
import { Stat } from '../../../components/ui/stat';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatusBadge } from '../../../components/ui/status-badge';
import { AddressChip } from '../../../components/ui/address-chip';
import { TxStatus } from '../../../components/ui/tx-status';
import {
  PiggyBank,
  AlertTriangle,
  Info,
  Lock,
} from 'lucide-react';

export default function ReservePage() {
  const { address: userAddress, isConnected } = useAccount();
  const { notify } = useNotifications();

  const { vaultAddress, exists: vaultExists, isLoading: vaultLoading } = useVault(userAddress);
  const position = usePosition(vaultAddress);
  const rule = useRule(vaultAddress);
  const reserves = useReserves({
    vaultAddress,
    collateral: position.collateral,
    debt: position.debt,
    price: position.price,
    targetICR: rule.targetICR,
  });
  const protocol = useProtocolParams();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'deposit_musd' | 'deposit_btc' | 'withdraw_musd' | 'withdraw_btc'>('deposit_musd');

  // Input states
  const [musdDepositInput, setMusdDepositInput] = useState('');
  const [btcDepositInput, setBtcDepositInput] = useState('');
  const [musdWithdrawInput, setMusdWithdrawInput] = useState('');
  const [btcWithdrawInput, setBtcWithdrawInput] = useState('');

  // Write hooks
  const writeHook = useBallastWrite();
  const approveHook = useBallastWrite();

  const musdReserve = reserves.musdReserve ?? 0n;
  const btcReserve = reserves.btcReserve ?? 0n;
  const userMusd = reserves.userMusdBalance ?? 0n;
  const userBtc = reserves.userBtcBalance ?? 0n;
  const allowance = reserves.musdAllowance ?? 0n;

  // Safe parsed values
  const musdDepVal = useMemo(() => {
    try {
      return musdDepositInput && parseFloat(musdDepositInput) > 0 ? parseEther(musdDepositInput) : 0n;
    } catch {
      return 0n;
    }
  }, [musdDepositInput]);

  const btcDepVal = useMemo(() => {
    try {
      return btcDepositInput && parseFloat(btcDepositInput) > 0 ? parseEther(btcDepositInput) : 0n;
    } catch {
      return 0n;
    }
  }, [btcDepositInput]);

  const musdWithVal = useMemo(() => {
    try {
      return musdWithdrawInput && parseFloat(musdWithdrawInput) > 0 ? parseEther(musdWithdrawInput) : 0n;
    } catch {
      return 0n;
    }
  }, [musdWithdrawInput]);

  const btcWithVal = useMemo(() => {
    try {
      return btcWithdrawInput && parseFloat(btcWithdrawInput) > 0 ? parseEther(btcWithdrawInput) : 0n;
    } catch {
      return 0n;
    }
  }, [btcWithdrawInput]);

  // Scenarios Table computation: "BTC price -> what Ballast would do"
  const scenarioData = useMemo(() => {
    if (
      !position.collateral ||
      !position.debt ||
      !position.price ||
      !rule.triggerICR ||
      !rule.targetICR
    ) {
      return [];
    }

    const sim = simulateStressTest({
      collateral: position.collateral,
      debt: position.debt,
      currentPrice: position.price,
      priceDropPercent: 60,
      triggerICR: rule.triggerICR,
      targetICR: rule.targetICR,
      maxTipBps: rule.maxTipBps ?? 50,
      musdReserve,
      btcReserve,
      minNetDebt: protocol.minNetDebt ?? PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT,
      mcr: protocol.mcr ?? PROTOCOL_CONSTANTS.MCR,
      enabled: rule.enabled ?? true,
    });

    // Select key drawdown checkpoints: 0%, 10%, 20%, 30%, 40%, 50%, 60%
    const checkpoints = [0, 10, 20, 30, 40, 50, 60];

    return checkpoints.map((dropPct) => {
      const pt = sim.points[dropPct] || sim.points[sim.points.length - 1];
      const step = sim.defenseSteps.find((s) => s.dropPercent === dropPct);

      let actionText = 'No defense needed (ICR above trigger)';
      if (pt.isLiquidatedProtected) {
        actionText = 'Liquidated (Reserves exhausted below 110% MCR)';
      } else if (step) {
        const parts: string[] = [];
        if (step.musdRepaid > 0n) {
          parts.push(`Repay ${Number(formatEther(step.musdRepaid)).toFixed(1)} MUSD`);
        }
        if (step.btcAdded > 0n) {
          parts.push(`Add ${Number(formatEther(step.btcAdded)).toFixed(4)} BTC`);
        }
        actionText = `DEFEND: ${parts.join(', ')}`;
      } else if (pt.unprotectedICR < (rule.triggerICR ?? 0n)) {
        actionText = 'Defense previously executed / Target maintained';
      }

      return {
        dropPercent: `${dropPct}%`,
        price: `$${(Number(pt.price) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        unprotectedICR: `${(Number((pt.unprotectedICR * 10000n) / PRECISION) / 100).toFixed(1)}%`,
        protectedICR: `${(Number((pt.protectedICR * 10000n) / PRECISION) / 100).toFixed(1)}%`,
        actionText,
        remainingReserves: `${Number(formatEther(pt.remainingMusdReserve)).toFixed(0)} MUSD | ${Number(formatEther(pt.remainingBtcReserve)).toFixed(3)} BTC`,
        status: pt.isLiquidatedProtected ? 'liquidated' : step ? 'defended' : 'safe',
      };
    });
  }, [position.collateral, position.debt, position.price, rule.triggerICR, rule.targetICR, rule.maxTipBps, rule.enabled, musdReserve, btcReserve, protocol.minNetDebt, protocol.mcr]);

  // Execute Deposit / Withdraw
  const handleExecute = async () => {
    if (!vaultAddress) return;

    try {
      if (activeTab === 'deposit_musd') {
        if (allowance < musdDepVal) {
          const appReceipt = await approveHook.writeAsync({
            address: MATSNET_PROTOCOL_ADDRESSES.musd,
            abi: MusdAbi,
            functionName: 'approve',
            args: [vaultAddress, musdDepVal],
          });
          if (appReceipt) {
            notify({
              type: 'info',
              title: 'MUSD Approved',
              description: 'Approval confirmed. Proceeding with reserve deposit.',
              txHash: appReceipt.transactionHash,
            });
            reserves.refetch();
          }
        }

        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'depositMUSD',
          args: [musdDepVal],
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'MUSD Reserve Deposited',
            description: `Deposited ${musdDepositInput} MUSD into your BallastVault reserve.`,
            txHash: receipt.transactionHash,
          });
          setMusdDepositInput('');
          reserves.refetch();
        }
      } else if (activeTab === 'deposit_btc') {
        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'depositBTC',
          args: [],
          value: btcDepVal,
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'BTC Reserve Deposited',
            description: `Deposited ${btcDepositInput} BTC into your BallastVault reserve.`,
            txHash: receipt.transactionHash,
          });
          setBtcDepositInput('');
          reserves.refetch();
        }
      } else if (activeTab === 'withdraw_musd') {
        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'withdrawMUSD',
          args: [musdWithVal],
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'MUSD Reserve Withdrawn',
            description: `Withdrawn ${musdWithdrawInput} MUSD from reserve to your wallet.`,
            txHash: receipt.transactionHash,
          });
          setMusdWithdrawInput('');
          reserves.refetch();
        }
      } else if (activeTab === 'withdraw_btc') {
        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'withdrawBTC',
          args: [btcWithVal],
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'BTC Reserve Withdrawn',
            description: `Withdrawn ${btcWithdrawInput} BTC from reserve to your wallet.`,
            txHash: receipt.transactionHash,
          });
          setBtcWithdrawInput('');
          reserves.refetch();
        }
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      notify({
        type: 'error',
        title: 'Transaction Failed',
        description: errObj.message || 'The transaction failed or was rejected.',
      });
    }
  };

  // 1. Disconnected
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Pre-Funded Capital Buffer
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Defense Reserve Balances</h1>
        </div>
        <EmptyState
          icon={<PiggyBank className="w-6 h-6 stroke-[1.5]" />}
          title="Connect Wallet to Inspect Reserve"
          description="Deposit or withdraw MUSD and native BTC into your personal BallastVault defense reserve."
        />
      </div>
    );
  }

  // 2. Loading
  if (vaultLoading || reserves.isLoading) {
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
            Pre-Funded Capital Buffer
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Defense Reserve Balances</h1>
        </div>
        <EmptyState
          icon={<Lock className="w-6 h-6 stroke-[1.5]" />}
          title="No BallastVault Proxy Deployed"
          description="Deploy your BallastVault proxy to begin pre-funding autonomous defense reserves."
          action={
            <Link href="/app">
              <Button variant="primary">Launch Setup Wizard</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const isWithdraw = activeTab === 'withdraw_musd' || activeTab === 'withdraw_btc';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-hairline pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Pre-Funded Capital Buffer
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Defense Reserve Balances</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-muted">Vault:</span>
          <AddressChip address={vaultAddress} showCopy showExplorer size="sm" />
          <StatusBadge
            status={musdReserve > 0n || btcReserve > 0n ? 'active' : 'warning'}
            label={musdReserve > 0n || btcReserve > 0n ? 'Reserves Funded' : 'Reserves Empty'}
          />
        </div>
      </div>

      {/* Prominent Warning Callout: Withdrawing Disarms Protection */}
      <div className="p-4 bg-watch/10 border border-watch/30 rounded-sm flex items-start gap-3 text-xs font-mono text-watch">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold uppercase tracking-wider">
            Critical Boundary: Withdrawing Reserve Disarms Autonomous Defense
          </span>
          <p className="leading-relaxed text-ink-muted">
            Your defense reserve is the sole capital pool keepers utilize to repay debt and top up collateral. Withdrawing reserves directly reduces your vault&apos;s defense capacity. If reserves are fully withdrawn, your position becomes unprotected, requiring manual intervention during market drawdowns.
          </p>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="MUSD Defense Reserve"
          value={`${Number(formatEther(musdReserve)).toLocaleString(undefined, { maximumFractionDigits: 2 })} MUSD`}
          hint="Repays debt when ICR < Trigger"
        />
        <Stat
          label="BTC Defense Reserve"
          value={`${Number(formatEther(btcReserve)).toFixed(4)} BTC`}
          hint="Adds collateral when ICR < Trigger"
        />
        <Stat
          label="Absorbable BTC Drop"
          value={
            reserves.defenseCapacity
              ? `-${reserves.defenseCapacity.absorbableDropPercent.toFixed(1)}%`
              : '0.0%'
          }
          hint="Buffer before ICR drops below Target"
        />
        <Stat
          label="Critical Survival Floor"
          value={
            reserves.defenseCapacity && reserves.defenseCapacity.criticalPrice > 0n
              ? `$${(Number(reserves.defenseCapacity.criticalPrice) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : '—'
          }
          hint="BTC price where reserves exhaust"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Deposit and Withdraw Controls */}
        <div className="lg:col-span-5 space-y-6">
          <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as typeof activeTab);
                writeHook.reset();
              }}
              tabs={[
                { id: 'deposit_musd', label: 'Deposit MUSD' },
                { id: 'deposit_btc', label: 'Deposit BTC' },
                { id: 'withdraw_musd', label: 'Withdraw MUSD' },
                { id: 'withdraw_btc', label: 'Withdraw BTC' },
              ]}
            />

            {/* Tab 1: Deposit MUSD */}
            {activeTab === 'deposit_musd' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>MUSD Amount</span>
                  <span>Wallet: {Number(formatEther(userMusd)).toFixed(2)} MUSD</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={musdDepositInput}
                    onChange={(e) => setMusdDepositInput(e.target.value)}
                    step="10"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setMusdDepositInput(formatEther(userMusd))}
                  >
                    Max
                  </Button>
                </div>
                <p className="text-xs font-mono text-ink-muted leading-relaxed">
                  MUSD reserves are deployed by keepers to extinguish debt when ICR drops below trigger, restoring target ratio without selling collateral.
                </p>
              </div>
            )}

            {/* Tab 2: Deposit BTC */}
            {activeTab === 'deposit_btc' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>Native BTC Amount</span>
                  <span>Wallet: {Number(formatEther(userBtc)).toFixed(4)} BTC</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.0000"
                    value={btcDepositInput}
                    onChange={(e) => setBtcDepositInput(e.target.value)}
                    step="0.001"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      if (userBtc > 500000000000000n) {
                        setBtcDepositInput(formatEther(userBtc - 500000000000000n));
                      }
                    }}
                  >
                    Max
                  </Button>
                </div>
                <p className="text-xs font-mono text-ink-muted leading-relaxed">
                  BTC reserves are deposited into the trove to raise collateral value if MUSD repayment alone cannot achieve the target waterline.
                </p>
              </div>
            )}

            {/* Tab 3: Withdraw MUSD */}
            {activeTab === 'withdraw_musd' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>MUSD to Withdraw</span>
                  <span>Reserve: {Number(formatEther(musdReserve)).toFixed(2)} MUSD</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={musdWithdrawInput}
                    onChange={(e) => setMusdWithdrawInput(e.target.value)}
                    step="10"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setMusdWithdrawInput(formatEther(musdReserve))}
                  >
                    Max
                  </Button>
                </div>
                <div className="p-3 bg-watch/10 border border-watch/30 rounded-sm text-xs font-mono text-watch leading-relaxed">
                  Withdrawing MUSD returns tokens directly to your wallet and reduces your available automated debt repayment capacity.
                </div>
              </div>
            )}

            {/* Tab 4: Withdraw BTC */}
            {activeTab === 'withdraw_btc' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>BTC to Withdraw</span>
                  <span>Reserve: {Number(formatEther(btcReserve)).toFixed(4)} BTC</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.0000"
                    value={btcWithdrawInput}
                    onChange={(e) => setBtcWithdrawInput(e.target.value)}
                    step="0.001"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => setBtcWithdrawInput(formatEther(btcReserve))}
                  >
                    Max
                  </Button>
                </div>
                <div className="p-3 bg-watch/10 border border-watch/30 rounded-sm text-xs font-mono text-watch leading-relaxed">
                  Withdrawing BTC returns native Bitcoin directly to your wallet and decreases your secondary collateral top-up buffer.
                </div>
              </div>
            )}

            {/* Feedback & Actions */}
            {(writeHook.status !== 'idle' || approveHook.status !== 'idle') && (
              <TxStatus
                status={approveHook.isPending ? approveHook.status : writeHook.status}
                txHash={writeHook.txHash || approveHook.txHash || undefined}
                error={writeHook.error || approveHook.error || undefined}
              />
            )}

            <div className="pt-2">
              <Button
                variant={isWithdraw ? 'danger' : 'primary'}
                size="lg"
                className="w-full"
                disabled={
                  writeHook.isPending ||
                  approveHook.isPending ||
                  (activeTab === 'deposit_musd' && (musdDepVal === 0n || musdDepVal > userMusd)) ||
                  (activeTab === 'deposit_btc' && (btcDepVal === 0n || btcDepVal > userBtc)) ||
                  (activeTab === 'withdraw_musd' && (musdWithVal === 0n || musdWithVal > musdReserve)) ||
                  (activeTab === 'withdraw_btc' && (btcWithVal === 0n || btcWithVal > btcReserve))
                }
                onClick={handleExecute}
              >
                {writeHook.isPending || approveHook.isPending
                  ? 'Confirming on Mezo...'
                  : activeTab === 'deposit_musd' && allowance < musdDepVal
                  ? 'Approve & Deposit MUSD'
                  : activeTab === 'deposit_musd'
                  ? 'Deposit MUSD Reserve'
                  : activeTab === 'deposit_btc'
                  ? 'Deposit BTC Reserve'
                  : activeTab === 'withdraw_musd'
                  ? 'Withdraw MUSD to Wallet'
                  : 'Withdraw BTC to Wallet'}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column: "BTC Price -> What Ballast Would Do" Derived Scenario Table */}
        <div className="lg:col-span-7 space-y-4">
          <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-3">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
                  BTC Price Drawdown Simulation
                </h3>
                <p className="text-[11px] font-mono text-ink-muted">
                  What Ballast Would Do (Derived Purely From Active On-Chain State &amp; Shared Math)
                </p>
              </div>
              <span className="text-[10px] font-mono text-ink-muted bg-paper-surface px-2 py-0.5 rounded border border-hairline">
                Trigger: {rule.triggerPercent?.toFixed(1) || '125.0'}% | Target: {rule.targetPercent?.toFixed(1) || '150.0'}%
              </span>
            </div>

            {scenarioData.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono text-ink-muted">
                Open an active Trove to compute price drawdown defense projections.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table
                  columns={[
                    { key: 'dropPercent', header: 'Shock' },
                    { key: 'price', header: 'BTC Price' },
                    { key: 'unprotectedICR', header: 'No Ballast' },
                    { key: 'protectedICR', header: 'With Ballast' },
                    { key: 'actionText', header: 'Keeper Defense Action' },
                    { key: 'remainingReserves', header: 'Remaining Reserve' },
                  ]}
                  data={scenarioData.map((s, idx) => ({
                    id: idx.toString(),
                    dropPercent: (
                      <span className="font-mono font-bold text-ink">{s.dropPercent}</span>
                    ),
                    price: <span className="font-mono tabular-nums">{s.price}</span>,
                    unprotectedICR: (
                      <span
                        className={`font-mono tabular-nums ${
                          parseFloat(s.unprotectedICR) < 110
                            ? 'text-danger font-bold'
                            : parseFloat(s.unprotectedICR) < 125
                            ? 'text-watch'
                            : 'text-ink-muted'
                        }`}
                      >
                        {s.unprotectedICR}
                      </span>
                    ),
                    protectedICR: (
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          parseFloat(s.protectedICR) < 110
                            ? 'text-danger'
                            : parseFloat(s.protectedICR) >= 140
                            ? 'text-safe'
                            : 'text-watch'
                        }`}
                      >
                        {s.protectedICR}
                      </span>
                    ),
                    actionText: (
                      <span
                        className={`text-[11px] font-mono ${
                          s.status === 'defended'
                            ? 'text-ember font-semibold'
                            : s.status === 'liquidated'
                            ? 'text-danger'
                            : 'text-ink-muted'
                        }`}
                      >
                        {s.actionText}
                      </span>
                    ),
                    remainingReserves: (
                      <span className="text-[10px] font-mono text-ink-muted tabular-nums whitespace-nowrap">
                        {s.remainingReserves}
                      </span>
                    ),
                  }))}
                />
              </div>
            )}

            <div className="flex items-center gap-2 text-[11px] font-mono text-ink-muted pt-2 border-t border-hairline">
              <Info className="w-3.5 h-3.5 text-ember shrink-0" />
              <span>
                Simulated step-by-step using 1e18 fixed-point math matching BallastVault.sol. Projections derived from active chain state.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
