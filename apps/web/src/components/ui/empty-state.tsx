'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center border border-hairline border-dashed rounded-sm bg-paper-raised/50 ${className}`}
    >
      <div className="text-ink-muted mb-3 p-3 bg-paper rounded border border-hairline">
        {icon || <ShieldAlert className="w-6 h-6 stroke-[1.5]" />}
      </div>
      <h4 className="text-base font-serif font-semibold text-ink mb-1">{title}</h4>
      <p className="text-xs font-mono text-ink-muted max-w-sm mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}
