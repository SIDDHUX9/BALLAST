'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '../components/layout/header';
import { Footer } from '../components/layout/footer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Slider } from '../components/ui/slider';
import { Stat } from '../components/ui/stat';
import { DataRow } from '../components/ui/data-row';
import { StatusBadge } from '../components/ui/status-badge';
import { HealthGauge } from '../components/ui/health-gauge';
import { TooltipProvider } from '../components/ui/tooltip';
import {
  computeICR,
  computeLiquidationPrice,
  computeRepayNeeded,
  computeCollateralNeeded,
  PROTOCOL_CONSTANTS,
} from '@ballast/shared';
import {
  ShieldAlert,
  ArrowRight,
  Sliders,
  Coins,
  Bot,
  AlertTriangle,
  Scale,
  Clock,
  Compass,
} from 'lucide-react';

export default function LandingPage() {
  // Interactive Calculator State (User-driven, strictly no fake mock data)
  const [collateralBtc, setCollateralBtc] = useState('2.0');
  const [btcPriceUsd, setBtcPriceUsd] = useState('68000');
  const [debtMusd, setDebtMusd] = useState('60000');
  const [triggerRatio, setTriggerRatio] = useState([135]);
  const [targetRatio, setTargetRatio] = useState([180]);

  // Derived pure math calculations
  const collNum = parseFloat(collateralBtc) || 0;
  const priceNum = parseFloat(btcPriceUsd) || 0;
  const debtNum = parseFloat(debtMusd) || 0;

  const collWei = BigInt(Math.floor(collNum * 1e18));
  const priceWei = BigInt(Math.floor(priceNum * 1e18));
  const debtWei = BigInt(Math.floor(debtNum * 1e18));

  const icrRatio = debtWei > 0n && priceWei > 0n ? computeICR(collWei, debtWei, priceWei) : 0n;
  const icrPercent = Number(icrRatio) / 1e16; // 1e18 to percent

  const liqPriceWei =
    collWei > 0n && debtWei > 0n
      ? computeLiquidationPrice(collWei, debtWei, PROTOCOL_CONSTANTS.MCR)
      : 0n;
  const liqPriceUsd = Number(liqPriceWei) / 1e18;

  const targetRatioWei = BigInt(targetRatio[0]) * 10n ** 16n;
  const minNetDebt = PROTOCOL_CONSTANTS.MIN_NET_DEBT_DEFAULT;
  const maxAvailableReserve = 10n ** 30n; // Uncapped for simulation calculator

  const repayResult =
    icrRatio > 0n && icrRatio < targetRatioWei
      ? computeRepayNeeded(
          collWei,
          debtWei,
          priceWei,
          targetRatioWei,
          minNetDebt,
          maxAvailableReserve,
        )
      : { musdToRepay: 0n, remainingDebt: debtWei };
  const repayNeededUsd = Number(repayResult.musdToRepay) / 1e18;

  const collNeededWei =
    icrRatio > 0n && icrRatio < targetRatioWei
      ? computeCollateralNeeded(
          collWei,
          repayResult.remainingDebt,
          priceWei,
          targetRatioWei,
          maxAvailableReserve,
        )
      : 0n;
  const collNeededBtc = Number(collNeededWei) / 1e18;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans selection:bg-ember selection:text-paper-raised">
        <Header />

        <main className="grow">
          {/* Editorial Hero Section */}
          <section className="border-b border-hairline py-16 md:py-24">
            <div className="max-w-container mx-auto px-4 md:px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                {/* Left 7 Columns: Editorial Headline and Positioning */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-mono border border-hairline bg-paper-surface rounded-sm text-ink-muted">
                    <span className="w-1.5 h-1.5 rounded-full bg-safe" />
                    <span>Mezo MUSD Autonomous Defense</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-bold tracking-tight text-ink leading-[1.1]">
                    Keep your Bitcoin trove above the waterline.
                  </h1>

                  <p className="text-base sm:text-lg font-sans text-ink-soft leading-relaxed max-w-xl">
                    Borrowing MUSD against native Bitcoin on Mezo opens troves to two persistent
                    risks: liquidation during market flash crashes, and redemption by third parties
                    when sitting near the bottom of the ledger.
                  </p>

                  <p className="text-sm font-sans text-ink-muted leading-relaxed max-w-xl">
                    Ballast is an immutable, non-custodial defense vault. You maintain a pre-funded
                    reserve; autonomous keepers deploy it the moment your collateral ratio falls
                    below your configured trigger.
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-4">
                    <Link href="/app">
                      <Button
                        size="lg"
                        variant="primary"
                        icon={<ArrowRight className="w-4 h-4 stroke-[1.5]" />}
                      >
                        Launch Borrower App
                      </Button>
                    </Link>
                    <a href="#calculator">
                      <Button
                        size="lg"
                        variant="secondary"
                        icon={<Sliders className="w-4 h-4 stroke-[1.5]" />}
                      >
                        Simulate Waterline
                      </Button>
                    </a>
                  </div>

                  {/* Operational Guarantees Ledger */}
                  <div className="pt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-hairline text-xs font-mono text-ink-muted">
                    <div>
                      <span className="block text-ink font-semibold">EIP-1167</span>
                      <span>Minimal proxy per user</span>
                    </div>
                    <div>
                      <span className="block text-ink font-semibold">0% Protocol Fee</span>
                      <span>100% autonomous code</span>
                    </div>
                    <div>
                      <span className="block text-ink font-semibold">Zero Admin Keys</span>
                      <span>Immutable & unpauseable</span>
                    </div>
                  </div>
                </div>

                {/* Right 5 Columns: Live Waterline Instrument Panel */}
                <div className="lg:col-span-5 border border-hairline bg-paper-raised p-6 rounded-sm space-y-6">
                  <div className="flex items-center justify-between border-b border-hairline pb-3">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-ember stroke-[1.5]" />
                      <span className="text-xs font-mono uppercase tracking-wider font-semibold text-ink">
                        Instrument Architecture
                      </span>
                    </div>
                    <StatusBadge status="Armed" label="STANDBY" />
                  </div>

                  {/* Instrument Gauge Preview */}
                  <div>
                    <span className="text-xs font-mono text-ink-muted uppercase block mb-2">
                      Sample Trove Waterline (Simulated)
                    </span>
                    <HealthGauge current={165} trigger={135} target={180} />
                  </div>

                  {/* Ledger Metrics */}
                  <div className="space-y-1 text-xs">
                    <DataRow
                      label="Mezo Minimum Ratio (MCR)"
                      value="110%"
                      hint="Hard liquidation floor"
                    />
                    <DataRow
                      label="Mezo Critical Ratio (CCR)"
                      value="150%"
                      hint="Recovery mode boundary"
                    />
                    <DataRow
                      label="Default Min Net Debt"
                      value="1,800 MUSD"
                      hint="Protocol constraint"
                    />
                    <DataRow
                      label="Liquidation Gas Reserve"
                      value="200 MUSD"
                      hint="Refunded upon closure"
                    />
                  </div>

                  <div className="p-3 bg-paper border border-hairline rounded-sm text-xs font-mono text-ink-muted">
                    <span className="text-ember font-semibold mr-1.5">•</span>
                    No wallet connection required to simulate formulas. All calculations are
                    executed locally via verified protocol math.
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: The Two Inherent Threats */}
          <section className="border-b border-hairline py-16 bg-paper-raised/40">
            <div className="max-w-container mx-auto px-4 md:px-6">
              <div className="max-w-2xl mb-12">
                <span className="text-xs font-mono uppercase tracking-wider text-ink-muted block mb-2">
                  Systemic Vulnerabilities
                </span>
                <h2 className="text-3xl font-serif font-bold text-ink">
                  The Two Inherent Threats Facing Every MUSD Trove
                </h2>
                <p className="text-sm font-sans text-ink-muted mt-2">
                  Borrowing against Bitcoin is volatile. Understanding how the Mezo protocol
                  executes liquidations and redemptions explains why manual rebalancing fails during
                  market stress.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Threat 1: Liquidation */}
                <div className="p-6 border border-hairline bg-paper-raised rounded-sm space-y-4">
                  <div className="w-10 h-10 rounded-sm bg-danger/10 border border-danger/30 flex items-center justify-center text-danger">
                    <AlertTriangle className="w-5 h-5 stroke-[1.5]" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-mono uppercase tracking-wider text-danger font-semibold">
                      Threat 1: Hard Liquidation Below 110%
                    </span>
                    <h3 className="text-xl font-serif font-semibold text-ink">
                      Sudden Volatility Wipes Out Positions
                    </h3>
                  </div>

                  <p className="text-sm font-sans text-ink-soft leading-relaxed">
                    When Bitcoin drops and your individual collateral ratio (ICR) slips under 110%,
                    any network participant can trigger liquidation. Your entire collateral is
                    seized, distributed to the Stability Pool or redistributed to other troves, and
                    you forfeit the 200 MUSD liquidation reserve.
                  </p>

                  <div className="pt-3 border-t border-hairline text-xs font-mono text-ink-muted">
                    <span>Vulnerability: </span>
                    <span className="text-ink">
                      Block congestion and sleep prevent manual top-ups.
                    </span>
                  </div>
                </div>

                {/* Threat 2: Redemption */}
                <div className="p-6 border border-hairline bg-paper-raised rounded-sm space-y-4">
                  <div className="w-10 h-10 rounded-sm bg-watch/10 border border-watch/30 flex items-center justify-center text-watch">
                    <Scale className="w-5 h-5 stroke-[1.5]" />
                  </div>

                  <div className="space-y-1">
                    <span className="text-xs font-mono uppercase tracking-wider text-watch font-semibold">
                      Threat 2: Unsolicited Collateral Redemption
                    </span>
                    <h3 className="text-xl font-serif font-semibold text-ink">
                      Bottom-of-the-Ledger Troves Siphon First
                    </h3>
                  </div>

                  <p className="text-sm font-sans text-ink-soft leading-relaxed">
                    Any MUSD holder can redeem stablecoins at face value for native Bitcoin. The
                    Mezo SortedTroves contract queues troves strictly by collateral ratio.
                    Redemptions systematically strip Bitcoin from the troves with the lowest ICR
                    first—even if they are solvent and far above 110%.
                  </p>

                  <div className="pt-3 border-t border-hairline text-xs font-mono text-ink-muted">
                    <span>Vulnerability: </span>
                    <span className="text-ink">
                      You lose your Bitcoin upside at par when sitting at the tail.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: How Ballast Works (3-Step Mechanics) */}
          <section id="how-it-works" className="border-b border-hairline py-16">
            <div className="max-w-container mx-auto px-4 md:px-6">
              <div className="max-w-2xl mb-12">
                <span className="text-xs font-mono uppercase tracking-wider text-ink-muted block mb-2">
                  Protocol Mechanics
                </span>
                <h2 className="text-3xl font-serif font-bold text-ink">
                  How Ballast Guards Your Trove
                </h2>
                <p className="text-sm font-sans text-ink-muted mt-2">
                  A self-contained proxy vault that acts on your behalf without custodial
                  intermediaries.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Step 1 */}
                <div className="p-6 border border-hairline bg-paper-raised rounded-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-sm bg-ink text-paper-raised">
                        STEP 01
                      </span>
                      <Sliders className="w-4 h-4 text-ink-muted stroke-[1.5]" />
                    </div>
                    <h3 className="text-lg font-serif font-semibold text-ink">
                      Configure Trigger & Target
                    </h3>
                    <p className="text-xs font-sans text-ink-soft leading-relaxed">
                      Define a defense trigger (e.g., 135% ICR) safely above liquidation and
                      redemption queues, alongside a restoration target (e.g., 180% ICR). Set a
                      capped keeper bounty tip ($\le 100$ bps).
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted pt-3 border-t border-hairline">
                    Stored on-chain in your BallastVault Rule struct
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-6 border border-hairline bg-paper-raised rounded-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-sm bg-ink text-paper-raised">
                        STEP 02
                      </span>
                      <Coins className="w-4 h-4 text-ink-muted stroke-[1.5]" />
                    </div>
                    <h3 className="text-lg font-serif font-semibold text-ink">
                      Pre-fund Defense Reserves
                    </h3>
                    <p className="text-xs font-sans text-ink-soft leading-relaxed">
                      Deposit MUSD debt repayment funds or native BTC collateral into your vault.
                      Funds remain completely in your custody and can be topped up or withdrawn
                      whenever your trove is healthy.
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted pt-3 border-t border-hairline">
                    Explicit reserve tracking; non-reserve tokens sweepable
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-6 border border-hairline bg-paper-raised rounded-sm space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-sm bg-ink text-paper-raised">
                        STEP 03
                      </span>
                      <Bot className="w-4 h-4 text-ink-muted stroke-[1.5]" />
                    </div>
                    <h3 className="text-lg font-serif font-semibold text-ink">
                      Autonomous Keeper Execution
                    </h3>
                    <p className="text-xs font-sans text-ink-soft leading-relaxed">
                      When Bitcoin volatility pushes your ICR below the trigger, any permissionless
                      keeper bot calls defend(). The vault atomically repays debt or adds
                      collateral, elevating your trove back to safety.
                    </p>
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted pt-3 border-t border-hairline">
                    Keeper receives tip directly from execution
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: Interactive Waterline Calculator */}
          <section id="calculator" className="border-b border-hairline py-16 bg-paper-raised/30">
            <div className="max-w-container mx-auto px-4 md:px-6">
              <div className="max-w-2xl mb-10">
                <span className="text-xs font-mono uppercase tracking-wider text-ink-muted block mb-2">
                  Client-Side Simulation
                </span>
                <h2 className="text-3xl font-serif font-bold text-ink">
                  Interactive Waterline Calculator
                </h2>
                <p className="text-sm font-sans text-ink-muted mt-2">
                  Enter your prospective Bitcoin position and debt to calculate your true collateral
                  ratio, liquidation price, and reserve requirements. Driven entirely by your inputs
                  and protocol constants.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Inputs: 5 Columns */}
                <div className="lg:col-span-5 border border-hairline bg-paper-raised p-6 rounded-sm space-y-5">
                  <div className="flex items-center justify-between border-b border-hairline pb-3">
                    <span className="text-xs font-mono uppercase tracking-wider font-semibold text-ink">
                      Position Parameters
                    </span>
                    <span className="text-xs font-mono text-ink-muted">Inputs</span>
                  </div>

                  <Input
                    label="Bitcoin Collateral"
                    unit="BTC"
                    type="number"
                    step="0.1"
                    min="0"
                    value={collateralBtc}
                    onChange={(e) => setCollateralBtc(e.target.value)}
                    helperText="Total collateral locked in trove"
                  />

                  <Input
                    label="Live Bitcoin Price"
                    unit="USD"
                    type="number"
                    step="500"
                    min="1000"
                    value={btcPriceUsd}
                    onChange={(e) => setBtcPriceUsd(e.target.value)}
                    helperText="Simulate price dips or rallies"
                  />

                  <Input
                    label="Outstanding Debt"
                    unit="MUSD"
                    type="number"
                    step="1000"
                    min="0"
                    value={debtMusd}
                    onChange={(e) => setDebtMusd(e.target.value)}
                    helperText="Total debt including 200 MUSD gas reserve"
                  />

                  <div className="pt-3 border-t border-hairline">
                    <Slider
                      label="Defense Trigger"
                      value={triggerRatio}
                      onValueChange={setTriggerRatio}
                      min={115}
                      max={200}
                      unit="%"
                    />
                  </div>

                  <div>
                    <Slider
                      label="Restoration Target"
                      value={targetRatio}
                      onValueChange={setTargetRatio}
                      min={triggerRatio[0] + 5}
                      max={250}
                      unit="%"
                    />
                  </div>
                </div>

                {/* Outputs & Health Gauge: 7 Columns */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Health Gauge */}
                  <HealthGauge
                    current={icrPercent > 0 ? icrPercent : null}
                    trigger={triggerRatio[0]}
                    target={targetRatio[0]}
                  />

                  {/* Calculated Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Stat
                      label="Calculated ICR"
                      value={icrPercent > 0 ? `${icrPercent.toFixed(1)}%` : '—'}
                      tooltip="Current individual collateral ratio at entered values"
                    />
                    <Stat
                      label="Liquidation Floor"
                      value={
                        liqPriceUsd > 0
                          ? `$${liqPriceUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                          : '—'
                      }
                      unit="USD"
                      tooltip="Bitcoin price where ICR reaches 110% MCR"
                    />
                    <Stat
                      label="Target Deficit"
                      value={repayNeededUsd > 0 ? `${repayNeededUsd.toFixed(0)}` : '0'}
                      unit="MUSD"
                      tooltip="MUSD repayment needed if position falls to trigger"
                    />
                  </div>

                  {/* Defense Ledger Breakdown */}
                  <div className="p-5 border border-hairline bg-paper-raised rounded-sm">
                    <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink mb-3 pb-2 border-b border-hairline">
                      Automated Defense Math Breakdown
                    </h3>
                    <div className="space-y-1 text-xs">
                      <DataRow
                        label="Collateral Valuation"
                        value={`$${(collNum * priceNum).toLocaleString('en-US', { maximumFractionDigits: 2 })} USD`}
                        hint="Collateral * Price"
                      />
                      <DataRow
                        label="Safety Buffer Above MCR (110%)"
                        value={icrPercent > 110 ? `+${(icrPercent - 110).toFixed(1)}%` : 'AT RISK'}
                        badge={
                          <StatusBadge
                            status={
                              icrPercent > 150 ? 'Armed' : icrPercent > 110 ? 'Watch' : 'Danger'
                            }
                          />
                        }
                      />
                      <DataRow
                        label="Reserve Needed to Reach Target"
                        value={
                          repayNeededUsd > 0
                            ? `${repayNeededUsd.toFixed(2)} MUSD or ${collNeededBtc.toFixed(4)} BTC`
                            : 'Already Above Target Waterline'
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section: What Ballast Cannot Do (Radical Honesty) */}
          <section id="honesty" className="border-b border-hairline py-16">
            <div className="max-w-container mx-auto px-4 md:px-6">
              <div className="max-w-2xl mb-12">
                <span className="text-xs font-mono uppercase tracking-wider text-danger font-semibold block mb-2">
                  Risk Disclosure & Boundaries
                </span>
                <h2 className="text-3xl font-serif font-bold text-ink">What Ballast Cannot Do</h2>
                <p className="text-sm font-sans text-ink-muted mt-2">
                  No automated protocol can eliminate all systemic risk. We do not invent
                  guarantees. These are the absolute architectural boundaries of the system.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 border border-hairline bg-paper-raised rounded-sm space-y-2">
                  <h3 className="flex items-center gap-2 text-ink font-serif font-semibold text-base">
                    <ShieldAlert className="w-4 h-4 text-danger stroke-[1.5]" />
                    <span>Cannot Defend an Exhausted Reserve</span>
                  </h3>
                  <p className="text-xs font-sans text-ink-soft leading-relaxed">
                    Ballast only executes defense actions using funds pre-funded in your vault
                    reserve. If Bitcoin crashes so severely that your entire reserve is consumed,
                    Ballast cannot conjure capital from nowhere. You must monitor and replenish
                    reserves.
                  </p>
                </div>

                <div className="p-5 border border-hairline bg-paper-raised rounded-sm space-y-2">
                  <h3 className="flex items-center gap-2 text-ink font-serif font-semibold text-base">
                    <Scale className="w-4 h-4 text-danger stroke-[1.5]" />
                    <span>Cannot Prevent Massive Protocol Redemptions</span>
                  </h3>
                  <p className="text-xs font-sans text-ink-soft leading-relaxed">
                    Setting your target ICR elevated keeps you higher up the SortedTroves queue than
                    unmanaged troves. However, if a massive whale redemption clears hundreds of
                    troves down the ledger, any trove can eventually be redeemed against.
                  </p>
                </div>

                <div className="p-5 border border-hairline bg-paper-raised rounded-sm space-y-2">
                  <h3 className="flex items-center gap-2 text-ink font-serif font-semibold text-base">
                    <Clock className="w-4 h-4 text-danger stroke-[1.5]" />
                    <span>Cannot Guarantee Execution During Network Halt</span>
                  </h3>
                  <p className="text-xs font-sans text-ink-soft leading-relaxed">
                    If the underlying blockchain halts block production, if RPC providers experience
                    outages, or if the Pyth oracle feed becomes stale or unresponsive, keeper
                    transactions cannot settle. Execution relies on chain liveness.
                  </p>
                </div>

                <div className="p-5 border border-hairline bg-paper-raised rounded-sm space-y-2">
                  <h3 className="flex items-center gap-2 text-ink font-serif font-semibold text-base">
                    <AlertTriangle className="w-4 h-4 text-danger stroke-[1.5]" />
                    <span>Cannot Violate Mezo minNetDebt Rules</span>
                  </h3>
                  <p className="text-xs font-sans text-ink-soft leading-relaxed">
                    The Mezo MUSD protocol prohibits any trove debt from existing between 0 and
                    1,800 MUSD. Ballast contracts will intentionally clamp repayments to preserve at
                    least 1,800 MUSD net debt, or pivot toward collateral additions.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Call to Action Bar */}
          <section className="py-16 bg-paper">
            <div className="max-w-container mx-auto px-4 md:px-6 text-center space-y-6">
              <h2 className="text-3xl sm:text-4xl font-serif font-bold text-ink">
                Ready to secure your MUSD position?
              </h2>
              <p className="text-sm font-sans text-ink-muted max-w-md mx-auto">
                Deploy your personal EIP-1167 proxy vault, configure safety thresholds, and keep
                your Bitcoin above the waterline.
              </p>
              <div className="flex justify-center gap-4 pt-2">
                <Link href="/app">
                  <Button size="lg" variant="primary">
                    Enter Borrower App
                  </Button>
                </Link>
                <Link href="/whitepaper">
                  <Button size="lg" variant="secondary">
                    Read Whitepaper
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </TooltipProvider>
  );
}
