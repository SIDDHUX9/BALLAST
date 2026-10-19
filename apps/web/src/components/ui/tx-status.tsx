'use client';

import React from 'react';
import { ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export type TxStatusState = 'pending' | 'confirmed' | 'failed';

export interface TxStatusProps {
  status: TxStatusState;
  hash: string;
  label?: string;
  explorerUrl?: string;
  className?: string;
}

export function TxStatus({
  status,
  hash,
  label,
  explorerUrl = 'https://explorer.test.mezo.org',
  className = '',
}: TxStatusProps) {
  const truncatedHash = `${hash.slice(0, 6)}…${hash.slice(-4)}`;
  const link = `${explorerUrl.replace(/\/$/, '')}/tx/${hash}`;

  const config = {
    pending: {
      text: 'text-watch',
      border: 'border-watch/40',
      bg: 'bg-watch/10',
      icon: <Loader2 className="w-3.5 h-3.5 text-watch animate-spin stroke-[1.5]" />,
      defaultLabel: 'TRANSACTION PENDING',
    },
    confirmed: {
      text: 'text-safe',
      border: 'border-safe/40',
      bg: 'bg-safe/10',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-safe stroke-[1.5]" />,
      defaultLabel: 'CONFIRMED ON MEZO',
    },
    failed: {
      text: 'text-danger',
      border: 'border-danger/40',
      bg: 'bg-danger/10',
      icon: <XCircle className="w-3.5 h-3.5 text-danger stroke-[1.5]" />,
      defaultLabel: 'TRANSACTION REVERTED',
    },
  };

  const current = config[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 text-xs font-mono border rounded-sm ${current.border} ${current.bg} ${className}`}
    >
      {current.icon}
      <span className={`font-semibold tracking-wider ${current.text}`}>
        {label || current.defaultLabel}
      </span>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="text-ink-muted hover:text-ink flex items-center gap-1 ml-1 underline underline-offset-2 tabular-nums"
        title={hash}
      >
        <span>{truncatedHash}</span>
        <ExternalLink className="w-3 h-3 stroke-[1.5]" />
      </a>
    </div>
  );
}
