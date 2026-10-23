'use client';

import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

export interface TabItem {
  id?: string;
  value?: string;
  label: string;
  content?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  items?: TabItem[];
  tabs?: TabItem[];
  children?: React.ReactNode;
  className?: string;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  items,
  tabs,
  children,
  className = '',
}: TabsProps) {
  const tabList = items || tabs || [];

  return (
    <TabsPrimitive.Root
      defaultValue={defaultValue || tabList[0]?.value || tabList[0]?.id}
      value={value}
      onValueChange={onValueChange}
      className={`w-full flex flex-col ${className}`}
    >
      <TabsPrimitive.List className="flex border-b border-hairline gap-4 text-xs font-mono uppercase tracking-wider overflow-x-auto">
        {tabList.map((tab) => {
          const tabVal = tab.value || tab.id || tab.label;
          return (
            <TabsPrimitive.Trigger
              key={tabVal}
              value={tabVal}
              disabled={tab.disabled}
              className="pb-2.5 pt-1 px-1 text-ink-muted hover:text-ink transition-colors border-b-2 border-transparent data-[state=active]:border-ember data-[state=active]:text-ink font-semibold focus-visible:outline-none focus-visible:text-ember disabled:opacity-40 disabled:cursor-not-allowed select-none shrink-0"
            >
              {tab.label}
            </TabsPrimitive.Trigger>
          );
        })}
      </TabsPrimitive.List>

      {tabList.map((tab) => {
        const tabVal = tab.value || tab.id || tab.label;
        if (!tab.content) return null;
        return (
          <TabsPrimitive.Content
            key={tabVal}
            value={tabVal}
            className="pt-4 focus-visible:outline-none animate-in fade-in-50"
          >
            {tab.content}
          </TabsPrimitive.Content>
        );
      })}

      {children}
    </TabsPrimitive.Root>
  );
}
