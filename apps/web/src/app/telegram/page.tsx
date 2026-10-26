'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BRAND_NAME,
  BRAND_URLS,
} from '@ballast/shared';
import { Header } from '../../components/layout/header';
import { Footer } from '../../components/layout/footer';
import {
  Send,
  Bell,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  Zap,
  Sliders,
  Lock,
  Terminal,
  BookOpen,
  Radio,
  Sparkles,
  Smartphone,
} from 'lucide-react';

export default function TelegramPage() {
  const steps = [
    {
      step: '01',
      title: 'Open the Bot on Telegram',
      description:
        'Launch our official bot @BALLASTBTC_bot on Telegram by clicking the button below or searching directly. Tap Start to activate the conversation.',
      detail: 'Direct link: t.me/BALLASTBTC_bot',
      ctaLabel: 'Open @BALLASTBTC_bot',
      ctaHref: BRAND_URLS.telegramBot,
      isExternal: true,
    },
    {
      step: '02',
      title: 'Generate Link Token in Ballast App',
      description:
        'Open the Ballast Alerts dashboard with your borrower wallet connected. Click "Start Telegram Linking Flow" to generate an ephemeral, single-use 15-minute pairing token.',
      detail: 'Gasless · Ephemeral · Auto-expiring',
      ctaLabel: 'Go to Alerts Dashboard',
      ctaHref: '/app/alerts',
      isExternal: false,
    },
    {
      step: '03',
      title: 'Cryptographic Signature Verification',
      description:
        'Your connected wallet (Mezo Passport, MetaMask, or any Web3 wallet) will request an EIP-191 / ERC-1271 gasless message signature. This cryptographically proves vault ownership without private keys or passwords.',
      detail: 'Zero gas cost · Non-custodial · No identity required',
      ctaLabel: null,
      ctaHref: null,
      isExternal: false,
    },
    {
      step: '04',
      title: 'Configure Your Alert Waterline',
      description:
        'Select your early warning ICR threshold (e.g., 135% or 150%) using the slider or bot command /watch. Once configured, your Trove is monitored around the clock with instant alerts.',
      detail: 'Customizable ICR buffer · Instant notifications',
      ctaLabel: null,
      ctaHref: null,
      isExternal: false,
    },
  ];

  const features = [
    {
      icon: Radio,
      title: 'Autonomous ICR Sentinel',
      tag: 'Proactive Early Warning',
      description:
        'Continually monitors your Trove Individual Collateral Ratio against the canonical Mezo Matsnet PriceFeed. Receive immediate Telegram pings as your ratio approaches your warning trigger, well before liquidation danger.',
    },
    {
      icon: Zap,
      title: 'Keeper Defense Execution Reports',
      tag: 'Real-time On-Chain Receipts',
      description:
        'When your ratio breaches your Ballast rule, permissionless keepers automatically repay debt or inject collateral from your pre-funded reserve. You receive an instant alert with the tx hash and new safe ICR.',
    },
    {
      icon: Bell,
      title: 'Low Reserve Buffer Warnings',
      tag: 'Prevent Defense Gaps',
      description:
        'Never let your defense reserves run dry unexpectedly. The bot proactively warns you if your BallastVault MUSD or BTC reserves drop below required intervention levels.',
    },
    {
      icon: Lock,
      title: 'Zero-Identity & Non-Custodial Privacy',
      tag: 'Cryptographic Sovereignty',
      description:
        'No phone numbers, passwords, emails, or personal data stored. We only bind an ephemeral Telegram chat ID to your on-chain vault address via EIP-191 signatures. Unlink unilaterally anytime with /unlink.',
    },
  ];

  const botCommands = [
    {
      command: '/start [token]',
      description: 'Initiate conversation or complete cryptographic wallet binding with an active token.',
      example: '/start ballast_9f82a1...',
    },
    {
      command: '/status',
      description: 'Check live Trove health: Collateral, Debt, ICR, and BallastVault defense reserve balances.',
      example: 'ICR: 148.2% · Reserve: 250 MUSD',
    },
    {
      command: '/watch <percent>',
      description: 'Set custom early-warning ICR threshold (recommended: 10%–20% above your defense trigger).',
      example: '/watch 140',
    },
    {
      command: '/mute <hours>',
      description: 'Temporarily silence non-critical warning notifications during market volatility (1–72 hrs).',
      example: '/mute 8',
    },
    {
      command: '/unmute',
      description: 'Restore real-time alert dispatch immediately.',
      example: '/unmute',
    },
    {
      command: '/unlink',
      description: 'Permanently and unilaterally delete all chat bindings, preferences, and data records.',
      example: '/unlink',
    },
    {
      command: '/help',
      description: 'Display all available commands, status definitions, and official Mezo protocol links.',
      example: '/help',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F1E8] text-[#0A1521] selection:bg-[#CA461E]/20 selection:text-[#CA461E]">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-[#E8E2D5] bg-[#F5F1E8] pt-12 pb-16 md:pt-20 md:pb-24">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 rounded-full bg-[#CA461E]/05 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-[#2D6A2E]/05 blur-3xl pointer-events-none" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 relative z-10">
          {/* Logo & Category Badge */}
          <div className="flex items-center gap-3.5 mb-6">
            <Image
              src="/logo.png"
              alt={`${BRAND_NAME} Logo`}
              width={48}
              height={48}
              priority
              className="w-12 h-12 object-contain drop-shadow-sm"
            />
            <div>
              <span className="font-serif font-bold text-xl text-[#0A1521] tracking-wider uppercase block leading-none">
                {BRAND_NAME}
              </span>
              <span className="text-[11px] font-mono text-[#525C66]">TELEGRAM DISPATCH SENTINEL</span>
            </div>
          </div>

          {/* Eyebrow & Badges */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold uppercase tracking-wider bg-[#CA461E]/10 text-[#CA461E] border border-[#CA461E]/20">
              <Send className="w-3.5 h-3.5" />
              Telegram Dispatch Sentinel
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono text-[#525C66] bg-white/70 border border-[#0A1521]/10">
              <ShieldCheck className="w-3.5 h-3.5 text-[#2D6A2E]" />
              Zero-Identity · EIP-191 Verified
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono text-[#525C66] bg-white/70 border border-[#0A1521]/10">
              <span>Mezo Matsnet</span>
              <span className="font-semibold text-[#0A1521]">31611</span>
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-[#0A1521] tracking-tight leading-[1.12] mb-6 max-w-4xl">
            Real-Time Liquidation Defense Alerts on Telegram.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg md:text-xl font-sans text-[#525C66] max-w-3xl leading-relaxed mb-8">
            Stay one step ahead of market volatility. Ballast continuously monitors your MUSD Trove on Mezo,
            sending instant warnings before ICR breach and on-chain receipts when keepers execute automated defense.
          </p>

          {/* Primary & Secondary Action CTAs */}
          <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 mb-10">
            <a
              href={BRAND_URLS.telegramBot}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 px-6 sm:px-7 py-3.5 sm:py-4 rounded-full bg-[#0A1521] text-white font-sans font-medium text-sm hover:bg-[#CA461E] transition-all duration-200 shadow-sm hover:shadow group"
            >
              <Send className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
              <span>Open @BALLASTBTC_bot</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
            </a>

            <Link
              href="/app/alerts"
              className="inline-flex items-center gap-2 px-5 sm:px-6 py-3.5 sm:py-4 rounded-full border border-[#0A1521]/20 bg-white text-[#0A1521] font-sans font-medium text-sm hover:border-[#CA461E] hover:text-[#CA461E] transition-all duration-200 shadow-xs"
            >
              <Sliders className="w-4 h-4" />
              <span>Link Wallet in App</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/whitepaper"
              className="inline-flex items-center gap-2 px-4 py-3.5 text-xs font-mono font-medium text-[#525C66] hover:text-[#0A1521] transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>WHITEPAPER</span>
            </Link>
          </div>

          {/* Trust Value Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-[#0A1521]/10">
            <div className="flex items-center gap-2 text-xs font-mono text-[#525C66]">
              <CheckCircle2 className="w-4 h-4 text-[#2D6A2E] shrink-0" />
              <span>No email or phone</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#525C66]">
              <CheckCircle2 className="w-4 h-4 text-[#2D6A2E] shrink-0" />
              <span>Gasless signature</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#525C66]">
              <CheckCircle2 className="w-4 h-4 text-[#2D6A2E] shrink-0" />
              <span>24/7 autonomous bot</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#525C66]">
              <CheckCircle2 className="w-4 h-4 text-[#2D6A2E] shrink-0" />
              <span>1-click /unlink wipe</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section 1: How It Works In Short */}
      <section className="py-16 md:py-24 border-b border-[#E8E2D5] bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#CA461E] font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Core Architecture</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#0A1521] tracking-tight">
              How the Alert Pipeline Works
            </h2>
            <p className="text-sm sm:text-base font-sans text-[#525C66] mt-3 leading-relaxed">
              Ballast operates a lightweight, privacy-preserving monitoring daemon that bridges on-chain Mezo Trove
              state directly to Telegram without holding custody or centralizing user keys.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="p-6 sm:p-7 rounded-2xl bg-[#F5F1E8]/60 border border-[#E8E2D5] hover:border-[#CA461E]/40 transition-all group"
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#E8E2D5] flex items-center justify-center text-[#CA461E] shadow-2xs group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5 stroke-[1.75]" />
                    </div>
                    <span className="text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-white text-[#525C66] border border-[#E8E2D5]">
                      {feature.tag}
                    </span>
                  </div>

                  <h3 className="font-serif font-bold text-lg text-[#0A1521] mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-xs sm:text-sm font-sans text-[#525C66] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 2: Step-by-Step Setup Guide */}
      <section className="py-16 md:py-24 border-b border-[#E8E2D5] bg-[#F5F1E8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#2D6A2E] font-semibold mb-2">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Fast 2-Minute Onboarding</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#0A1521] tracking-tight">
              How to Set Up in 4 Simple Steps
            </h2>
            <p className="text-sm sm:text-base font-sans text-[#525C66] mt-3 leading-relaxed">
              No account creation, no password to remember. Bind your wallet address to your personal Telegram chat ID
              with a single gasless signature.
            </p>
          </div>

          <div className="space-y-4">
            {steps.map((s) => (
              <div
                key={s.step}
                className="p-6 sm:p-7 rounded-2xl bg-white border border-[#E8E2D5] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[#CA461E]/30 transition-all"
              >
                <div className="flex items-start gap-4 sm:gap-5 max-w-2xl">
                  <span className="font-mono font-bold text-2xl sm:text-3xl text-[#CA461E]/40 shrink-0 leading-none pt-1">
                    {s.step}
                  </span>
                  <div>
                    <h3 className="font-serif font-bold text-base sm:text-lg text-[#0A1521] mb-1.5">
                      {s.title}
                    </h3>
                    <p className="text-xs sm:text-sm font-sans text-[#525C66] leading-relaxed mb-2.5">
                      {s.description}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#2D6A2E] font-medium bg-[#2D6A2E]/05 px-2 py-0.5 rounded border border-[#2D6A2E]/15">
                      <ShieldCheck className="w-3 h-3" />
                      {s.detail}
                    </span>
                  </div>
                </div>

                {s.ctaLabel && s.ctaHref && (
                  <div className="shrink-0 md:self-center">
                    {s.isExternal ? (
                      <a
                        href={s.ctaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0A1521] text-white font-sans text-xs font-medium hover:bg-[#CA461E] transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{s.ctaLabel}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <Link
                        href={s.ctaHref}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#0A1521] text-white font-sans text-xs font-medium hover:bg-[#CA461E] transition-colors"
                      >
                        <span>{s.ctaLabel}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Available Bot Commands */}
      <section className="py-16 md:py-24 border-b border-[#E8E2D5] bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#CA461E] font-semibold mb-2">
                <Terminal className="w-3.5 h-3.5" />
                <span>Command Reference</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold text-[#0A1521] tracking-tight">
                Telegram Bot Commands
              </h2>
            </div>
            <a
              href={BRAND_URLS.telegramBot}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-[#CA461E] hover:underline"
            >
              <span>Test commands in @BALLASTBTC_bot</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-[#E8E2D5] bg-[#F5F1E8]/50">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#E8E2D5] bg-white text-[11px] font-mono uppercase tracking-wider text-[#0A1521]">
                  <th className="py-3.5 px-4 sm:px-6 font-semibold">Command</th>
                  <th className="py-3.5 px-4 sm:px-6 font-semibold">Purpose</th>
                  <th className="py-3.5 px-4 sm:px-6 font-semibold hidden sm:table-cell">Example Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E2D5]/70 font-sans">
                {botCommands.map((item) => (
                  <tr key={item.command} className="hover:bg-white/80 transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 font-mono font-bold text-[#CA461E] whitespace-nowrap">
                      {item.command}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 text-[#525C66] leading-relaxed">
                      {item.description}
                    </td>
                    <td className="py-3.5 px-4 sm:px-6 font-mono text-[11px] text-[#0A1521]/70 hidden sm:table-cell whitespace-nowrap">
                      {item.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Section 4: Privacy & Non-Custodial Guarantee */}
      <section className="py-16 md:py-20 bg-[#F5F1E8]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl bg-[#0A1521] text-white p-8 sm:p-12 relative overflow-hidden">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#CA461E]/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#CA461E] font-semibold mb-3">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacy & Zero Identity Guarantee</span>
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold tracking-tight mb-4 text-white">
                You Own Your Position. You Own Your Data.
              </h2>
              <p className="text-sm sm:text-base font-sans text-white/80 leading-relaxed mb-8">
                Ballast is built for Bitcoiners who value sovereignty. We never ask for your email, phone number,
                or personal identification. Link tokens expire after 15 minutes, signatures verify wallet ownership
                without private keys, and sending <code className="font-mono text-[#CA461E]">/unlink</code> instantly
                and permanently purges your chat ID from our records.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={BRAND_URLS.telegramBot}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#CA461E] text-white font-sans font-medium text-sm hover:bg-[#CA461E]/90 transition-all shadow-md group"
                >
                  <Send className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  <span>Start Bot on Telegram (@BALLASTBTC_bot)</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </a>

                <Link
                  href="/app/alerts"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-white/20 bg-white/10 text-white font-sans font-medium text-sm hover:bg-white/20 transition-all"
                >
                  <span>Open Alerts in App</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <Link
                  href="/whitepaper"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono text-white/70 hover:text-white transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Read WHITEPAPER</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
