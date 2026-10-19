'use client';

import React from 'react';
import { EmptyState } from '../../../components/ui/empty-state';
import { Button } from '../../../components/ui/button';
import { Bell } from 'lucide-react';

export default function AlertsPage() {
  return (
    <div className="space-y-8">
      <div className="border-b border-hairline pb-4">
        <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
          Notifications & Keeper Triggers
        </span>
        <h1 className="text-2xl font-serif font-bold text-ink">
          Threshold Alerts & Telegram Dispatch
        </h1>
      </div>

      <EmptyState
        icon={<Bell className="w-6 h-6 stroke-[1.5]" />}
        title="Connect Wallet to Configure Alerts"
        description="Receive immediate Telegram or webhook notifications whenever your trove enters the watch band or keepers execute defense."
        action={
          <Button variant="primary" disabled>
            Connect Wallet
          </Button>
        }
      />
    </div>
  );
}
