'use client';

import React from 'react';

export type StatusBadgeState =
  | 'Armed'
  | 'Watch'
  | 'Danger'
  | 'Disarmed'
  | 'active'
  | 'inactive'
  | 'warning'
  | 'danger'
  | 'default';

export interface StatusBadgeProps {
  status: StatusBadgeState;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  const displayLabel = label || status.toUpperCase();

  const config: Record<
    StatusBadgeState,
    { border: string; text: string; bg: string; dot: string }
  > = {
    Armed: {
      border: 'border-safe/30',
      text: 'text-safe',
      bg: 'bg-safe/10',
      dot: 'bg-safe',
    },
    active: {
      border: 'border-safe/30',
      text: 'text-safe',
      bg: 'bg-safe/10',
      dot: 'bg-safe',
    },
    Watch: {
      border: 'border-watch/40',
      text: 'text-watch',
      bg: 'bg-watch/10',
      dot: 'bg-watch',
    },
    warning: {
      border: 'border-watch/40',
      text: 'text-watch',
      bg: 'bg-watch/10',
      dot: 'bg-watch',
    },
    Danger: {
      border: 'border-danger/40',
      text: 'text-danger',
      bg: 'bg-danger/10',
      dot: 'bg-danger',
    },
    danger: {
      border: 'border-danger/40',
      text: 'text-danger',
      bg: 'bg-danger/10',
      dot: 'bg-danger',
    },
    Disarmed: {
      border: 'border-hairline',
      text: 'text-ink-muted',
      bg: 'bg-paper',
      dot: 'bg-ink-muted',
    },
    inactive: {
      border: 'border-hairline',
      text: 'text-ink-muted',
      bg: 'bg-paper',
      dot: 'bg-ink-muted',
    },
    default: {
      border: 'border-hairline',
      text: 'text-ink',
      bg: 'bg-paper-surface',
      dot: 'bg-ink-muted',
    },
  };

  const style = config[status] || config.default;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-mono tracking-wider font-semibold rounded-sm border ${style.border} ${style.text} ${style.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot} shrink-0`} />
      <span>{displayLabel}</span>
    </span>
  );
}
