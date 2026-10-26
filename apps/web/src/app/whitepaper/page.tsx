'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BRAND_NAME,
  BRAND_URLS,
  MATSNET_PROTOCOL_ADDRESSES,
} from '@ballast/shared';
import { MATSNET_DEPLOYMENT } from '../../lib/deployment';
import { Header } from '../../components/layout/header';
import { Footer } from '../../components/layout/footer';
import { AddressChip } from '../../components/ui/address-chip';
import { MezoBadge } from '../../components/ui/mezo-badge';
import { Button } from '../../components/ui/button';
import {
  ShieldCheck,
  BookOpen,
  ExternalLink,
  ChevronRight,
  Code2,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Zap,
} from 'lucide-react';

export default function WhitepaperPage() {
  const [activeSection, setActiveSection] = useState('abstract');

  const sections = [
    { id: 'abstract', title: '1. Abstract & Thesis' },
    { id: 'problem', title: '2. Mezo MUSD Trove Dynamics' },
    { id: 'architecture', title: '3. System Architecture' },
    { id: 'mathematics', title: '4. Mathematical Formalization' },
    { id: 'security', title: '5. Security & Invariant Proofs' },
    { id: 'contracts', title: '6. Verified Contract Matrix' },
    { id: 'keeper-network', title: '7. Permissionless Keepers' },
    { id: 'conclusion', title: '8. Conclusion & Roadmap' },
  ];

  const scrollTo = (id: string) => {
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink selection:bg-ember/20 selection:text-ember">
      <Header />

      {/* Hero Header */}
      <div className="border-b border-hairline bg-paper-surface/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          {/* Logo & Category Badge */}
          <div className="flex items-center gap-3.5 mb-6">
            <Image
              src="/logo.png"
              alt="Ballast Logo"
              width={48}
              height={48}
              priority
              className="w-12 h-12 object-contain drop-shadow-sm"
            />
            <div>
              <span className="font-serif font-bold text-xl text-ink tracking-wider uppercase block leading-none">
                {BRAND_NAME}
              </span>
              <span className="text-[11px] font-mono text-ink-muted">AUTONOMOUS TROVE GUARDIAN</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-ember/10 text-ember border border-ember/20">
              <BookOpen className="w-3.5 h-3.5" />
              Protocol Whitepaper v1.0
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-paper-raised text-ink-muted border border-hairline">
              Mezo Matsnet (Chain ID 31611)
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-safe/10 text-safe border border-safe/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              Production Verified
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-ink tracking-tight mb-4">
            {BRAND_NAME}: Autonomous Liquidation & Redemption Defense Engine
          </h1>
          <p className="text-lg md:text-xl font-sans text-ink-muted max-w-3xl leading-relaxed mb-6">
            A non-custodial, deterministic reserve architecture on Mezo Network designed to protect
            Bitcoin-backed MUSD troves through automated waterline defense and permissionless keeper
            interventions.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-hairline text-xs font-mono text-ink-muted">
            <div>
              <span className="text-ink font-semibold">Author:</span> Ballast Core Protocol Team
            </div>
            <div>•</div>
            <div>
              <span className="text-ink font-semibold">Network:</span> Mezo Matsnet
            </div>
            <div>•</div>
            <div>
              <span className="text-ink font-semibold">Target Asset:</span> MUSD / Bitcoin (tBTC)
            </div>
            <div>•</div>
            <a
              href={BRAND_URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ember transition-colors inline-flex items-center gap-1 ml-auto"
            >
              <span>GitHub Repository</span>
              <ExternalLink className="w-3 h-3 stroke-[1.5]" />
            </a>
          </div>
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 w-full flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Sticky Table of Contents Sidebar */}
          <aside className="lg:col-span-3 hidden lg:block">
            <div className="sticky top-24 space-y-2 p-4 rounded-lg border border-hairline bg-paper-surface">
              <div className="text-xs font-mono font-semibold uppercase tracking-wider text-ink mb-3 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-ember" />
                <span>Contents</span>
              </div>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollTo(section.id)}
                    className={`w-full text-left px-3 py-2 rounded text-xs font-sans transition-colors flex items-center justify-between ${
                      activeSection === section.id
                        ? 'bg-ember/10 text-ember font-semibold'
                        : 'text-ink-muted hover:text-ink hover:bg-paper-raised'
                    }`}
                  >
                    <span>{section.title}</span>
                    {activeSection === section.id && <ChevronRight className="w-3 h-3" />}
                  </button>
                ))}
              </nav>

              <div className="pt-4 mt-4 border-t border-hairline space-y-2">
                <Link href="/app" className="block w-full">
                  <Button size="sm" variant="primary" className="w-full justify-center text-xs">
                    Launch Borrower App
                  </Button>
                </Link>
                <a
                  href="https://explorer.test.mezo.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full"
                >
                  <Button size="sm" variant="secondary" className="w-full justify-center text-xs gap-1.5">
                    <span>Mezo Explorer</span>
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </a>
              </div>
            </div>
          </aside>

          {/* Whitepaper Body */}
          <article className="lg:col-span-9 space-y-16 max-w-none text-ink leading-relaxed">
            {/* 1. Abstract */}
            <section id="abstract" className="space-y-4 scroll-mt-24">
              <div className="flex items-center gap-2 text-xs font-mono text-ember uppercase tracking-wider font-semibold">
                <span>01</span>
                <span>/</span>
                <span>Foundations</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">
                1. Abstract & Protocol Thesis
              </h2>
              <div className="p-5 rounded-lg border border-ember/20 bg-ember/5 text-sm md:text-base font-sans text-ink leading-relaxed">
                <strong>Abstract:</strong> Decentralized debt protocols backed by volatile collateral (such
                as Bitcoin on Mezo Network) subject borrowers to catastrophic tail-risk. Sudden market drawdowns
                trigger immediate 110% liquidations, while gradual contractions in secondary stablecoin demand
                expose the lowest-ICR troves to redemption arbitrage. Borrowers cannot remain awake 24/7 to
                manually defend their collateral. <strong>{BRAND_NAME}</strong> resolves this dilemma by
                introducing an autonomous, non-custodial defense engine. Borrowers establish a personal
                EIP-1167 proxy vault holding a pre-funded reserve. When on-chain Individual Collateral Ratio
                (ICR) breaches a customized safety waterline, any permissionless keeper can atomically execute
                a debt paydown or collateral injection to re-establish safe solvency, earning an incentivized
                tip without possessing custody of user funds.
              </div>
              <p className="text-sm md:text-base text-ink-muted">
                Mezo Network establishes an EVM-compatible Bitcoin economic layer. At its foundation lies{' '}
                <strong>MUSD</strong>, a decentralized stablecoin minted against native Bitcoin collateral
                via Liquity-derived Trove contracts. While this system offers unprecedented capital efficiency,
                the structural realities of Bitcoin volatility demand automated protective infrastructure.
              </p>
            </section>

            {/* 2. Mezo Dynamics */}
            <section id="problem" className="space-y-6 scroll-mt-24 border-t border-hairline pt-10">
              <div className="flex items-center gap-2 text-xs font-mono text-ember uppercase tracking-wider font-semibold">
                <span>02</span>
                <span>/</span>
                <span>System Mechanics</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">
                2. Mezo MUSD Trove Dynamics & The Borrower Dilemma
              </h2>

              <p className="text-sm md:text-base text-ink-muted">
                Each borrower on Mezo interacts with the core protocol by maintaining a <em>Trove</em>—a
                collateralized debt position holding BTC and issuing MUSD debt. Trove solvency is governed
                by the <strong>Individual Collateral Ratio (ICR)</strong>:
              </p>

              <div className="p-4 rounded-lg border border-hairline bg-paper-surface font-mono text-center text-sm md:text-base text-ink">
                ICR = (Collateral_BTC × OraclePrice_USD) / Debt_MUSD × 100%
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Mode 1: Normal Mode Liquidation (110% MCR)</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    If ICR falls below the Minimum Collateral Ratio of <strong>110%</strong>, any third party
                    can liquidate the trove. The borrower&apos;s collateral is seized by the Stability Pool,
                    resulting in a complete loss of the 10% collateral premium plus a liquidation penalty fee.
                  </p>
                </div>

                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-danger font-semibold text-sm">
                    <Zap className="w-4 h-4" />
                    <span>Mode 2: Recovery Mode (150% CCR)</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    If Total Collateral Ratio (TCR) across all system troves falls below <strong>150%</strong>,
                    the protocol enters Recovery Mode. In this state, any trove with an ICR under 150% is eligible
                    for immediate liquidation, drastically expanding the hazard zone.
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-3">
                <div className="flex items-center gap-2 text-ink font-semibold text-sm">
                  <Activity className="w-4 h-4 text-ember" />
                  <span>The Hidden Threat: SortedTroves Redemption Cascades</span>
                </div>
                <p className="text-xs md:text-sm text-ink-muted leading-relaxed">
                  Unlike typical lending protocols that only liquidate at MCR, Mezo allows anyone to redeem 1
                  MUSD for exactly $1 worth of Bitcoin collateral at face value. Redemptions do not pick troves
                  randomly: they walk the on-chain doubly linked list (<code className="font-mono text-ember">SortedTroves.sol</code>)
                  starting strictly from the lowest ICR trove. A borrower sitting at 120% ICR may be completely
                  safe from liquidation, yet have their precious Bitcoin redeemed away bit-by-bit during a stablecoin
                  peg deviation.
                </p>
              </div>
            </section>

            {/* 3. System Architecture */}
            <section id="architecture" className="space-y-6 scroll-mt-24 border-t border-hairline pt-10">
              <div className="flex items-center gap-2 text-xs font-mono text-ember uppercase tracking-wider font-semibold">
                <span>03</span>
                <span>/</span>
                <span>Architecture</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">
                3. System Architecture & Vault Topology
              </h2>

              <p className="text-sm md:text-base text-ink-muted">
                {BRAND_NAME} decomposes protective operations into deterministic, un-ruggable components:
              </p>

              <div className="space-y-4">
                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="w-6 h-6 rounded-full bg-ember/10 text-ember flex items-center justify-center font-mono text-xs">
                      1
                    </span>
                    <span>BallastFactory (Deterministic Proxy Deployer)</span>
                  </div>
                  <p className="text-xs md:text-sm text-ink-muted leading-relaxed">
                    The factory utilizes EIP-1167 minimal proxy cloning to deploy lightweight, low-gas
                    instances of <code className="font-mono text-ink">BallastVault</code> for each borrower.
                    Each proxy holds an immutable reference to the master implementation while maintaining
                    isolated state, user ownership, and custom rule configurations.
                  </p>
                </div>

                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="w-6 h-6 rounded-full bg-ember/10 text-ember flex items-center justify-center font-mono text-xs">
                      2
                    </span>
                    <span>BallastVault (Borrower-Owned Execution Cell)</span>
                  </div>
                  <p className="text-xs md:text-sm text-ink-muted leading-relaxed">
                    Holds the borrower&apos;s pre-funded reserve (MUSD or BTC). Only the borrower (the vault
                    owner) can withdraw funds or alter defense parameters. The contract exposes an open
                    external function <code className="font-mono text-ember">executeDefense(address borrower)</code>{' '}
                    which is gated by an on-chain ICR sanity check.
                  </p>
                </div>

                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <span className="w-6 h-6 rounded-full bg-ember/10 text-ember flex items-center justify-center font-mono text-xs">
                      3
                    </span>
                    <span>Autonomous Keepers & Convex Bot Service</span>
                  </div>
                  <p className="text-xs md:text-sm text-ink-muted leading-relaxed">
                    Off-chain keeper nodes continuously index the Mezo <code className="font-mono text-ink">SortedTroves</code>{' '}
                    contract. When a registered vault&apos;s trove ICR drops beneath its preconfigured trigger
                    (e.g., 130%), keepers submit a defense transaction. Simultaneously, our Convex cloud service
                    dispatches immediate push notifications via the Telegram bot webhook (<code className="font-mono text-ink">@BallastGuardBot</code>).
                  </p>
                </div>
              </div>

              {/* Execution Flow Diagram */}
              <div className="p-6 rounded-lg border border-hairline bg-paper-surface space-y-4">
                <div className="text-xs font-mono font-semibold uppercase tracking-wider text-ink flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-ember" />
                  <span>Atomic Defense Execution Pipeline</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center text-xs font-mono">
                  <div className="p-3 rounded border border-hairline bg-paper-raised">
                    <div className="text-ember font-bold mb-1">Step 1</div>
                    <div>Oracle Price Drop</div>
                    <div className="text-[10px] text-ink-muted mt-1">ICR &lt; Target Trigger</div>
                  </div>
                  <div className="p-3 rounded border border-hairline bg-paper-raised">
                    <div className="text-ember font-bold mb-1">Step 2</div>
                    <div>Keeper Detection</div>
                    <div className="text-[10px] text-ink-muted mt-1">Computes Hint Traversal</div>
                  </div>
                  <div className="p-3 rounded border border-hairline bg-paper-raised">
                    <div className="text-ember font-bold mb-1">Step 3</div>
                    <div>Atomic Paydown</div>
                    <div className="text-[10px] text-ink-muted mt-1">Calls BorrowerOperations</div>
                  </div>
                  <div className="p-3 rounded border border-hairline bg-paper-raised">
                    <div className="text-ember font-bold mb-1">Step 4</div>
                    <div>Solvency Restored</div>
                    <div className="text-[10px] text-ink-muted mt-1">ICR &gt; Safe Waterline</div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Mathematics */}
            <section id="mathematics" className="space-y-6 scroll-mt-24 border-t border-hairline pt-10">
              <div className="flex items-center gap-2 text-xs font-mono text-ember uppercase tracking-wider font-semibold">
                <span>04</span>
                <span>/</span>
                <span>Quantitative Mechanics</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">
                4. Mathematical Formalization & Waterline Calculations
              </h2>

              <p className="text-sm md:text-base text-ink-muted">
                {BRAND_NAME}&apos;s defense calculations are deterministic and verified against integer rounding
                in 18-decimal precision (<code className="font-mono text-ink">1e18</code>).
              </p>

              <div className="space-y-4">
                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-ember font-semibold">
                    Equation 1: Required Debt Repayment (ΔD)
                  </span>
                  <p className="text-xs md:text-sm text-ink-muted">
                    To elevate a degraded ICR (ICR_current) to a safe target waterline (τ_target),
                    the exact amount of debt ΔD that the vault must repay is given by:
                  </p>
                  <div className="p-4 rounded bg-paper-raised font-mono text-sm text-center text-ink overflow-x-auto">
                    ΔD = (D × τ_target - C × P) / τ_target
                  </div>
                  <p className="text-[11px] font-mono text-ink-muted">
                    Where: D = Current Trove Debt, C = Collateral in BTC, P = Current Oracle Price (USD/BTC),
                    τ_target = Desired Target Ratio (e.g., 1.40 for 140%).
                  </p>
                </div>

                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-ember font-semibold">
                    Equation 2: Maximum Price Drop Tolerance (Waterline Buffer)
                  </span>
                  <p className="text-xs md:text-sm text-ink-muted">
                    The percentage decline in Bitcoin price that a trove can absorb before breaching liquidation
                    ($MCR = 1.10$) is defined as:
                  </p>
                  <div className="p-4 rounded bg-paper-raised font-mono text-sm text-center text-ink overflow-x-auto">
                    Price_Drop_Tolerance = 1 - (MCR / ICR_current)
                  </div>
                  <p className="text-[11px] font-mono text-ink-muted">
                    Example: At 140% ICR, a borrower can withstand a 21.4% price shock before liquidation occurs.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. Security & Invariants */}
            <section id="security" className="space-y-6 scroll-mt-24 border-t border-hairline pt-10">
              <div className="flex items-center gap-2 text-xs font-mono text-ember uppercase tracking-wider font-semibold">
                <span>05</span>
                <span>/</span>
                <span>Security Assurance</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">
                5. Security Guarantees & Formal Invariant Proofs
              </h2>

              <p className="text-sm md:text-base text-ink-muted">
                Every line of smart contract code adhering to the Ballast standard complies with strict
                solidity invariants verified through Foundry fork testing:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-safe font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Invariant 1: Non-Custodial Isolation</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    A keeper executing defense <strong>never receives custody</strong> of user reserves. The
                    vault code is mathematically constrained to route MUSD or BTC exclusively to Mezo&apos;s
                    <code className="font-mono text-ink">BorrowerOperations</code> contract for the borrower&apos;s
                    trove address.
                  </p>
                </div>

                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-safe font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Invariant 2: Reentrancy & Ordering</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    All state transitions enforce the Checks-Effects-Interactions (CEI) paradigm and use
                    OpenZeppelin&apos;s battle-tested <code className="font-mono text-ink">ReentrancyGuard</code>.
                    Keeper execution is strictly blocked if the trove ICR is already above the trigger threshold.
                  </p>
                </div>

                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-safe font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Invariant 3: Bounded Keeper Tip</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    To prevent economic drain attacks, the keeper compensation fee is capped on-chain at an
                    absolute maximum threshold configured by the borrower during vault initialization.
                  </p>
                </div>

                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="flex items-center gap-2 text-safe font-semibold text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Invariant 4: Ground Truth Protocol Interfaces</span>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Zero mocks in production. All contract ABIs and interfaces map 1:1 to Mezo&apos;s official
                    mUSD protocol contracts deployed on Matsnet (Chain ID 31611).
                  </p>
                </div>
              </div>
            </section>

            {/* 6. Verified Contracts */}
            <section id="contracts" className="space-y-6 scroll-mt-24 border-t border-hairline pt-10">
              <div className="flex items-center gap-2 text-xs font-mono text-ember uppercase tracking-wider font-semibold">
                <span>06</span>
                <span>/</span>
                <span>On-Chain Matrix</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">
                6. Verified Contract Matrix (Mezo Matsnet)
              </h2>

              <p className="text-sm md:text-base text-ink-muted">
                The table below details all contracts involved in the Ballast defense engine. Official Mezo
                contracts are verified on-chain and badged accordingly:
              </p>

              <div className="overflow-x-auto rounded-lg border border-hairline bg-paper-surface">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-paper-raised border-b border-hairline text-ink font-semibold">
                    <tr>
                      <th className="py-3 px-4">Contract Name</th>
                      <th className="py-3 px-4">Role & Function</th>
                      <th className="py-3 px-4">Status / Badge</th>
                      <th className="py-3 px-4">Matsnet Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline text-ink-muted">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-ink">BallastFactory</td>
                      <td className="py-3 px-4">Deterministic Proxy Factory</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] text-ember font-bold">Ballast Core</span>
                      </td>
                      <td className="py-3 px-4">
                        <AddressChip address={MATSNET_DEPLOYMENT.ballastFactory} />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-ink">BallastVault Implementation</td>
                      <td className="py-3 px-4">Master Defense Execution Logic</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] text-ember font-bold">Ballast Core</span>
                      </td>
                      <td className="py-3 px-4">
                        <AddressChip address={MATSNET_DEPLOYMENT.ballastVaultImplementation} />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-ink">TroveManager</td>
                      <td className="py-3 px-4">Liquidations, Redemptions, ICR Query</td>
                      <td className="py-3 px-4">
                        <MezoBadge />
                      </td>
                      <td className="py-3 px-4">
                        <AddressChip address={MATSNET_PROTOCOL_ADDRESSES.troveManager} />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-ink">BorrowerOperations</td>
                      <td className="py-3 px-4">Collateral Top-up & Debt Repayment</td>
                      <td className="py-3 px-4">
                        <MezoBadge />
                      </td>
                      <td className="py-3 px-4">
                        <AddressChip address={MATSNET_PROTOCOL_ADDRESSES.borrowerOperations} />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-ink">SortedTroves</td>
                      <td className="py-3 px-4">Doubly Linked List of Solvency</td>
                      <td className="py-3 px-4">
                        <MezoBadge />
                      </td>
                      <td className="py-3 px-4">
                        <AddressChip address={MATSNET_PROTOCOL_ADDRESSES.sortedTroves} />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-ink">MUSD Token</td>
                      <td className="py-3 px-4">Bitcoin-backed Stablecoin</td>
                      <td className="py-3 px-4">
                        <MezoBadge />
                      </td>
                      <td className="py-3 px-4">
                        <AddressChip address={MATSNET_PROTOCOL_ADDRESSES.musd} />
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-ink">ActivePool</td>
                      <td className="py-3 px-4">Global Collateral & Debt Custodian</td>
                      <td className="py-3 px-4">
                        <MezoBadge />
                      </td>
                      <td className="py-3 px-4">
                        <AddressChip address={MATSNET_PROTOCOL_ADDRESSES.activePool} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* 7. Keeper Network */}
            <section id="keeper-network" className="space-y-6 scroll-mt-24 border-t border-hairline pt-10">
              <div className="flex items-center gap-2 text-xs font-mono text-ember uppercase tracking-wider font-semibold">
                <span>07</span>
                <span>/</span>
                <span>Incentive Design</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">
                7. Permissionless Keeper Economics
              </h2>

              <p className="text-sm md:text-base text-ink-muted">
                A defense protocol is only as reliable as its execution engine. {BRAND_NAME} implements a
                game-theoretically sound keeper ecosystem:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="text-xs font-mono text-ember font-semibold">01. Open Execution</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Any entity running the Ballast open-source keeper client can submit execution transactions.
                    No whitelisting, staking, or permission is required.
                  </p>
                </div>
                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="text-xs font-mono text-ember font-semibold">02. Predictable Bounties</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    The borrower sets a fixed keeper tip (e.g. 10–25 MUSD) that is paid out atomically upon
                    successful intervention, covering gas overhead with a guaranteed profit margin.
                  </p>
                </div>
                <div className="p-5 rounded-lg border border-hairline bg-paper-surface space-y-2">
                  <div className="text-xs font-mono text-ember font-semibold">03. Exact Hint Insertion</div>
                  <p className="text-xs text-ink-muted leading-relaxed">
                    Keepers compute off-chain hints for insertion into Mezo&apos;s <code className="font-mono text-ink">SortedTroves</code>{' '}
                    linked list, reducing on-chain gas costs to $O(1)$ complexity.
                  </p>
                </div>
              </div>
            </section>

            {/* 8. Conclusion */}
            <section id="conclusion" className="space-y-6 scroll-mt-24 border-t border-hairline pt-10">
              <div className="flex items-center gap-2 text-xs font-mono text-ember uppercase tracking-wider font-semibold">
                <span>08</span>
                <span>/</span>
                <span>Conclusion</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-ink">
                8. Conclusion & Future Roadmap
              </h2>

              <p className="text-sm md:text-base text-ink-muted leading-relaxed">
                By uncoupling the borrower&apos;s physical presence from the survival of their Bitcoin trove,{' '}
                <strong>{BRAND_NAME}</strong> transforms DeFi borrowing on Mezo Network from a high-stress,
                sleepless endeavor into an institutional-grade, set-and-forget financial primitive.
              </p>

              <div className="p-6 rounded-lg border border-hairline bg-paper-surface flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="font-serif font-bold text-lg text-ink">
                    Ready to protect your Mezo Bitcoin trove?
                  </h3>
                  <p className="text-xs text-ink-muted mt-1">
                    Deploy your personal non-custodial defense vault in less than 30 seconds.
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <Link href="/app">
                    <Button size="lg" variant="primary">
                      Launch App
                    </Button>
                  </Link>
                  <a href={BRAND_URLS.github} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" variant="secondary" className="gap-1">
                      <span>View Code</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              </div>
            </section>
          </article>
        </div>
      </div>

      <Footer />
    </div>
  );
}
