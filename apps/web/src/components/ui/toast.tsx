'use client';

import React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
}

export interface ToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
}

export function Toast({ open, onOpenChange, title, description, type = 'info' }: ToastProps) {
  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-safe shrink-0 stroke-[1.5]" />,
    warning: <AlertTriangle className="w-4 h-4 text-watch shrink-0 stroke-[1.5]" />,
    error: <AlertCircle className="w-4 h-4 text-danger shrink-0 stroke-[1.5]" />,
    info: <span className="w-2 h-2 rounded-full bg-ember shrink-0" />,
  };

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      <ToastPrimitive.Root
        open={open}
        onOpenChange={onOpenChange}
        className="flex items-start gap-3 p-3.5 bg-paper-raised border border-hairline rounded shadow-elevation max-w-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]"
      >
        <div className="mt-0.5">{icons[type]}</div>
        <div className="grow">
          <ToastPrimitive.Title className="text-xs font-mono font-semibold text-ink">
            {title}
          </ToastPrimitive.Title>
          {description && (
            <ToastPrimitive.Description className="text-xs font-mono text-ink-muted mt-0.5">
              {description}
            </ToastPrimitive.Description>
          )}
        </div>
        <ToastPrimitive.Close
          className="text-ink-muted hover:text-ink p-1 rounded-sm focus-visible:outline-none"
          aria-label="Dismiss toast"
        >
          <X className="w-3.5 h-3.5 stroke-[1.5]" />
        </ToastPrimitive.Close>
      </ToastPrimitive.Root>
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm m-0 list-none" />
    </ToastPrimitive.Provider>
  );
}
