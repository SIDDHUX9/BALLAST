'use client';

import React from 'react';
import Link from 'next/link';
import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_DESCRIPTION,
  BRAND_URLS,
  MATSNET_PROTOCOL_ADDRESSES,
} from '@ballast/shared';
import { MATSNET_DEPLOYMENT } from '../../lib/deployment';
import { ExternalLink, Terminal, ShieldCheck } from 'lucide-react';
import { AddressChip } from '../ui/address-chip';
import { MezoBadge } from '../ui/mezo-badge';

export function Footer() {
  const contracts = [
    {
      name: 'BallastFactory',
      role: 'Deterministic Proxy Factory',
      address: MATSNET_DEPLOYMENT.ballastFactory,
      isMezo: false,
    },
    {
      name: 'BallastVault Impl',
      role: 'Keeper Defense Logic Master',
      address: MATSNET_DEPLOYMENT.ballastVaultImplementation,
      isMezo: false,
    },
    {
      name: 'BorrowerOperations',
      role: 'Trove Engine & Adjustments',
      address: MATSNET_PROTOCOL_ADDRESSES.borrowerOperations,
      isMezo: true,
    },
    {
      name: 'TroveManager',
      role: 'Accounting & Liquidations',
      address: MATSNET_PROTOCOL_ADDRESSES.troveManager,
      isMezo: true,
    },
    {
      name: 'PriceFeed',
      role: 'BTC/USD Oracle Anchor',
      address: MATSNET_PROTOCOL_ADDRESSES.priceFeed,
      isMezo: true,
    },
    {
      name: 'MUSD Token',
      role: 'Canonical Stablecoin ERC-20',
      address: MATSNET_PROTOCOL_ADDRESSES.musd,
      isMezo: true,
    },

  ];

  return (
    <footer className="border-t border-hairline bg-paper-raised transition-colors mt-20">
      <div className="max-w-container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Col 1: Identity */}
          <div className="md:col-span-2 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="font-serif font-bold text-base text-ink tracking-tight">
                {BRAND_NAME}
              </span>
              <span className="text-xs font-mono text-ink-muted">/</span>
              <span className="text-xs font-mono text-ink-muted">{BRAND_TAGLINE}</span>
            </div>
            <p className="text-xs font-sans text-ink-muted leading-relaxed max-w-md">
              {BRAND_DESCRIPTION}
            </p>
            <div className="flex items-center gap-2 text-[11px] font-mono text-ink-muted mt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-safe stroke-[1.5]" />
              <span>Non-custodial, minimal proxy architecture. Zero admin keys.</span>
            </div>
          </div>

          {/* Col 2: Protocol Links */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink mb-1">
              Mezo Protocol
            </span>
            <a
              href={BRAND_URLS.mezoDocs}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-ink-muted hover:text-ink flex items-center gap-1 transition-colors"
            >
              <span>Developer Docs</span>
              <ExternalLink className="w-3 h-3 stroke-[1.5]" />
            </a>
            <a
              href={BRAND_URLS.mezoExplorer}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-ink-muted hover:text-ink flex items-center gap-1 transition-colors"
            >
              <span>Block Explorer</span>
              <ExternalLink className="w-3 h-3 stroke-[1.5]" />
            </a>
            <a
              href="https://github.com/mezo-org/musd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-ink-muted hover:text-ink flex items-center gap-1 transition-colors"
            >
              <span>MUSD Core Repository</span>
              <ExternalLink className="w-3 h-3 stroke-[1.5]" />
            </a>
          </div>

          {/* Col 3: Ballast System */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink mb-1">
              Ballast System
            </span>
            <a
              href={BRAND_URLS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-ink-muted hover:text-ink flex items-center gap-1 transition-colors"
            >
              <span>GitHub Source</span>
              <ExternalLink className="w-3 h-3 stroke-[1.5]" />
            </a>
            <Link
              href="/design"
              className="text-xs font-mono text-ink-muted hover:text-ink flex items-center gap-1 transition-colors"
            >
              <span>Design System Spec</span>
              <Terminal className="w-3 h-3 stroke-[1.5]" />
            </Link>
            <Link
              href="/app"
              className="text-xs font-mono text-ink-muted hover:text-ink transition-colors"
            >
              <span>Borrower App Shell</span>
            </Link>
          </div>
        </div>

        {/* Deployed On-Chain Contracts Strip */}
        <div className="border-t border-hairline pt-6 pb-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-ink">
                Verified Deployed Contracts (Mezo Matsnet Testnet 31611)
              </span>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="inline-flex items-center gap-1 text-ember font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-ember" />
                  <span>Official Mezo Protocol</span>
                </span>
                <span className="inline-flex items-center gap-1 text-safe font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-safe" />
                  <span>Ballast Guardian System</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
              {contracts.map((c) => (
                <div
                  key={c.name}
                  className={`flex flex-col justify-between gap-2 p-2.5 rounded-sm border transition-all ${c.isMezo
                      ? 'border-ember/30 bg-ember/[0.03] hover:border-ember/50'
                      : 'border-hairline bg-paper-surface hover:border-hairline-strong'
                    }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[11px] font-mono font-bold text-ink uppercase truncate">
                      {c.name}
                    </span>
                    {c.isMezo ? (
                      <MezoBadge size="xs" variant="pill" />
                    ) : (
                      <span
                        title="Ballast autonomous guardian contract deployed on Matsnet"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider bg-safe/10 text-safe border border-safe/25 shrink-0"
                      >
                        <Terminal className="w-2.5 h-2.5 stroke-[2]" />
                        Ballast Core
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-ink-muted truncate">
                    {c.role}
                  </span>

                  <AddressChip address={c.address} showCopy showExplorer size="sm" showMezoBadge={false} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Hairline & Legal/Ledger Strip */}
        <div className="border-t border-hairline pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-ink-muted">
          <div className="flex items-center gap-2">
            <span>© 2026 Ballast Protocol</span>
            <span>•</span>
            <span>MIT License</span>
            <span>•</span>
            <span className="tabular-nums">solc 0.8.24 london</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-safe" />
              <span>Mezo Matsnet Testnet (31611)</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
