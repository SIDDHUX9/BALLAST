'use client';

import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

export interface AddressChipProps {
  address: string;
  label?: string;
  explorerUrl?: string;
  className?: string;
}

export function AddressChip({
  address,
  label,
  explorerUrl = 'https://explorer.test.mezo.org',
  className = '',
}: AddressChipProps) {
  const [copied, setCopied] = useState(false);

  const truncated = address.length > 10 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied or unavailable
    }
  };

  const link = `${explorerUrl.replace(/\/$/, '')}/address/${address}`;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 bg-paper-surface border border-hairline rounded-sm text-xs font-mono text-ink ${className}`}
    >
      {label && <span className="text-ink-muted uppercase mr-1">{label}:</span>}
      <span className="tabular-nums font-semibold" title={address}>
        {truncated}
      </span>

      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy address"
        className="text-ink-muted hover:text-ink p-0.5 rounded-sm focus-visible:outline-none transition-colors"
      >
        {copied ? (
          <Check className="w-3.5 h-3.5 text-safe stroke-[1.5]" />
        ) : (
          <Copy className="w-3.5 h-3.5 stroke-[1.5]" />
        )}
      </button>

      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View on explorer"
        className="text-ink-muted hover:text-ember p-0.5 rounded-sm focus-visible:outline-none transition-colors"
      >
        <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
      </a>
    </div>
  );
}
