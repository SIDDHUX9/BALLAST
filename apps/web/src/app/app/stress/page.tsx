'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAccount, useBlockNumber } from 'wagmi';
import { formatEther } from 'viem';
import {
  useVault,
  usePosition,
  useRule,
  useReserves,
  useProtocolParams,
} from '../../../hooks';
import {
  simulateStressTest,
  PROTOCOL_CONSTANTS,
  PRECISION,
  type StressTestResult,
} from '@ballast/shared';
import { Slider } from '../../../components/ui/slider';
import { Button } from '../../../components/ui/button';
import { Stat } from '../../../components/ui/stat';
import { Table } from '../../../components/ui/table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatusBadge } from '../../../components/ui/status-badge';
import { AddressChip } from '../../../components/ui/address-chip';
import {
  Activity,
  Info,
  Lock,
} from 'lucide-react';

export default function StressTestPage() {
  const { address: userAddress, isConnected } = useAccount();
  const { data: blockNumber } = useBlockNumber({ watch: true });

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

  // Price Drop Slider (0% to 60%)
  const [priceDropPercent, setPriceDropPercent] = useState<number>(30);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  // Simulation execution using purely on-chain inputs and pure math
  const simResult: StressTestResult | null = useMemo(() => {
    if (
      !position.collateral ||
      !position.debt ||
      !position.price ||
      !rule.triggerICR ||
      !rule.targetICR
    ) {
      return null;
    }

    return simulateStressTest({
      collateral: position.collateral,
      debt: position.debt,
      currentPrice: position.price,
      priceDropPercent,
      triggerICR: rule.triggerICR,
      targetICR: rule.targetICR,
      maxTipBps: rule.maxTipBps ?? 50,
      musdReserve: reserves.musdReserve ?? 0n,
      btcReserve: reserves.btcReserve ?? 0n,
      minNetDebt: protocol.minNetDebt ?? PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT,
      mcr: protocol.mcr ?? PROTOCOL_CONSTANTS.MCR,
      systemTCR: position.tcr ?? 1500000000000000000n,
      enabled: rule.enabled ?? true,
    });
  }, [
    position.collateral,
    position.debt,
    position.price,
    position.tcr,
    rule.triggerICR,
    rule.targetICR,
    rule.maxTipBps,
    rule.enabled,
    reserves.musdReserve,
    reserves.btcReserve,
    protocol.minNetDebt,
    protocol.mcr,
    priceDropPercent,
  ]);

  // Selected shock point
  const currentPoint = useMemo(() => {
    if (!simResult || simResult.points.length === 0) return null;
    const clamped = Math.min(simResult.points.length - 1, Math.max(0, priceDropPercent));
    return simResult.points[clamped];
  }, [simResult, priceDropPercent]);

  // 1. Disconnected
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Real-Time Shock Analysis
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Trove Stress Testing & Volatility Simulation
          </h1>
        </div>
        <EmptyState
          icon={<Activity className="w-6 h-6 stroke-[1.5]" />}
          title="Connect Wallet to Run Shock Simulations"
          description="Simulate sudden -20%, -35%, and -50% Bitcoin price drawdowns against your active trove and defense reserve."
        />
      </div>
    );
  }

  // 2. Loading
  if (vaultLoading || position.isLoading) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // 3. No Vault or Inactive Trove
  if (!vaultExists || !vaultAddress || position.status !== 'active') {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Real-Time Shock Analysis
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Trove Stress Testing & Volatility Simulation
          </h1>
        </div>
        <EmptyState
          icon={<Lock className="w-6 h-6 stroke-[1.5]" />}
          title="No Active Trove to Simulate"
          description="A funded BallastVault and active MUSD trove are required to simulate autonomous defense execution under market shocks."
          action={
            <Link href="/app">
              <Button variant="primary">Open Trove & Deposit Reserve</Button>
            </Link>
          }
        />
      </div>
    );
  }

  // Custom Accessible SVG Chart Data Points
  const chartPoints = simResult?.points || [];
  const maxDrop = 60;
  const svgWidth = 800;
  const svgHeight = 320;
  const padding = { top: 30, right: 30, bottom: 40, left: 50 };

  const plotWidth = svgWidth - padding.left - padding.right;
  const plotHeight = svgHeight - padding.top - padding.bottom;

  // Y Scale: ICR from 90% to 220%
  const yMin = 90;
  const yMax = 220;

  const getX = (dropPct: number) => padding.left + (dropPct / maxDrop) * plotWidth;
  const getY = (icrPct: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, icrPct));
    return padding.top + plotHeight - ((clamped - yMin) / (yMax - yMin)) * plotHeight;
  };

  // Build SVG Path Strings
  const unprotectedPath = chartPoints
    .map((p, i) => {
      const icrPct = Number((p.unprotectedICR * 10000n) / PRECISION) / 100;
      const x = getX(p.dropPercent);
      const y = getY(icrPct);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const protectedPath = chartPoints
    .map((p, i) => {
      const icrPct = Number((p.protectedICR * 10000n) / PRECISION) / 100;
      const x = getX(p.dropPercent);
      const y = getY(icrPct);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');

  const mcrY = getY(110);
  const triggerY = getY(rule.triggerPercent || 125);
  const targetY = getY(rule.targetPercent || 150);
  const currentDropX = getX(priceDropPercent);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-hairline pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Real-Time Shock Analysis
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Trove Stress Testing & Volatility Simulation
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-muted">Active State:</span>
          <AddressChip address={vaultAddress} showCopy showExplorer size="sm" />
          <StatusBadge status="active" label={`Block #${blockNumber?.toString() || '—'}`} />
        </div>
      </div>

      {/* Primary Slider & Quick Buttons */}
      <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
              Simulated Bitcoin Price Drawdown
            </span>
            <p className="text-[11px] font-mono text-ink-muted">
              Slide to shock the BTC oracle price and evaluate autonomous keeper defenses
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {[10, 20, 30, 40, 50, 60].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPriceDropPercent(pct)}
                className={`px-2 py-1 text-[11px] font-mono rounded-sm border transition-colors ${
                  priceDropPercent === pct
                    ? 'border-ember bg-ember text-paper-raised font-bold'
                    : 'border-hairline bg-paper-surface text-ink-muted hover:text-ink'
                }`}
              >
                -{pct}%
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between font-mono">
            <span className="text-xs text-ink-muted">0% (Current Spot)</span>
            <span className="text-xl font-serif font-bold text-ember tabular-nums">
              -{priceDropPercent}% Drawdown
            </span>
            <span className="text-xs text-ink-muted">-60% (Max Stress)</span>
          </div>
          <Slider
            value={priceDropPercent}
            min={0}
            max={60}
            step={1}
            onValueChange={setPriceDropPercent}
          />
        </div>
      </div>

      {/* KPI Stats Bar at Selected Drawdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Simulated BTC Price"
          value={
            currentPoint
              ? `$${(Number(currentPoint.price) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : '—'
          }
          hint={`Spot: $${position.price ? (Number(position.price) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 }) : '—'}`}
        />
        <Stat
          label="Without Ballast (ICR)"
          value={
            currentPoint
              ? `${(Number((currentPoint.unprotectedICR * 10000n) / PRECISION) / 100).toFixed(1)}%`
              : '—'
          }
          hint={
            currentPoint?.isLiquidatedUnprotected
              ? 'LIQUIDATED (< 110% MCR)'
              : 'Unprotected Trove'
          }
        />
        <Stat
          label="With Ballast Defense"
          value={
            currentPoint
              ? `${(Number((currentPoint.protectedICR * 10000n) / PRECISION) / 100).toFixed(1)}%`
              : '—'
          }
          hint={
            currentPoint?.isLiquidatedProtected
              ? 'LIQUIDATED (Reserves Exhausted)'
              : 'Protected Waterline'
          }
        />
        <Stat
          label="Survival Floor"
          value={
            simResult?.survivesDownToPrice
              ? `$${(Number(simResult.survivesDownToPrice) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : '—'
          }
          hint={
            simResult?.reservesExhaustedPrice
              ? `Reserves dry at $${(Number(simResult.reservesExhaustedPrice) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : 'Full defense buffer available'
          }
        />
      </div>

      {/* Secondary Status Strip: Redemption Exposure & Reserve Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-hairline bg-paper-surface rounded-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
              Redemption Risk Exposure
            </span>
            <StatusBadge
              status={
                currentPoint?.redemptionRisk === 'high'
                  ? 'danger'
                  : currentPoint?.redemptionRisk === 'moderate'
                  ? 'warning'
                  : 'active'
              }
              label={
                currentPoint?.redemptionRisk === 'high'
                  ? 'High Exposure'
                  : currentPoint?.redemptionRisk === 'moderate'
                  ? 'Moderate vs TCR'
                  : 'Low Exposure'
              }
            />
          </div>
          <p className="text-xs font-mono text-ink-muted leading-relaxed">
            In Liquity/Mezo MUSD, troves with the lowest ICR are redeemed first when MUSD trades below peg. System Total Collateral Ratio (TCR) is currently {position.tcrPercent ? `${position.tcrPercent.toFixed(1)}%` : '150%'}. Maintaining ICR above TCR shields your position from arbitrage redemptions.
          </p>
        </div>

        <div className="p-4 border border-hairline bg-paper-surface rounded-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
              Remaining Reserve at -{priceDropPercent}%
            </span>
            <span className="text-xs font-mono tabular-nums font-semibold text-ink">
              {currentPoint
                ? `${Number(formatEther(currentPoint.remainingMusdReserve)).toFixed(0)} MUSD | ${Number(formatEther(currentPoint.remainingBtcReserve)).toFixed(4)} BTC`
                : '—'}
            </span>
          </div>
          <p className="text-xs font-mono text-ink-muted leading-relaxed">
            {simResult?.hasDefended
              ? `Ballast executes ${simResult.defenseSteps.length} progressive defense action(s) up to this shock point to keep your ICR above the ${rule.triggerPercent?.toFixed(0) || '125'}% trigger.`
              : 'No reserves deployed yet at this drawdown level. Position ICR remains above your trigger threshold.'}
          </p>
        </div>
      </div>

      {/* Visual Chart / Data Table Alternative */}
      <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
          <div className="space-y-1">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
              Drawdown Trajectory &amp; Waterline Curve
            </h3>
            <p className="text-[11px] font-mono text-ink-muted">
              Comparison between unprotected debt liquidation and Ballast autonomous defense
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'chart' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('chart')}
            >
              SVG Trajectory Chart
            </Button>
            <Button
              variant={viewMode === 'table' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Data Table Alternative
            </Button>
          </div>
        </div>

        {viewMode === 'chart' ? (
          <div className="space-y-4">
            {/* Custom SVG Chart */}
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto font-mono text-[10px]"
                role="img"
                aria-label="Collateral ratio simulation chart showing unprotected vs Ballast protected path as Bitcoin price drops from 0% to 60%"
              >
                {/* Background Grid Lines */}
                {[100, 110, 125, 150, 175, 200].map((val) => {
                  const y = getY(val);
                  return (
                    <g key={val}>
                      <line
                        x1={padding.left}
                        y1={y}
                        x2={svgWidth - padding.right}
                        y2={y}
                        stroke="currentColor"
                        className="text-hairline"
                        strokeDasharray={val === 110 ? '4 3' : '2 2'}
                        strokeWidth={val === 110 ? '1.5' : '1'}
                      />
                      <text
                        x={padding.left - 8}
                        y={y + 3}
                        textAnchor="end"
                        className="fill-ink-muted text-[10px]"
                      >
                        {val}%
                      </text>
                    </g>
                  );
                })}

                {/* X Axis Ticks */}
                {[0, 10, 20, 30, 40, 50, 60].map((pct) => {
                  const x = getX(pct);
                  return (
                    <g key={pct}>
                      <line
                        x1={x}
                        y1={svgHeight - padding.bottom}
                        x2={x}
                        y2={svgHeight - padding.bottom + 4}
                        stroke="currentColor"
                        className="text-hairline-strong"
                      />
                      <text
                        x={x}
                        y={svgHeight - padding.bottom + 16}
                        textAnchor="middle"
                        className="fill-ink-muted text-[10px]"
                      >
                        -{pct}%
                      </text>
                    </g>
                  );
                })}

                {/* Reference Lines Labels */}
                <text
                  x={svgWidth - padding.right - 4}
                  y={mcrY - 4}
                  textAnchor="end"
                  className="fill-danger text-[9px] font-bold"
                >
                  110% MCR Liquidation Floor
                </text>

                <text
                  x={svgWidth - padding.right - 4}
                  y={triggerY - 4}
                  textAnchor="end"
                  className="fill-watch text-[9px] font-bold"
                >
                  {rule.triggerPercent || 125}% Trigger Waterline
                </text>

                <text
                  x={svgWidth - padding.right - 4}
                  y={targetY - 4}
                  textAnchor="end"
                  className="fill-safe text-[9px] font-bold"
                >
                  {rule.targetPercent || 150}% Target Waterline
                </text>

                {/* Vertical Cursor at Current Selected Price Drop */}
                <line
                  x1={currentDropX}
                  y1={padding.top}
                  x2={currentDropX}
                  y2={svgHeight - padding.bottom}
                  stroke="#DE542B"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Unprotected Curve (Red dotted line) */}
                <path
                  d={unprotectedPath}
                  fill="none"
                  stroke="#DE542B"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.8"
                />

                {/* Protected Curve (Solid Emerald / Ember with stepped defense jumps) */}
                <path
                  d={protectedPath}
                  fill="none"
                  stroke="#2E7D32"
                  strokeWidth="2.5"
                />

                {/* Current Dot on Protected Curve */}
                {currentPoint && (
                  <circle
                    cx={currentDropX}
                    cy={getY(Number((currentPoint.protectedICR * 10000n) / PRECISION) / 100)}
                    r="5"
                    fill="#2E7D32"
                    stroke="#F7F6F2"
                    strokeWidth="2"
                  />
                )}
              </svg>
            </div>

            {/* Chart Legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-mono pt-2 border-t border-hairline">
              <div className="flex items-center gap-2">
                <span className="w-4 h-0.5 bg-danger border-t border-dashed border-danger" />
                <span className="text-ink-muted">Without Ballast (Unprotected)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-safe" />
                <span className="font-semibold text-ink">With Ballast Autonomous Defense</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-ember" />
                <span className="text-ink-muted">Current Slider Shock (-{priceDropPercent}%)</span>
              </div>
            </div>
          </div>
        ) : (
          /* Data Table Alternative for Accessibility and Exact Numbers */
          <div className="overflow-x-auto">
            <Table
              columns={[
                { key: 'drop', header: 'Shock' },
                { key: 'price', header: 'BTC Price' },
                { key: 'unprotected', header: 'Unprotected ICR' },
                { key: 'protected', header: 'Protected ICR' },
                { key: 'liq', header: 'Liquidation Status' },
                { key: 'reserves', header: 'Remaining Reserves' },
                { key: 'risk', header: 'Redemption Exposure' },
              ]}
              data={chartPoints
                .filter((_, idx) => idx % 5 === 0 || idx === priceDropPercent)
                .map((p, idx) => ({
                  id: idx.toString(),
                  drop: <span className="font-bold text-ink">-{p.dropPercent}%</span>,
                  price: `$${(Number(p.price) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                  unprotected: (
                    <span
                      className={
                        p.isLiquidatedUnprotected
                          ? 'text-danger font-bold'
                          : 'text-ink-muted'
                      }
                    >
                      {(Number((p.unprotectedICR * 10000n) / PRECISION) / 100).toFixed(1)}%
                    </span>
                  ),
                  protected: (
                    <span
                      className={
                        p.isLiquidatedProtected
                          ? 'text-danger font-bold'
                          : 'text-safe font-semibold'
                      }
                    >
                      {(Number((p.protectedICR * 10000n) / PRECISION) / 100).toFixed(1)}%
                    </span>
                  ),
                  liq: p.isLiquidatedProtected ? (
                    <span className="text-danger font-bold uppercase">Liquidated</span>
                  ) : p.isDefended ? (
                    <span className="text-ember font-semibold">Defended</span>
                  ) : (
                    <span className="text-safe">Solvent</span>
                  ),
                  reserves: `${Number(formatEther(p.remainingMusdReserve)).toFixed(0)} MUSD | ${Number(formatEther(p.remainingBtcReserve)).toFixed(3)} BTC`,
                  risk: p.redemptionRisk.toUpperCase(),
                }))}
            />
          </div>
        )}
      </div>

      {/* Step-by-Step Defense Execution Sequence */}
      <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
        <div className="border-b border-hairline pb-3">
          <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
            Step-by-Step Defense Sequence
          </h3>
          <p className="text-[11px] font-mono text-ink-muted">
            The exact sequence of permissionless defense calls executed as price drops toward -{priceDropPercent}%
          </p>
        </div>

        {!simResult || simResult.defenseSteps.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-ink-muted">
            No defenses triggered yet. Position ICR remains above the {rule.triggerPercent?.toFixed(0) || '125'}% trigger threshold down to this shock level.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={[
                { key: 'step', header: 'Step #' },
                { key: 'price', header: 'Trigger Price' },
                { key: 'icrBefore', header: 'ICR Before' },
                { key: 'action', header: 'Repayment & Collateral' },
                { key: 'icrAfter', header: 'ICR After' },
                { key: 'reserves', header: 'Remaining Reserves' },
              ]}
              data={simResult.defenseSteps.map((step) => ({
                id: step.stepIndex.toString(),
                step: <span className="font-bold text-ink">Step {step.stepIndex}</span>,
                price: (
                  <span className="font-mono tabular-nums">
                    ${(Number(step.price) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })} (-{step.dropPercent}%)
                  </span>
                ),
                icrBefore: (
                  <span className="font-mono text-watch tabular-nums">
                    {(Number((step.icrBefore * 10000n) / PRECISION) / 100).toFixed(1)}%
                  </span>
                ),
                action: (
                  <span className="font-mono text-xs text-ink font-semibold">
                    {step.musdRepaid > 0n && `Repay ${Number(formatEther(step.musdRepaid)).toFixed(1)} MUSD`}
                    {step.musdRepaid > 0n && step.btcAdded > 0n && ' + '}
                    {step.btcAdded > 0n && `Add ${Number(formatEther(step.btcAdded)).toFixed(4)} BTC`}
                  </span>
                ),
                icrAfter: (
                  <span className="font-mono text-safe font-bold tabular-nums">
                    {(Number((step.icrAfter * 10000n) / PRECISION) / 100).toFixed(1)}%
                  </span>
                ),
                reserves: (
                  <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {Number(formatEther(step.remainingMusdReserve)).toFixed(0)} MUSD | {Number(formatEther(step.remainingBtcReserve)).toFixed(4)} BTC
                  </span>
                ),
              }))}
            />
          </div>
        )}
      </div>

      {/* Mandatory Projection Notice */}
      <div className="p-4 bg-paper-surface border border-hairline rounded-sm flex items-start gap-3 text-xs font-mono text-ink-muted leading-relaxed">
        <Info className="w-4 h-4 text-ember shrink-0 mt-0.5" />
        <div>
          <span className="font-bold uppercase text-ink">Strict Transparency Disclaimer:</span>
          <p className="mt-0.5">
            Every trajectory, defense step, and survival floor displayed above is a pure mathematical projection computed directly from active on-chain ledger state (Block #{blockNumber?.toString() || '—'}) and your pre-configured BallastVault rule parameters. These outputs represent algorithmic simulation under defined inputs, not a prediction or financial guarantee of future market behavior.
          </p>
        </div>
      </div>
    </div>
  );
}
