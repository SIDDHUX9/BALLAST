'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { BRAND_URLS } from '@ballast/shared';

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  type: 'success' | 'warning' | 'error' | 'info';
  txHash?: `0x${string}`;
  timestamp: number;
  read: boolean;
}

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  notify: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAllRead: () => void;
  clearAll: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const STORAGE_KEY = 'ballast_notifications_history';

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch {
      // LocalStorage unavailable
    }
  }, []);

  const saveToStorage = (items: AppNotification[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 50)));
    } catch {
      // Quota exceeded
    }
  };

  const notify = useCallback((item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: AppNotification = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      read: false,
    };

    setNotifications((prev) => {
      const updated = [newNotification, ...prev].slice(0, 50);
      saveToStorage(updated);
      return updated;
    });

    setActiveToast(newNotification);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-safe shrink-0 stroke-[1.5]" />,
    warning: <AlertTriangle className="w-4 h-4 text-watch shrink-0 stroke-[1.5]" />,
    error: <AlertCircle className="w-4 h-4 text-danger shrink-0 stroke-[1.5]" />,
    info: <Info className="w-4 h-4 text-ember shrink-0 stroke-[1.5]" />,
  };

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        notify,
        markAllRead,
        clearAll,
      }}
    >
      {children}

      <ToastPrimitive.Provider swipeDirection="right" duration={6000}>
        {activeToast && (
          <ToastPrimitive.Root
            key={activeToast.id}
            open={Boolean(activeToast)}
            onOpenChange={(open) => {
              if (!open) setActiveToast(null);
            }}
            className="flex items-start gap-3 p-4 bg-paper-raised border border-hairline rounded shadow-elevation max-w-md w-full data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]"
          >
            <div className="mt-0.5">{icons[activeToast.type]}</div>
            <div className="grow min-w-0 space-y-1">
              <ToastPrimitive.Title className="text-xs font-mono font-bold text-ink">
                {activeToast.title}
              </ToastPrimitive.Title>
              {activeToast.description && (
                <ToastPrimitive.Description className="text-xs font-mono text-ink-muted leading-relaxed break-words">
                  {activeToast.description}
                </ToastPrimitive.Description>
              )}
              {activeToast.txHash && (
                <div className="pt-1">
                  <a
                    href={`${BRAND_URLS.mezoExplorer}/tx/${activeToast.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-ember hover:underline"
                  >
                    <span>View on Explorer</span>
                    <ExternalLink className="w-3 h-3 stroke-[1.5]" />
                  </a>
                </div>
              )}
            </div>
            <ToastPrimitive.Close
              className="text-ink-muted hover:text-ink p-1 rounded-sm focus-visible:outline-none"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5 stroke-[1.5]" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        )}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm m-0 list-none" />
      </ToastPrimitive.Provider>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
