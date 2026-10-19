'use client';

import React from 'react';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { Activity } from 'lucide-react';

export default function StressTestPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-hairline pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
          Volatility Simulation
        </span>
        <h1 className="text-2xl font-serif font-bold text-ink">
          Stress Testing & Shock Simulation
        </h1>
      </div>

      <EmptyState
        icon={<Activity className="w-6 h-6 stroke-[1.5]" />}
        title="Connect Wallet to Run Shock Simulations"
        description="Simulate sudden -20%, -35%, and -50% Bitcoin price drawdowns against your active trove and defense reserve."
        action={
          <Button variant="primary" disabled>
            Connect Wallet
          </Button>
        }
      />
    </div>
  );
}
