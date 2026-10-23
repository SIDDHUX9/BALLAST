'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND_NAME, BRAND_TAGLINE } from '@ballast/shared';
import { useTheme } from '../theme-provider';
import { Sun, Moon, Anchor } from 'lucide-react';
import { Button } from '../ui/button';
import { WalletButton } from '../wallet/wallet-button';
import { NotificationCenter } from '../notifications/notification-center';

export interface HeaderProps {
  walletSlot?: React.ReactNode;
}

export function Header({ walletSlot }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const isApp = pathname?.startsWith('/app');

  const appNavItems = [
    { href: '/app', label: 'Overview' },
    { href: '/app/position', label: 'Position' },
    { href: '/app/rules', label: 'Rules' },
    { href: '/app/reserve', label: 'Reserve' },
    { href: '/app/stress-test', label: 'Stress Test' },
    { href: '/app/alerts', label: 'Alerts' },
    { href: '/app/activity', label: 'Activity' },
  ];

  const landingNavItems = [
    { href: '#how-it-works', label: 'Mechanics' },
    { href: '#calculator', label: 'Waterline Calculator' },
    { href: '#honesty', label: 'Boundaries & Honesty' },
    { href: '/design', label: 'Design System' },
  ];

  return (
    <header className="border-b border-hairline bg-paper/95 sticky top-0 z-40 transition-colors">
      <div className="max-w-container mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group focus-visible:outline-none">
            <span className="w-8 h-8 rounded-sm bg-ink text-paper-raised flex items-center justify-center border border-ink group-hover:bg-ember transition-colors">
              <Anchor className="w-4 h-4 stroke-[1.5]" />
            </span>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-lg text-ink tracking-tight leading-none group-hover:text-ember transition-colors">
                {BRAND_NAME}
              </span>
              <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider hidden sm:inline">
                {BRAND_TAGLINE}
              </span>
            </div>
          </Link>

          {/* Network Chip */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-hairline bg-paper-surface text-[11px] font-mono text-ink-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-safe shrink-0 animate-pulse" />
            <span>Mezo Matsnet</span>
            <span className="text-hairline-strong">|</span>
            <span className="tabular-nums">31611</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-mono tracking-wider uppercase">
          {isApp
            ? appNavItems.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`transition-colors pb-1 border-b-2 ${
                      active
                        ? 'border-ember text-ink font-semibold'
                        : 'border-transparent text-ink-muted hover:text-ink'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })
            : landingNavItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-ink-muted hover:text-ink transition-colors pb-1 border-b-2 border-transparent"
                >
                  {item.label}
                </a>
              ))}
        </nav>

        {/* Action Controls & Wallet Slot */}
        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            className="w-8 h-8 rounded-sm border border-hairline bg-paper-surface flex items-center justify-center text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors focus-visible:outline-none"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 stroke-[1.5]" />
            ) : (
              <Sun className="w-4 h-4 stroke-[1.5]" />
            )}
          </button>

          {/* Notifications Center */}
          <NotificationCenter />

          {/* App Entry or Wallet Slot */}
          {walletSlot ? (
            walletSlot
          ) : isApp ? (
            <WalletButton />
          ) : (
            <div className="flex items-center gap-2">
              <WalletButton />
              <Link href="/app">
                <Button size="sm" variant="primary">
                  Open App
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
