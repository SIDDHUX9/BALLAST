'use client';

import React from 'react';
import { EmptyState } from '../../components/ui/empty-state';
import { Button } from '../../components/ui/button';
import { Wallet, ShieldCheck } from 'lucide-react';
import { HealthGauge } from '../../components/ui/health-gauge';
import { Stat } from '../../components/ui/stat';

export default function AppOverviewPage() {
  return (
    <div className="space-y-8">
      {/* Title & Network Status Strip */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Borrower Console
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Overview & Vault Status</h1>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-safe" />
          <span className="text-xs font-mono text-ink-muted">Mezo Matsnet • 31611</span>
        </div>
      </div>

      {/* Standby Gauges with Honest Empty State */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Stat
          label="Trove ICR"
          value={null}
          tooltip="Requires connected wallet to read TroveManager state"
        />
        <Stat label="Collateral Locked" value={null} unit="BTC" />
        <Stat label="Total Debt" value={null} unit="MUSD" />
        <Stat label="Defense Reserve" value={null} unit="MUSD" />
      </div>

      <div>
        <HealthGauge current={null} trigger={null} target={null} />
      </div>

      {/* Honest Wallet Connection Empty State (Rule 1 Compliant) */}
      <EmptyState
        icon={<Wallet className="w-6 h-6 stroke-[1.5]" />}
        title="Connect Mezo Wallet to View Position"
        description="Connect your browser wallet or hardware key to inspect your on-chain trove, manage defense thresholds, and fund your BallastVault reserve."
        action={
          <div className="flex items-center gap-3">
            <Button variant="primary" disabled title="Wallet connector will be activated in step 5">
              Connect Wallet
            </Button>
            <div className="text-xs font-mono text-ink-muted flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-safe" />
              <span>Read-only inspection available via RPC</span>
            </div>
          </div>
        }
      />
    </div>
  );
}
