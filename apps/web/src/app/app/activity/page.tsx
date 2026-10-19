'use client';

import React from 'react';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { History } from 'lucide-react';

export default function ActivityPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-hairline pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
          On-Chain Ledger
        </span>
        <h1 className="text-2xl font-serif font-bold text-ink">
          Historical Activity & Keeper Audits
        </h1>
      </div>

      <EmptyState
        icon={<History className="w-6 h-6 stroke-[1.5]" />}
        title="No Activity Found"
        description="Connect your wallet to inspect past defense events, reserve adjustments, and borrower operations on Mezo."
        action={
          <Button variant="primary" disabled>
            Connect Wallet
          </Button>
        }
      />
    </div>
  );
}
