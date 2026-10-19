'use client';

import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export interface TabItem {
  value: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  items: TabItem[];
  className?: string;
}

export function Tabs({ defaultValue, value, onValueChange, items, className = '' }: TabsProps) {
  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue || items[0]?.value}
      value={value}
      onValueChange={onValueChange}
      className={`w-full flex flex-col ${className}`}
    >
      <TabsPrimitive.List className="flex border-b border-hairline gap-4 text-xs font-mono uppercase tracking-wider overflow-x-auto">
        {items.map((tab) => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            disabled={tab.disabled}
            className="pb-2.5 pt-1 px-1 text-ink-muted hover:text-ink transition-colors border-b-2 border-transparent data-[state=checked]:border-ember data-[state=checked]:text-ink font-semibold focus-visible:outline-none focus-visible:text-ember disabled:opacity-40 disabled:cursor-not-allowed select-none shrink-0"
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>

      {items.map((tab) => (
        <TabsPrimitive.Content
          key={tab.value}
          value={tab.value}
          className="pt-4 focus-visible:outline-none animate-in fade-in-50"
        >
          {tab.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
