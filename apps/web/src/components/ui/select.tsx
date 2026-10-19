'use client';

import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Select({
  label,
  value,
  onValueChange,
  options,
  placeholder = 'Select option...',
  disabled = false,
  className = '',
}: SelectProps) {
  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      {label && (
        <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">{label}</span>
      )}

      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger className="flex items-center justify-between w-full px-3 py-2 text-sm font-mono text-ink bg-paper-surface border border-hairline hover:border-hairline-strong rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon asChild>
            <ChevronDown className="w-4 h-4 text-ink-muted ml-2 shrink-0 stroke-[1.5]" />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>

        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            position="popper"
            sideOffset={4}
            className="z-50 min-w-[8rem] overflow-hidden rounded-sm border border-hairline bg-paper-raised text-ink shadow-elevation animate-in fade-in-80"
          >
            <SelectPrimitive.Viewport className="p-1">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className="relative flex items-center justify-between px-3 py-2 text-xs font-mono select-none rounded-sm cursor-pointer hover:bg-hairline/20 focus:bg-hairline/30 focus:outline-none data-[disabled]:opacity-40 data-[disabled]:pointer-events-none"
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <Check className="w-3.5 h-3.5 text-ember stroke-[1.5]" />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
