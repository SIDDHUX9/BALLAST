'use client';

import React, { useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, Info, ExternalLink, Trash2 } from 'lucide-react';
import { useNotifications } from './notifications-provider';
import { PopoverRoot, PopoverTrigger, PopoverContent } from '../ui/popover';
import { BRAND_URLS } from '@ballast/shared';

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAllRead, clearAll } = useNotifications();

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && unreadCount > 0) {
      markAllRead();
    }
  };

  const icons = {
    success: <CheckCircle2 className="w-3.5 h-3.5 text-safe shrink-0 stroke-[1.5]" />,
    warning: <AlertTriangle className="w-3.5 h-3.5 text-watch shrink-0 stroke-[1.5]" />,
    error: <AlertCircle className="w-3.5 h-3.5 text-danger shrink-0 stroke-[1.5]" />,
    info: <Info className="w-3.5 h-3.5 text-ember shrink-0 stroke-[1.5]" />,
  };

  return (
    <PopoverRoot open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Transaction and Alert Notifications"
          className="relative w-8 h-8 rounded-sm border border-hairline bg-paper-surface flex items-center justify-center text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors focus-visible:outline-none"
        >
          <Bell className="w-4 h-4 stroke-[1.5]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-ember text-paper-raised text-[9px] font-mono font-bold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 md:w-96 p-0 bg-paper-raised border border-hairline shadow-elevation rounded-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline bg-paper-surface">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-ink">
              Activity & Notifications
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-paper-raised border border-hairline text-ink-muted">
              {notifications.length}
            </span>
          </div>
          {notifications.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-mono text-ink-muted hover:text-danger flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3 stroke-[1.5]" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-hairline">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-ink-muted">
              No recent notifications or transactions.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3.5 space-y-1 transition-colors ${
                  n.read ? 'bg-transparent' : 'bg-paper-surface/50'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{icons[n.type]}</div>
                  <div className="grow min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-ink truncate">
                        {n.title}
                      </span>
                      <span className="text-[10px] font-mono text-ink-muted shrink-0 tabular-nums">
                        {new Date(n.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {n.description && (
                      <p className="text-xs font-sans text-ink-muted leading-relaxed break-words mt-0.5">
                        {n.description}
                      </p>
                    )}
                    {n.txHash && (
                      <div className="pt-1">
                        <a
                          href={`${BRAND_URLS.mezoExplorer}/tx/${n.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-ember hover:underline"
                        >
                          <span>{n.txHash.slice(0, 8)}...{n.txHash.slice(-6)}</span>
                          <ExternalLink className="w-3 h-3 stroke-[1.5]" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
