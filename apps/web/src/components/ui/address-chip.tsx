'use client';

import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

export interface AddressChipProps {
  address: string;
  label?: string;
  explorerUrl?: string;
  className?: string;
  showCopy?: boolean;
  showExplorer?: boolean;
  size?: 'sm' | 'md';
}

export function AddressChip({
  address,
  label,
  explorerUrl = 'https://explorer.test.mezo.org',
  className = '',
  showCopy = true,
  showExplorer = true,
  size = 'md',
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
      className={`inline-flex items-center gap-1.5 ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      } bg-paper-surface border border-hairline rounded-sm font-mono text-ink ${className}`}
    >
      {label && <span className="text-ink-muted uppercase mr-1">{label}:</span>}
      <span className="tabular-nums font-semibold truncate" title={address}>
        {truncated}
      </span>

      {showCopy && (
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy address"
          className="text-ink-muted hover:text-ink p-0.5 rounded-sm focus-visible:outline-none transition-colors"
        >
          {copied ? (
            <Check className="w-3 h-3 text-safe stroke-[1.5]" />
          ) : (
            <Copy className="w-3 h-3 stroke-[1.5]" />
          )}
        </button>
      )}

      {showExplorer && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View on explorer"
          className="text-ink-muted hover:text-ember p-0.5 rounded-sm focus-visible:outline-none transition-colors"
        >
          <ExternalLink className="w-3 h-3 stroke-[1.5]" />
        </a>
      )}
    </div>
  );
}
