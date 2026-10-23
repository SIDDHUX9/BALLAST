'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export interface MezoBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  variant?: 'pill' | 'compact' | 'iconOnly';
  label?: string;
  className?: string;
}

/**
 * MezoBadge renders an official verification badge denoting canonical Mezo Network MUSD protocol infrastructure.
 * Informs borrowers and hackathon judges that the underlying smart contract is an official Mezo deployment.
 */
export function MezoBadge({
  size = 'xs',
  variant = 'pill',
  label = 'Official Mezo',
  className = '',
}: MezoBadgeProps) {
  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.5 gap-1',
    sm: 'text-[10px] px-2 py-0.5 gap-1.5',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }[size];

  return (
    <span
      role="status"
      aria-label="Official canonical Mezo Network contract verified on Matsnet (Chain ID 31611)"
      title="Official canonical Mezo Network MUSD contract verified on Matsnet (Chain ID 31611)"
      className={`inline-flex items-center rounded font-mono font-bold uppercase tracking-wider bg-ember/15 text-ember border border-ember/30 shrink-0 select-none transition-colors hover:bg-ember/25 hover:border-ember/45 ${sizeClasses} ${className}`}
    >
      <ShieldCheck className={`${iconSizes} stroke-[2.2] text-ember shrink-0`} />
      {variant !== 'iconOnly' && (
        <span>{variant === 'compact' ? 'Mezo' : label}</span>
      )}
    </span>
  );
}
