'use client';

import React from 'react';
import { ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { WriteStatus } from '../../hooks/use-ballast-write';

export type TxStatusState = 'pending' | 'confirmed' | 'failed' | WriteStatus;

export interface TxStatusProps {
  status: TxStatusState;
  hash?: string;
  txHash?: string;
  error?: string;
  label?: string;
  explorerUrl?: string;
  className?: string;
}

export function TxStatus({
  status,
  hash,
  txHash,
  error,
  label,
  explorerUrl = 'https://explorer.test.mezo.org',
  className = '',
}: TxStatusProps) {
  if (status === 'idle') return null;

  const actualHash = hash || txHash;
  const truncatedHash = actualHash ? `${actualHash.slice(0, 6)}…${actualHash.slice(-4)}` : null;
  const link = actualHash ? `${explorerUrl.replace(/\/$/, '')}/tx/${actualHash}` : null;

  const isPending =
    status === 'pending' ||
    status === 'simulating' ||
    status === 'awaiting_signature' ||
    status === 'submitted';

  const isSuccess = status === 'confirmed';
  const isFailed = status === 'failed';

  let statusLabel = label;
  if (!statusLabel) {
    if (status === 'simulating') statusLabel = 'SIMULATING TRANSACTION...';
    else if (status === 'awaiting_signature') statusLabel = 'AWAITING WALLET SIGNATURE...';
    else if (status === 'submitted' || status === 'pending') statusLabel = 'TRANSACTION SUBMITTED...';
    else if (isSuccess) statusLabel = 'CONFIRMED ON MEZO';
    else if (isFailed) statusLabel = error || 'TRANSACTION FAILED';
  }

  const borderClass = isSuccess
    ? 'border-safe/40 bg-safe/10 text-safe'
    : isFailed
    ? 'border-danger/40 bg-danger/10 text-danger'
    : 'border-watch/40 bg-watch/10 text-watch';

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono border rounded-sm ${borderClass} ${className}`}
    >
      {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 stroke-[1.5]" />}
      {isSuccess && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />}
      {isFailed && <XCircle className="w-3.5 h-3.5 shrink-0 stroke-[1.5]" />}

      <span className="font-semibold tracking-wider">{statusLabel}</span>

      {link && truncatedHash && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-ember flex items-center gap-1 ml-1"
        >
          <span>({truncatedHash})</span>
          <ExternalLink className="w-3 h-3 stroke-[1.5]" />
        </a>
      )}
    </div>
  );
}
