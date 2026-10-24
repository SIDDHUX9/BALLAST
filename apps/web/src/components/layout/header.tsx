'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BRAND_NAME } from '@ballast/shared';
import { useTheme } from '../theme-provider';
import { Sun, Moon, Anchor } from 'lucide-react';
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
    { href: '/whitepaper', label: 'Whitepaper' },
    { href: '#belief', label: 'About' },
  ];

  return (
    <header className={`border-b border-[#E8E2D5]/60 ${isApp ? 'bg-paper/95' : 'bg-[#F5F1E8]/95'} backdrop-blur-sm sticky top-0 z-40 transition-colors`}>
      <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 h-20 flex items-center justify-between gap-4">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group focus-visible:outline-none">
            <span className="text-[#0A1521] group-hover:text-[#CA461E] transition-colors">
              <Anchor className="w-5 h-5 stroke-[2.2]" />
            </span>
            <span className="font-serif font-bold text-lg text-[#0A1521] tracking-[0.18em] uppercase leading-none group-hover:text-[#CA461E] transition-colors">
              {BRAND_NAME}
            </span>
          </Link>

          {/* Network Chip (App only) */}
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
        <nav className="hidden md:flex items-center gap-7 text-sm font-sans font-medium">
          {isApp
            ? appNavItems.map((item) => {
              const active = pathname === item.href || (item.href === '/app/overview' && pathname === '/app');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`transition-colors pb-1 text-xs font-mono uppercase tracking-wider border-b-2 ${active
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
                className="text-[#4A463F] hover:text-[#14130F] transition-colors font-medium text-sm"
              >
                {item.label}
              </a>
            ))}
        </nav>

        {/* Action Controls & Wallet Slot */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button (App only) */}
          {isApp && (
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
          )}

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
              <button className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#14130F] text-white font-sans font-medium text-xs hover:bg-[#C84E29] transition-all duration-200 shadow-sm hover:shadow">
                <span>Launch App</span>
                <span className="text-xs font-mono">↗</span>
              </button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
