'use client';

import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  trigger?: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  trigger,
  className = '',
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}

      <DialogPrimitive.Portal>
        {/* Backdrop without glassmorphism or blur (BANNED list compliance) */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 animate-in fade-in-50" />

        <DialogPrimitive.Content
          className={`fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded border border-hairline bg-paper-raised p-6 shadow-elevation duration-200 animate-in fade-in-90 zoom-in-95 ${className}`}
        >
          <div className="flex items-start justify-between border-b border-hairline pb-3 mb-4">
            <div>
              <DialogPrimitive.Title className="text-base font-serif font-semibold text-ink">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-xs font-mono text-ink-muted mt-1">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>

            <DialogPrimitive.Close
              className="text-ink-muted hover:text-ink p-1 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ember transition-colors"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4 stroke-[1.5]" />
            </DialogPrimitive.Close>
          </div>

          <div className="text-sm font-sans text-ink">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
