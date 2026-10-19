'use client';

import React from 'react';

export interface DataRowProps {
  label: string;
  value: React.ReactNode;
  subValue?: string;
  badge?: React.ReactNode;
  hint?: string;
  className?: string;
}

export function DataRow({ label, value, subValue, badge, hint, className = '' }: DataRowProps) {
  return (
    <div
      className={`py-2.5 flex items-baseline justify-between text-xs font-mono group ${className}`}
    >
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-ink-muted uppercase tracking-wider">{label}</span>
        {hint && <span className="text-[10px] text-ink-muted/70 italic">({hint})</span>}
      </div>

      {/* Dotted ledger leader line */}
      <div className="grow mx-3 border-b border-dotted border-hairline/80 self-center" />

      <div className="flex items-baseline gap-2 shrink-0 text-right">
        {badge}
        <span className="font-medium text-ink tabular-nums">{value}</span>
        {subValue && <span className="text-[11px] text-ink-muted tabular-nums">({subValue})</span>}
      </div>
    </div>
  );
}
