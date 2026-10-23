'use client';

import React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';

export interface SwitchProps {
  label?: string;
  ariaLabel?: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  label,
  ariaLabel,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  className = '',
}: SwitchProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm font-sans font-medium text-ink select-none">{label}</span>
          )}
          {description && (
            <span className="text-xs font-mono text-ink-muted select-none">{description}</span>
          )}
        </div>
      )}

      <SwitchPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={ariaLabel || label || 'Toggle Switch'}
        className="w-10 h-6 bg-hairline rounded-sm transition-colors duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember data-[state=checked]:bg-safe disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer p-0.5"
      >
        <SwitchPrimitive.Thumb className="block w-5 h-5 bg-paper-surface rounded-sm shadow-sm transition-transform duration-180 will-change-transform data-[state=checked]:translate-x-4 border border-hairline" />
      </SwitchPrimitive.Root>
    </div>
  );
}
