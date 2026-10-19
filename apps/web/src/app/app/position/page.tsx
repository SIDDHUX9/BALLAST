'use client';

import React from 'react';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { Coins } from 'lucide-react';
import { DataRow } from '../../../components/ui/data-row';

export default function PositionPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-hairline pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
          Trove Management
        </span>
        <h1 className="text-2xl font-serif font-bold text-ink">Collateral & Debt Position</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink border-b border-hairline pb-2">
            On-Chain Ledger State
          </h3>
          <DataRow label="Borrower Address" value="Disconnected" />
          <DataRow label="BallastVault Proxy" value="Unassigned" />
          <DataRow label="Collateral (BTC)" value="—" />
          <DataRow label="Net Debt (MUSD)" value="—" />
          <DataRow label="Liquidation Reserve" value="—" hint="200 MUSD Gas Comp" />
        </div>

        <EmptyState
          icon={<Coins className="w-6 h-6 stroke-[1.5]" />}
          title="No Position Loaded"
          description="Connect your wallet to inspect your active trove or adjust your locked Bitcoin collateral."
          action={
            <Button variant="primary" disabled>
              Connect Wallet
            </Button>
          }
        />
      </div>
    </div>
  );
}
