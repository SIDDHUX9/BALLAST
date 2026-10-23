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
    { href: '/app/overview', label: 'Overview' },
    { href: '/app/position', label: 'Position' },
    { href: '/app/rules', label: 'Rules' },
    { href: '/app/reserve', label: 'Reserve' },
    { href: '/app/stress-test', label: 'Stress Test' },
    { href: '/app/alerts', label: 'Alerts' },
    { href: '/app/activity', label: 'Activity' },
  ];

  const landingNavItems = [
    { href: '#how-it-works', label: 'Protocol' },
    { href: '#simulator', label: 'Risk' },
    { href: '/whitepaper', label: 'Docs' },
    { href: '#belief', label: 'About' },
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-colors ${
        isApp
          ? 'border-b border-hairline bg-paper/95'
          : 'bg-[#F5F1E8]/90 backdrop-blur-md text-[#14130F]'
      }`}
    >
      <div className="max-w-container mx-auto px-4 md:px-8 h-18 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group focus-visible:outline-none">
            <span className="w-8 h-8 rounded-sm bg-[#14130F] text-white flex items-center justify-center border border-[#14130F] group-hover:bg-[#C84E29] transition-colors">
              <Anchor className="w-4 h-4 stroke-[1.5]" />
            </span>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-lg text-[#14130F] dark:text-inherit tracking-tight leading-none group-hover:text-[#C84E29] transition-colors">
                {BRAND_NAME}
              </span>
              {isApp && (
                <span className="text-[10px] font-mono text-ink-muted uppercase tracking-wider hidden sm:inline">
                  {BRAND_TAGLINE}
                </span>
              )}
            </div>
          </Link>

          {/* Network Chip - Only in App */}
          {isApp && (
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-sm border border-hairline bg-paper-surface text-[11px] font-mono text-ink-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-safe shrink-0 animate-pulse" />
              <span>Mezo Matsnet</span>
              <span className="text-hairline-strong">|</span>
              <span className="tabular-nums">31611</span>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-sans">
          {isApp
            ? appNavItems.map((item) => {
                const active = pathname === item.href || (item.href === '/app/overview' && pathname === '/app');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`transition-colors pb-1 border-b-2 text-xs font-mono uppercase tracking-wider ${
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
                  className="text-[#68635B] hover:text-[#14130F] transition-colors font-medium"
                >
                  {item.label}
                </a>
              ))}
        </nav>

        {/* Action Controls & Wallet Slot */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
            className="w-8 h-8 rounded-full border border-hairline bg-paper-surface flex items-center justify-center text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors focus-visible:outline-none"
          >
            {theme === 'light' ? (
              <Moon className="w-3.5 h-3.5 stroke-[1.5]" />
            ) : (
              <Sun className="w-3.5 h-3.5 stroke-[1.5]" />
            )}
          </button>

          {/* App Entry or Wallet Slot */}
          {walletSlot ? (
            walletSlot
          ) : isApp ? (
            <>
              <NotificationCenter />
              <WalletButton />
            </>
          ) : (
            <Link href="/app/overview">
              <button className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#14130F] dark:bg-white text-white dark:text-[#14130F] font-sans font-medium text-xs hover:bg-[#C84E29] dark:hover:bg-[#C84E29] dark:hover:text-white transition-all duration-200 shadow-sm hover:shadow">
                <span>Launch App</span>
                <span className="text-[11px] font-mono">↗</span>
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
