'use client';

import React from 'react';
import { Info, AlertTriangle, AlertOctagon, X } from 'lucide-react';

export type BannerVariant = 'info' | 'warning' | 'danger';

export interface BannerProps {
  variant?: BannerVariant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  action?: React.ReactNode;
  className?: string;
}

export function Banner({
  variant = 'info',
  title,
  children,
  onDismiss,
  action,
  className = '',
}: BannerProps) {
  const config = {
    info: {
      border: 'border-hairline',
      bg: 'bg-paper-raised',
      text: 'text-ink',
      icon: <Info className="w-4 h-4 text-ember shrink-0 stroke-[1.5]" />,
    },
    warning: {
      border: 'border-watch/40',
      bg: 'bg-watch/10',
      text: 'text-ink',
      icon: <AlertTriangle className="w-4 h-4 text-watch shrink-0 stroke-[1.5]" />,
    },
    danger: {
      border: 'border-danger/40',
      bg: 'bg-danger/10',
      text: 'text-ink',
      icon: <AlertOctagon className="w-4 h-4 text-danger shrink-0 stroke-[1.5]" />,
    },
  };

  const style = config[variant];

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 p-3.5 border rounded-sm ${style.border} ${style.bg} ${style.text} ${className}`}
    >
      <div className="flex items-start gap-2.5 grow">
        <div className="mt-0.5">{style.icon}</div>
        <div className="grow">
          {title && (
            <span className="block text-xs font-mono font-semibold uppercase tracking-wider mb-0.5">
              {title}
            </span>
          )}
          <div className="text-xs font-sans text-ink-soft leading-relaxed">{children}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {action}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss banner"
            className="text-ink-muted hover:text-ink p-1 rounded-sm focus-visible:outline-none transition-colors"
          >
            <X className="w-3.5 h-3.5 stroke-[1.5]" />
          </button>
        )}
      </div>
    </div>
  );
}
