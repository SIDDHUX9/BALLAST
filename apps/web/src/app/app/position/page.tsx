'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient } from 'wagmi';
import { formatEther, parseEther, zeroAddress } from 'viem';
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
  computeICR,
  computeLiquidationPrice,
  PROTOCOL_CONSTANTS,
  PRECISION,
} from '@ballast/shared';
import { getInsertionHints } from '../../../lib/hints';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Tabs } from '../../../components/ui/tabs';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { DataRow } from '../../../components/ui/data-row';
import { StatusBadge } from '../../../components/ui/status-badge';
import { AddressChip } from '../../../components/ui/address-chip';
import { TxStatus } from '../../../components/ui/tx-status';
import {
  Coins,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock,
} from 'lucide-react';

export default function PositionPage() {
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
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
  const [activeTab, setActiveTab] = useState<'add_coll' | 'borrow' | 'repay' | 'withdraw_coll' | 'close'>('add_coll');

  // Input states
  const [collInput, setCollInput] = useState('');
  const [borrowInput, setBorrowInput] = useState('');
  const [repayInput, setRepayInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');

  // Write hooks
  const writeHook = useBallastWrite();
  const approveHook = useBallastWrite();

  // Safe parsed values
  const collVal = useMemo(() => {
    try {
      return collInput && parseFloat(collInput) > 0 ? parseEther(collInput) : 0n;
    } catch {
      return 0n;
    }
  }, [collInput]);

  const borrowVal = useMemo(() => {
    try {
      return borrowInput && parseFloat(borrowInput) > 0 ? parseEther(borrowInput) : 0n;
    } catch {
      return 0n;
    }
  }, [borrowInput]);

  const repayVal = useMemo(() => {
    try {
      return repayInput && parseFloat(repayInput) > 0 ? parseEther(repayInput) : 0n;
    } catch {
      return 0n;
    }
  }, [repayInput]);

  const withdrawVal = useMemo(() => {
    try {
      return withdrawInput && parseFloat(withdrawInput) > 0 ? parseEther(withdrawInput) : 0n;
    } catch {
      return 0n;
    }
  }, [withdrawInput]);

  // Derived on-chain parameters
  const currentColl = position.collateral ?? 0n;
  const currentDebt = position.debt ?? 0n;
  const price = position.price ?? 0n;
  const mcr = protocol.mcr ?? PROTOCOL_CONSTANTS.MCR;
  const minNetDebt = protocol.minNetDebt ?? PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT;
  const triggerICR = rule.triggerICR ?? 0n;

  // Real-time Preview Computations
  const preview = useMemo(() => {
    let nextColl = currentColl;
    let nextDebt = currentDebt;

    if (activeTab === 'add_coll') {
      nextColl = currentColl + collVal;
    } else if (activeTab === 'borrow') {
      nextDebt = currentDebt + borrowVal;
    } else if (activeTab === 'repay') {
      nextDebt = currentDebt > repayVal ? currentDebt - repayVal : 0n;
    } else if (activeTab === 'withdraw_coll') {
      nextColl = currentColl > withdrawVal ? currentColl - withdrawVal : 0n;
    }

    let nextICR: bigint | null = null;
    let nextICRPercent: number | null = null;
    let nextLiqPrice: bigint | null = null;

    if (nextDebt > 0n && nextColl > 0n && price > 0n) {
      nextICR = computeICR(nextColl, nextDebt, price);
      nextICRPercent = Number((nextICR * 10000n) / PRECISION) / 100;
      nextLiqPrice = computeLiquidationPrice(nextColl, nextDebt, mcr);
    }

    // Validation checks
    let isBlocked = false;
    let blockReason: string | null = null;
    let isWarning = false;
    let warnReason: string | null = null;

    if (activeTab === 'add_coll') {
      if (collVal === 0n) {
        isBlocked = true;
      } else if (reserves.userBtcBalance !== null && collVal > reserves.userBtcBalance) {
        isBlocked = true;
        blockReason = 'Entered amount exceeds available wallet BTC balance.';
      }
    } else if (activeTab === 'borrow') {
      if (borrowVal === 0n) {
        isBlocked = true;
      } else if (nextICR !== null && nextICR < mcr) {
        isBlocked = true;
        blockReason = `Action blocked: Resulting ICR (${nextICRPercent?.toFixed(1)}%) falls below protocol MCR (110%).`;
      } else if (triggerICR > 0n && nextICR !== null && nextICR < triggerICR) {
        isWarning = true;
        const trigPct = (Number((triggerICR * 10000n) / PRECISION) / 100).toFixed(1);
        warnReason = `Caution: Resulting ICR (${nextICRPercent?.toFixed(1)}%) is below your defense trigger (${trigPct}%). Keepers will be authorized to defend immediately.`;
      }
    } else if (activeTab === 'repay') {
      const netDebtAfter = nextDebt > PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION
        ? nextDebt - PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION
        : 0n;

      if (repayVal === 0n) {
        isBlocked = true;
      } else if (reserves.userMusdBalance !== null && repayVal > reserves.userMusdBalance) {
        isBlocked = true;
        blockReason = 'Entered repayment exceeds your available MUSD wallet balance.';
      } else if (netDebtAfter > 0n && netDebtAfter < minNetDebt) {
        isBlocked = true;
        blockReason = `Protocol rule: Remaining net debt cannot be between 0 and ${formatEther(minNetDebt)} MUSD. Use 'Close Trove' instead to liquidate completely.`;
      }
    } else if (activeTab === 'withdraw_coll') {
      if (withdrawVal === 0n) {
        isBlocked = true;
      } else if (withdrawVal > currentColl) {
        isBlocked = true;
        blockReason = 'Entered withdrawal exceeds your locked trove collateral.';
      } else if (nextICR !== null && nextICR < mcr) {
        isBlocked = true;
        blockReason = `Action blocked: Resulting ICR (${nextICRPercent?.toFixed(1)}%) falls below protocol MCR (110%).`;
      } else if (triggerICR > 0n && nextICR !== null && nextICR < triggerICR) {
        isWarning = true;
        const trigPct = (Number((triggerICR * 10000n) / PRECISION) / 100).toFixed(1);
        warnReason = `Caution: Resulting ICR (${nextICRPercent?.toFixed(1)}%) is below your defense trigger (${trigPct}%). Keepers will trigger defense immediately.`;
      }
    }

    return {
      nextColl,
      nextDebt,
      nextICR,
      nextICRPercent,
      nextLiqPrice,
      isBlocked,
      blockReason,
      isWarning,
      warnReason,
    };
  }, [
    activeTab,
    currentColl,
    currentDebt,
    price,
    mcr,
    minNetDebt,
    triggerICR,
    collVal,
    borrowVal,
    repayVal,
    withdrawVal,
    reserves.userBtcBalance,
    reserves.userMusdBalance,
  ]);

  // Close Trove Calculations
  const closeDetails = useMemo(() => {
    const debt = currentDebt;
    const gasComp = PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION;
    const netDebt = debt > gasComp ? debt - gasComp : 0n;

    const musdReserve = reserves.musdReserve ?? 0n;
    const btcReserve = reserves.btcReserve ?? 0n;
    const userMusd = reserves.userMusdBalance ?? 0n;

    let shortfall = 0n;
    let leftoverMusd = 0n;

    if (netDebt > 0n) {
      if (musdReserve < netDebt) {
        shortfall = netDebt - musdReserve;
      } else {
        leftoverMusd = musdReserve - netDebt;
      }
    } else {
      leftoverMusd = musdReserve;
    }

    const canCoverShortfall = userMusd >= shortfall;
    const allowance = reserves.musdAllowance ?? 0n;
    const needsApproval = shortfall > 0n && allowance < shortfall;

    return {
      totalDebt: debt,
      gasCompReturned: gasComp,
      netDebtToRepay: netDebt,
      musdReserveUsed: musdReserve < netDebt ? musdReserve : netDebt,
      shortfallFromWallet: shortfall,
      leftoverMusdReturned: leftoverMusd,
      collateralReturned: currentColl,
      btcReserveReturned: btcReserve,
      canCoverShortfall,
      needsApproval,
    };
  }, [currentDebt, reserves.musdReserve, reserves.btcReserve, reserves.userMusdBalance, reserves.musdAllowance, currentColl]);

  // Execute Action
  const handleExecute = async () => {
    if (!publicClient || !vaultAddress) return;

    try {
      if (activeTab === 'add_coll') {
        const { upperHint, lowerHint } = await getInsertionHints(
          publicClient,
          currentColl + collVal,
          currentDebt
        );
        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'addCollateral',
          args: [upperHint, lowerHint],
          value: collVal,
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'Collateral Deposited',
            description: `Successfully added ${collInput} BTC to Trove collateral.`,
            txHash: receipt.transactionHash,
          });
          setCollInput('');
          position.refetch();
          reserves.refetch();
        }
      } else if (activeTab === 'borrow') {
        const { upperHint, lowerHint } = await getInsertionHints(
          publicClient,
          currentColl,
          currentDebt + borrowVal
        );
        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'borrowMore',
          args: [borrowVal, upperHint, lowerHint, userAddress || zeroAddress],
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'MUSD Borrowed',
            description: `Successfully borrowed ${borrowInput} MUSD to your wallet.`,
            txHash: receipt.transactionHash,
          });
          setBorrowInput('');
          position.refetch();
          reserves.refetch();
        }
      } else if (activeTab === 'repay') {
        // Check allowance
        const allowance = reserves.musdAllowance ?? 0n;
        if (allowance < repayVal) {
          const appReceipt = await approveHook.writeAsync({
            address: MATSNET_PROTOCOL_ADDRESSES.musd,
            abi: MusdAbi,
            functionName: 'approve',
            args: [vaultAddress, repayVal],
          });
          if (appReceipt) {
            notify({
              type: 'info',
              title: 'MUSD Approved',
              description: 'Approval confirmed. Proceeding with repayment.',
              txHash: appReceipt.transactionHash,
            });
            reserves.refetch();
          }
        }

        const { upperHint, lowerHint } = await getInsertionHints(
          publicClient,
          currentColl,
          currentDebt > repayVal ? currentDebt - repayVal : 0n
        );
        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'repay',
          args: [repayVal, upperHint, lowerHint],
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'Debt Repaid',
            description: `Successfully repaid ${repayInput} MUSD of Trove debt.`,
            txHash: receipt.transactionHash,
          });
          setRepayInput('');
          position.refetch();
          reserves.refetch();
        }
      } else if (activeTab === 'withdraw_coll') {
        const { upperHint, lowerHint } = await getInsertionHints(
          publicClient,
          currentColl > withdrawVal ? currentColl - withdrawVal : 0n,
          currentDebt
        );
        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'withdrawCollateral',
          args: [withdrawVal, upperHint, lowerHint],
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'Collateral Withdrawn',
            description: `Successfully withdrawn ${withdrawInput} BTC to your wallet.`,
            txHash: receipt.transactionHash,
          });
          setWithdrawInput('');
          position.refetch();
          reserves.refetch();
        }
      } else if (activeTab === 'close') {
        if (closeDetails.needsApproval) {
          const appReceipt = await approveHook.writeAsync({
            address: MATSNET_PROTOCOL_ADDRESSES.musd,
            abi: MusdAbi,
            functionName: 'approve',
            args: [vaultAddress, closeDetails.shortfallFromWallet],
          });
          if (appReceipt) {
            notify({
              type: 'info',
              title: 'Shortfall Approved',
              description: 'MUSD shortfall approved. Now executing trove closure.',
              txHash: appReceipt.transactionHash,
            });
            reserves.refetch();
          }
        }

        const receipt = await writeHook.writeAsync({
          address: vaultAddress,
          abi: BallastVaultAbi,
          functionName: 'closeTrove',
          args: [],
        });
        if (receipt) {
          notify({
            type: 'success',
            title: 'Trove Closed Successfully',
            description: `Trove closed. Returned ${formatEther(closeDetails.collateralReturned)} BTC and refunded 200 MUSD gas compensation.`,
            txHash: receipt.transactionHash,
          });
          position.refetch();
          reserves.refetch();
        }
      }
    } catch (err: unknown) {
      const errObj = err as { message?: string };
      notify({
        type: 'error',
        title: 'Transaction Failed',
        description: errObj.message || 'The transaction was rejected or reverted on-chain.',
      });
    }
  };

  // 1. Disconnected State
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Trove Management
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Collateral & Debt Position</h1>
        </div>
        <EmptyState
          icon={<Coins className="w-6 h-6 stroke-[1.5]" />}
          title="Connect Wallet to Manage Position"
          description="Connect your wallet to inspect your active trove, add or withdraw Bitcoin collateral, borrow MUSD, or close your position."
        />
      </div>
    );
  }

  // 2. Loading State
  if (vaultLoading || position.isLoading) {
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

  // 3. No Vault State
  if (!vaultExists || !vaultAddress) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Trove Management
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Collateral & Debt Position</h1>
        </div>
        <EmptyState
          icon={<Lock className="w-6 h-6 stroke-[1.5]" />}
          title="No BallastVault Proxy Deployed"
          description="Your wallet does not yet own a BallastVault proxy on Mezo Matsnet. Deploy a vault to establish an automated protected trove."
          action={
            <Link href="/app">
              <Button variant="primary">Launch Setup Wizard</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // 4. Inactive Trove State
  if (position.status !== 'active') {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Trove Management
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Collateral & Debt Position</h1>
        </div>
        <EmptyState
          icon={<Coins className="w-6 h-6 stroke-[1.5]" />}
          title={`Trove Status: ${position.status || 'Non-Existent'}`}
          description={
            position.status === 'closedByOwner'
              ? 'This trove was closed by the owner. All collateral and debt have been resolved.'
              : position.status === 'closedByLiquidation'
              ? 'This trove was liquidated by the protocol.'
              : 'Your BallastVault is deployed but does not currently hold an active MUSD trove.'
          }
          action={
            <Link href="/app">
              <Button variant="primary">Open New Trove</Button>
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
            Trove Management
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Collateral & Debt Position</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-muted">Vault:</span>
          <AddressChip address={vaultAddress} showCopy showExplorer size="sm" />
          <StatusBadge status="active" label="Trove Active" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: On-Chain Ledger State & Live Preview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
                Current On-Chain State
              </h3>
              <span className="text-[11px] font-mono text-ink-muted">
                BTC Price: ${position.price ? (Number(position.price) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}
              </span>
            </div>

            <DataRow
              label="Locked Collateral"
              value={`${position.collateral ? Number(formatEther(position.collateral)).toFixed(4) : '0'} BTC`}
            />
            <DataRow
              label="Total Trove Debt"
              value={`${position.debt ? Number(formatEther(position.debt)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} MUSD`}
            />
            <DataRow
              label="Net Debt (Borrower)"
              value={`${position.netDebt ? Number(formatEther(position.netDebt)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : '0'} MUSD`}
            />
            <DataRow
              label="Liquidation Reserve"
              value="200.00 MUSD"
              hint="Gas Compensation held by Mezo Protocol"
            />
            <DataRow
              label="Individual Collateral Ratio"
              value={position.icrPercent ? `${position.icrPercent.toFixed(2)}%` : '—'}
            />
            <DataRow
              label="Liquidation Price"
              value={position.liquidationPrice ? `$${(Number(position.liquidationPrice) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
              hint="Price where ICR hits 110% MCR"
            />
          </div>

          {/* Real-Time Preview Card */}
          <div className="border border-hairline bg-paper-surface p-6 rounded-sm space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-2">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink flex items-center gap-1.5">
                <span>Resulting State Preview</span>
                <span className="w-1.5 h-1.5 rounded-full bg-ember animate-pulse" />
              </h3>
              <span className="text-[10px] font-mono text-ink-muted uppercase">Real-Time Simulation</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-paper-raised border border-hairline rounded-sm space-y-1">
                <span className="text-[10px] font-mono text-ink-muted uppercase">Simulated ICR</span>
                <div className="text-lg font-serif font-bold text-ink">
                  {preview.nextICRPercent ? `${preview.nextICRPercent.toFixed(2)}%` : '—'}
                </div>
                <div className="text-[10px] font-mono text-ink-muted">
                  Current: {position.icrPercent ? `${position.icrPercent.toFixed(1)}%` : '—'}
                </div>
              </div>

              <div className="p-3 bg-paper-raised border border-hairline rounded-sm space-y-1">
                <span className="text-[10px] font-mono text-ink-muted uppercase">New Liquidation Price</span>
                <div className="text-lg font-serif font-bold text-ink">
                  {preview.nextLiqPrice ? `$${(Number(preview.nextLiqPrice) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                </div>
                <div className="text-[10px] font-mono text-ink-muted">
                  Current: {position.liquidationPrice ? `$${(Number(position.liquidationPrice) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                </div>
              </div>
            </div>

            {/* Warnings and Blockers */}
            {preview.blockReason && (
              <div className="p-3 bg-danger/10 border border-danger/30 rounded-sm flex items-start gap-2.5 text-xs font-mono text-danger">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{preview.blockReason}</span>
              </div>
            )}

            {preview.isWarning && !preview.blockReason && (
              <div className="p-3 bg-watch/10 border border-watch/30 rounded-sm flex items-start gap-2.5 text-xs font-mono text-watch">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{preview.warnReason}</span>
              </div>
            )}

            {!preview.blockReason && !preview.isWarning && (
              <div className="p-3 bg-safe/10 border border-safe/30 rounded-sm flex items-center gap-2 text-xs font-mono text-safe">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Operation adheres to protocol parameters and defense trigger boundaries.</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Actions */}
        <div className="lg:col-span-7">
          <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as typeof activeTab);
                writeHook.reset();
              }}
              tabs={[
                { id: 'add_coll', label: 'Add Collateral' },
                { id: 'borrow', label: 'Borrow More' },
                { id: 'repay', label: 'Repay MUSD' },
                { id: 'withdraw_coll', label: 'Withdraw BTC' },
                { id: 'close', label: 'Close Trove' },
              ]}
            />

            {/* Tab 1: Add Collateral */}
            {activeTab === 'add_coll' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>Native BTC Amount</span>
                  <span>
                    Wallet Balance: {reserves.userBtcBalance !== null ? Number(formatEther(reserves.userBtcBalance)).toFixed(4) : '0'} BTC
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.0000"
                    value={collInput}
                    onChange={(e) => setCollInput(e.target.value)}
                    step="0.001"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      if (reserves.userBtcBalance && reserves.userBtcBalance > 500000000000000n) {
                        // Max minus 0.0005 BTC gas buffer
                        const maxBtc = reserves.userBtcBalance - 500000000000000n;
                        setCollInput(formatEther(maxBtc));
                      }
                    }}
                  >
                    Max
                  </Button>
                </div>
                <p className="text-xs font-mono text-ink-muted">
                  Depositing additional Bitcoin increases your ICR and decreases your liquidation price.
                </p>
              </div>
            )}

            {/* Tab 2: Borrow More */}
            {activeTab === 'borrow' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>Additional MUSD Debt to Mint</span>
                  <span>Borrow Fee: 0.50%</span>
                </div>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={borrowInput}
                  onChange={(e) => setBorrowInput(e.target.value)}
                  step="10"
                  min="0"
                />
                <p className="text-xs font-mono text-ink-muted">
                  Minted MUSD will be transferred directly to your connected wallet. Keep ICR strictly above 110% MCR.
                </p>
              </div>
            )}

            {/* Tab 3: Repay MUSD */}
            {activeTab === 'repay' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>MUSD Amount to Repay</span>
                  <span>
                    Wallet Balance: {reserves.userMusdBalance !== null ? Number(formatEther(reserves.userMusdBalance)).toFixed(2) : '0'} MUSD
                  </span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={repayInput}
                    onChange={(e) => setRepayInput(e.target.value)}
                    step="10"
                    min="0"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      if (reserves.userMusdBalance) {
                        const netDebt = currentDebt > PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION
                          ? currentDebt - PROTOCOL_CONSTANTS.MUSD_GAS_COMPENSATION
                          : 0n;
                        const maxLegal = netDebt > minNetDebt ? netDebt - minNetDebt : 0n;
                        const toRepay = reserves.userMusdBalance < maxLegal ? reserves.userMusdBalance : maxLegal;
                        setRepayInput(formatEther(toRepay));
                      }
                    }}
                  >
                    Max Safe
                  </Button>
                </div>
                <p className="text-xs font-mono text-ink-muted">
                  Remaining net debt cannot fall in (0, {formatEther(minNetDebt)} MUSD). To pay off all debt, use Close Trove.
                </p>
              </div>
            )}

            {/* Tab 4: Withdraw Collateral */}
            {activeTab === 'withdraw_coll' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-mono text-ink-muted">
                  <span>BTC Collateral to Withdraw</span>
                  <span>Locked: {formatEther(currentColl)} BTC</span>
                </div>
                <Input
                  type="number"
                  placeholder="0.0000"
                  value={withdrawInput}
                  onChange={(e) => setWithdrawInput(e.target.value)}
                  step="0.001"
                  min="0"
                />
                <p className="text-xs font-mono text-ink-muted">
                  Withdrawn Bitcoin returns directly to your connected wallet. Trove ICR must remain safely above 110% MCR.
                </p>
              </div>
            )}

            {/* Tab 5: Close Trove Breakdown */}
            {activeTab === 'close' && (
              <div className="space-y-4">
                <div className="p-4 border border-hairline bg-paper-surface rounded-sm space-y-3">
                  <h4 className="text-xs font-mono uppercase tracking-wider font-bold text-ink border-b border-hairline pb-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-ember stroke-[1.5]" />
                    <span>Complete Trove Closure & Return Mechanics</span>
                  </h4>
                  <div className="space-y-2 text-xs font-mono">
                    <DataRow
                      label="Total Trove Debt"
                      value={`${Number(formatEther(closeDetails.totalDebt)).toFixed(2)} MUSD`}
                    />
                    <DataRow
                      label="Gas Comp Offset"
                      value={`- ${formatEther(closeDetails.gasCompReturned)} MUSD`}
                      hint="200 MUSD reserve is refunded directly against debt"
                    />
                    <DataRow
                      label="Net Debt to Extinguish"
                      value={`${Number(formatEther(closeDetails.netDebtToRepay)).toFixed(2)} MUSD`}
                    />
                    <div className="border-t border-hairline my-2 pt-2" />
                    <DataRow
                      label="Covered by MUSD Reserve"
                      value={`- ${Number(formatEther(closeDetails.musdReserveUsed)).toFixed(2)} MUSD`}
                    />
                    <DataRow
                      label="Shortfall from Connected Wallet"
                      value={`${Number(formatEther(closeDetails.shortfallFromWallet)).toFixed(2)} MUSD`}
                      hint="Required in your wallet to extinguish remaining debt"
                    />
                    <div className="border-t border-hairline my-2 pt-2" />
                    <DataRow
                      label="Locked Collateral Returned"
                      value={`+ ${Number(formatEther(closeDetails.collateralReturned)).toFixed(4)} BTC`}
                    />
                    {closeDetails.btcReserveReturned > 0n && (
                      <DataRow
                        label="BTC Reserve Returned"
                        value={`+ ${Number(formatEther(closeDetails.btcReserveReturned)).toFixed(4)} BTC`}
                      />
                    )}
                    {closeDetails.leftoverMusdReturned > 0n && (
                      <DataRow
                        label="Leftover MUSD Reserve Returned"
                        value={`+ ${Number(formatEther(closeDetails.leftoverMusdReturned)).toFixed(2)} MUSD`}
                      />
                    )}
                  </div>
                </div>

                {!closeDetails.canCoverShortfall && (
                  <div className="p-3 bg-danger/10 border border-danger/30 rounded-sm text-xs font-mono text-danger flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      Insufficient MUSD in wallet to cover closure shortfall ({Number(formatEther(closeDetails.shortfallFromWallet)).toFixed(2)} MUSD needed).
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Transaction Status Feedback */}
            {(writeHook.status !== 'idle' || approveHook.status !== 'idle') && (
              <TxStatus
                status={
                  approveHook.isPending
                    ? approveHook.status
                    : writeHook.status
                }
                txHash={writeHook.txHash || approveHook.txHash || undefined}
                error={writeHook.error || approveHook.error || undefined}
              />
            )}

            {/* Action Button */}
            <div className="pt-2">
              <Button
                variant={activeTab === 'close' ? 'danger' : 'primary'}
                size="lg"
                className="w-full"
                disabled={
                  writeHook.isPending ||
                  approveHook.isPending ||
                  (activeTab === 'close'
                    ? !closeDetails.canCoverShortfall
                    : preview.isBlocked)
                }
                onClick={handleExecute}
              >
                {writeHook.isPending || approveHook.isPending
                  ? 'Processing Transaction...'
                  : activeTab === 'add_coll'
                  ? 'Deposit Collateral'
                  : activeTab === 'borrow'
                  ? 'Mint & Borrow MUSD'
                  : activeTab === 'repay'
                  ? 'Repay Trove Debt'
                  : activeTab === 'withdraw_coll'
                  ? 'Withdraw Collateral'
                  : closeDetails.needsApproval
                  ? 'Approve & Close Trove'
                  : 'Confirm & Close Trove'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
