'use client';

import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip } from './tooltip';

export interface StatProps {
  label: string;
  value?: string | number | null;
  unit?: string;
  hint?: string;
  delta?: {
    value: string;
    type: 'positive' | 'negative' | 'neutral';
  };
  tooltip?: string;
  loading?: boolean;
  className?: string;
}

export function Stat({
  label,
  value,
  unit,
  hint,
  delta,
  tooltip,
  loading = false,
  className = '',
}: StatProps) {
  return (
    <div
      className={`p-4 border border-hairline bg-paper-raised rounded-sm flex flex-col justify-between ${className}`}
    >
      <div className="flex items-center justify-between gap-1 mb-2">
        <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">{label}</span>
        {tooltip && (
          <Tooltip content={tooltip}>
            <button
              type="button"
              className="text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:text-ember"
              aria-label={`Info about ${label}`}
            >
              <HelpCircle className="w-3.5 h-3.5 stroke-[1.5]" />
            </button>
          </Tooltip>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        {loading ? (
          <div className="h-7 w-24 bg-hairline/40 animate-pulse rounded-sm" />
        ) : value !== undefined && value !== null ? (
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-semibold text-ink tabular-nums tracking-tight">
              {value}
            </span>
            {unit && <span className="text-xs font-mono text-ink-muted uppercase">{unit}</span>}
          </div>
        ) : (
          <span className="text-xl font-mono text-ink-muted italic select-none">—</span>
        )}
      </div>

      {hint && !loading && (
        <div className="mt-1.5 text-[11px] font-mono text-ink-muted truncate" title={hint}>
          {hint}
        </div>
      )}

      {delta && !loading && (
        <div className="mt-2 text-xs font-mono flex items-center gap-1">
          <span
            className={`font-medium ${
              delta.type === 'positive'
                ? 'text-safe'
                : delta.type === 'negative'
                  ? 'text-danger'
                  : 'text-ink-muted'
            }`}
          >
            {delta.value}
          </span>
          <span className="text-ink-muted/70 text-[10px]">vs previous</span>
        </div>
      )}
    </div>
  );
}
