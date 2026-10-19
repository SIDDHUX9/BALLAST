'use client';

import React from 'react';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { PiggyBank } from 'lucide-react';

export default function ReservePage() {
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
        action={
          <Button variant="primary" disabled>
            Connect Wallet
          </Button>
        }
      />
    </div>
  );
}
