'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '../components/layout/header';
import {
  BRAND_NAME,
  PROTOCOL_CONSTANTS,
  computeICR,
  simulateStressTest,
} from '@ballast/shared';
import { LANDING_CONTENT } from '../content/landing';
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  TrendingDown,
  ExternalLink,
} from 'lucide-react';
import { Handwritten } from '../components/landing/handwritten';
import { MATSNET_DEPLOYMENT } from '../lib/deployment';

// Smooth scroll reveal hook
interface ScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  resetOnExit?: boolean;
}

function useScrollReveal<T extends HTMLElement>(options?: number | ScrollRevealOptions) {
  const threshold = typeof options === 'number' ? options : options?.threshold ?? 0.1;
  const rootMargin = typeof options === 'number' ? '0px 0px -40px 0px' : options?.rootMargin ?? '0px 0px -40px 0px';
  const resetOnExit = typeof options === 'number' ? false : options?.resetOnExit ?? false;

  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      setIsVisible(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        } else if (resetOnExit) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [threshold, rootMargin, resetOnExit]);

  return { ref, isVisible };
}

export default function LandingPage() {
  // Simulator State driven by real mathematical parameters
  // Initial position: Collateral $10,000, Debt $6,000 (ICR 166.7%)
  const [btcPriceDrop, setBtcPriceDrop] = useState<number>(20);
  const [reserveMusd, setReserveMusd] = useState<number>(1200);
  const [triggerRatio, setTriggerRatio] = useState<number>(135);
  const [activeChartIndex, setActiveChartIndex] = useState<number>(4); // index corresponding to 20% drop

  const initialCollateralUSD = LANDING_CONTENT.hero.card.initialCollateralUSD; // $10,000
  const initialDebtUSD = LANDING_CONTENT.hero.card.initialDebtUSD; // $6,000

  // Pure mathematical simulation using shared math functions
  const simulationResults = useMemo(() => {
    // 0.15 BTC at $66,666.67 initial price = $10,000 collateral
    const collateralWei = 150000000000000000n; // 0.15e18
    const debtWei = BigInt(initialDebtUSD) * 10n ** 18n; // 6,000e18
    const initialPriceWei = 66666666666666666666666n; // $66,666.67e18
    const triggerICRWei = BigInt(triggerRatio) * 10n ** 16n; // e.g. 135 -> 1.35e18
    const targetICRWei = 1600000000000000000n; // 1.60e18
    const musdReserveWei = BigInt(reserveMusd) * 10n ** 18n;

    // Run pure stress test simulation across 0% to 50% price drops (11 points: step 5%)
    const drops = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
    const dropData = drops.map((dropPct) => {
      const res = simulateStressTest({
        collateral: collateralWei,
        debt: debtWei,
        currentPrice: initialPriceWei,
        priceDropPercent: dropPct,
        triggerICR: triggerICRWei,
        targetICR: targetICRWei,
        maxTipBps: 50,
        musdReserve: musdReserveWei,
        btcReserve: 0n,
        mcr: PROTOCOL_CONSTANTS.MCR,
      });

      const currentCollateralVal = initialCollateralUSD * (1 - dropPct / 100);
      const unprotectedRatio = (currentCollateralVal / initialDebtUSD) * 100;

      // Find final point in simulation points
      const lastPoint = res.points[res.points.length - 1];
      const protectedRatio = lastPoint
        ? Number(lastPoint.protectedICR / 10n ** 15n) / 10
        : unprotectedRatio;

      const remainingDebt = lastPoint
        ? initialDebtUSD - Number(res.defenseSteps.reduce((acc, s) => acc + s.musdRepaid, 0n) / 10n ** 18n)
        : initialDebtUSD;

      return {
        dropPercent: dropPct,
        unprotectedRatio,
        protectedRatio,
        collateralValue: currentCollateralVal,
        debt: remainingDebt,
        isDefended: res.hasDefended,
      };
    });

    return dropData;
  }, [initialCollateralUSD, initialDebtUSD, triggerRatio, reserveMusd]);

  // Active point state derived from current btcPriceDrop
  const activeDataPoint = useMemo(() => {
    // Find closest data point
    const closest = simulationResults.reduce((prev, curr) =>
      Math.abs(curr.dropPercent - btcPriceDrop) < Math.abs(prev.dropPercent - btcPriceDrop)
        ? curr
        : prev
    );
    return closest;
  }, [simulationResults, btcPriceDrop]);

  // Formatted ICR for hero and simulator
  const heroInitialICR = useMemo(() => {
    const icrBig = computeICR(
      BigInt(initialCollateralUSD) * 10n ** 18n,
      BigInt(initialDebtUSD) * 10n ** 18n,
      10n ** 18n
    );
    return (Number(icrBig / 10n ** 15n) / 10).toFixed(1); // 166.7%
  }, [initialCollateralUSD, initialDebtUSD]);

  const activeICRFormatted = activeDataPoint.protectedRatio.toFixed(1);

  // Health state based on active protected ratio
  let healthState: 'healthy' | 'caution' | 'danger' = 'healthy';
  let healthLabel = 'Healthy';
  if (activeDataPoint.protectedRatio < 130) {
    healthState = 'danger';
    healthLabel = 'Danger';
  } else if (activeDataPoint.protectedRatio < 160) {
    healthState = 'caution';
    healthLabel = 'Caution';
  }

  // Force editorial light cream palette for landing page
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Scroll Reveal Refs
  const heroReveal = useScrollReveal<HTMLDivElement>(0.05);
  const problemReveal = useScrollReveal<HTMLDivElement>(0.05);
  const stepsReveal = useScrollReveal<HTMLDivElement>(0.05);
  const simulatorReveal = useScrollReveal<HTMLDivElement>(0.05);
  const beliefReveal = useScrollReveal<HTMLDivElement>(0.05);

  // Dedicated Artwork Slide-in Reveal Refs
  const problemArtworkReveal = useScrollReveal<HTMLDivElement>({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
    resetOnExit: false,
  });
  const pointingArmReveal = useScrollReveal<HTMLDivElement>({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
    resetOnExit: false,
  });
  const beliefDavidReveal = useScrollReveal<HTMLDivElement>({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
    resetOnExit: false,
  });

  // SVG Chart path generation matching 80% to 200% Y-axis
  const chartSvgData = useMemo(() => {
    const width = 600;
    const height = 180;
    const minRatio = 80;
    const maxRatio = 200;

    const mapPoint = (dropPct: number, ratio: number) => {
      const x = (dropPct / 50) * width;
      const normalizedY = 1 - (ratio - minRatio) / (maxRatio - minRatio);
      const y = Math.max(10, Math.min(height - 10, normalizedY * height));
      return { x, y };
    };

    // Unprotected path (without Ballast)
    const unprotPoints = simulationResults.map((pt) =>
      mapPoint(pt.dropPercent, pt.unprotectedRatio)
    );
    let unprotPath = `M ${unprotPoints[0].x} ${unprotPoints[0].y}`;
    for (let i = 0; i < unprotPoints.length - 1; i++) {
      const p0 = unprotPoints[i];
      const p1 = unprotPoints[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      unprotPath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    // Protected path (with Ballast)
    const protPoints = simulationResults.map((pt) =>
      mapPoint(pt.dropPercent, pt.protectedRatio)
    );
    let protPath = `M ${protPoints[0].x} ${protPoints[0].y}`;
    for (let i = 0; i < protPoints.length - 1; i++) {
      const p0 = protPoints[i];
      const p1 = protPoints[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      protPath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const protAreaPath = `${protPath} L ${width} ${height} L 0 ${height} Z`;

    // 110% Liquidation Line Y position
    const liquidationY = height * (1 - (110 - minRatio) / (maxRatio - minRatio));

    return {
      unprotPath,
      protPath,
      protAreaPath,
      protPoints,
      liquidationY,
    };
  }, [simulationResults]);

  return (
    <div className="min-h-screen bg-[#F7EFE4] text-[#0A1521] flex flex-col font-sans selection:bg-[#CA461E] selection:text-white overflow-x-hidden paper-texture">
      <Header />

      <main className="grow">
        {/* ========================================================= */}
        {/* SECTION 1: HERO SECTION                                   */}
        {/* ========================================================= */}
        <section
          className="relative pt-6 sm:pt-10 md:pt-12 pb-16 sm:pb-24 lg:pb-32 overflow-hidden bg-cover bg-right-top bg-no-repeat"
          style={{ backgroundImage: "url('/assets/landing/hero-david.webp')" }}
        >
          {/* Responsive overlay on mobile for pristine text contrast over background artwork */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#F7EFE4]/92 via-[#F7EFE4]/75 to-transparent lg:hidden pointer-events-none" />

          <div className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-0">

              {/* Left Column: Headlines & CTA Buttons */}
              <div
                ref={heroReveal.ref}
                className={`lg:col-span-5 space-y-5 sm:space-y-6 z-10 lg:pr-8 transition-all duration-700 ease-out ${
                  heroReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                {/* Eyebrow */}
                <div className="inline-flex items-center">
                  <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-[0.2em] uppercase text-[#525C66]">
                    {LANDING_CONTENT.hero.eyebrow}
                  </span>
                </div>

                {/* Primary Headline (responsive sizing) */}
                <h1 className="text-[38px] min-[400px]:text-[46px] sm:text-6xl md:text-7xl lg:text-[84px] xl:text-[92px] font-serif font-normal tracking-tight text-[#0A1521] leading-[0.98] sm:leading-[0.95]">
                  {LANDING_CONTENT.hero.headline.line1}<br />
                  {LANDING_CONTENT.hero.headline.line2}<br />
                  <span className="italic font-serif text-[#CA461E]">
                    {LANDING_CONTENT.hero.headline.line3ItalicEmber}
                  </span>
                </h1>

                {/* Subtitle / Body */}
                <p className="text-base sm:text-lg font-sans text-[#2C3642] leading-relaxed max-w-[460px]">
                  {LANDING_CONTENT.hero.body}
                </p>

                {/* CTA Action Buttons */}
                <div className="flex flex-wrap items-center gap-3.5 sm:gap-4 pt-1">
                  <Link href={LANDING_CONTENT.hero.ctaPrimary.href}>
                    <button className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full bg-[#0A1521] text-white font-sans font-medium text-sm hover:bg-[#CA461E] transition-all duration-200 shadow-sm hover:shadow">
                      <span>{LANDING_CONTENT.hero.ctaPrimary.label}</span>
                      <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </Link>
                  <a href={LANDING_CONTENT.hero.ctaSecondary.href}>
                    <button className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-full border border-[#0A1521]/20 bg-transparent text-[#0A1521] font-sans font-medium text-sm hover:border-[#0A1521] hover:text-[#CA461E] transition-all duration-200">
                      <span>{LANDING_CONTENT.hero.ctaSecondary.label}</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </a>
                </div>

                {/* Three proof items in one row with clean line icons */}
                <div className="pt-6 sm:pt-8 border-t border-[#0A1521]/10 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 max-w-lg">
                  {/* Proof Item 1: Automatic defense */}
                  <div className="flex items-start gap-3">
                    <Zap className="w-5 h-5 text-[#CA461E] stroke-[2.2] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0A1521]">
                        {LANDING_CONTENT.hero.proofItems[0].title}
                      </h3>
                      <p className="text-[11px] font-sans text-[#525C66] mt-0.5 leading-tight">
                        {LANDING_CONTENT.hero.proofItems[0].description}
                      </p>
                    </div>
                  </div>

                  {/* Proof Item 2: Stress-tested */}
                  <div className="flex items-start gap-3">
                    <TrendingDown className="w-5 h-5 text-[#0A1521] stroke-[2.2] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0A1521]">
                        {LANDING_CONTENT.hero.proofItems[1].title}
                      </h3>
                      <p className="text-[11px] font-sans text-[#525C66] mt-0.5 leading-tight">
                        {LANDING_CONTENT.hero.proofItems[1].description}
                      </p>
                    </div>
                  </div>

                  {/* Proof Item 3: You hold the keys */}
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-[#2D6A2E] stroke-[2.2] shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0A1521]">
                        {LANDING_CONTENT.hero.proofItems[2].title}
                      </h3>
                      <p className="text-[11px] font-sans text-[#525C66] mt-0.5 leading-tight">
                        {LANDING_CONTENT.hero.proofItems[2].description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Collage & Position Card */}
              <div className="lg:col-span-7 relative flex flex-col lg:flex-row justify-end pr-0 mt-8 sm:mt-12 lg:mt-0">

                {/* Handwritten Annotation top right */}
                <div className="hidden sm:block absolute -top-8 right-8 sm:right-24 lg:right-52 xl:right-64 z-30 pointer-events-none select-none">
                  <Handwritten arrow="curved-down-left" rotation="-rotate-3">
                    {LANDING_CONTENT.hero.note}
                  </Handwritten>
                </div>

                {/* Hero Artwork Spacer / Position Card Container */}
                <div className="relative w-full max-w-[820px] lg:max-w-[880px] xl:max-w-[940px] ml-auto mr-0 aspect-auto lg:aspect-[1024/575]">
                  {/* Position Card: naturally placed on mobile/tablet, overlapping absolute on desktop */}
                  <div className="relative lg:absolute -bottom-0 lg:-bottom-40 xl:-bottom-44 right-auto lg:right-6 xl:right-8 z-20 mx-auto lg:mx-0 w-full max-w-[340px] sm:max-w-[360px] bg-white rounded-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(10,21,33,0.12)] border border-[#0A1521]/10 transition-transform duration-300 hover:scale-[1.01]">
                    <div className="flex items-center justify-between pb-3 border-b border-[#0A1521]/08">
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-bold text-sm sm:text-base text-[#0A1521]">
                          {LANDING_CONTENT.hero.card.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-[#0A1521]/05 text-[#525C66] uppercase tracking-wider">
                          {LANDING_CONTENT.hero.card.tag}
                        </span>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#BCD99F] text-[#2D6A2E]">
                        {LANDING_CONTENT.hero.card.pill}
                      </span>
                    </div>

                    <div className="pt-3">
                      <span className="text-[11px] font-mono text-[#525C66] uppercase tracking-wider block">
                        {LANDING_CONTENT.hero.card.ratioLabel}
                      </span>
                      <div className="text-3xl sm:text-4xl font-mono font-bold text-[#0A1521] mt-0.5 tracking-tight">
                        {heroInitialICR}%
                      </div>

                      {/* Calibrated Gauge Bar (110% to 200% scale) */}
                      <div className="mt-4 space-y-1.5">
                        <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-[#E16839] via-[#F5AF61] to-[#96B987]">
                          {/* Needle Indicator calibrated to 166.7% */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#0A1521] border-2 border-white shadow-md transition-all duration-300"
                            style={{ left: '63%' }}
                          />
                        </div>

                        {/* Three Tick Labels */}
                        <div className="flex justify-between text-[10px] font-mono text-[#525C66] pt-0.5">
                          <span>{LANDING_CONTENT.hero.card.tickLabels.liquidation}</span>
                          <span>{LANDING_CONTENT.hero.card.tickLabels.trigger}</span>
                          <span className="text-right">{LANDING_CONTENT.hero.card.tickLabels.target}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 2: THE PROBLEM (ARCH WINDOW FLORENCE DUOMO)        */}
        {/* ========================================================= */}
        <section
          id="problem"
          ref={problemReveal.ref}
          className="py-14 sm:py-20 md:py-28 overflow-hidden"
        >
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-8 lg:gap-0">

              {/* Left Column: Problem Narrative */}
              <div
                className={`lg:col-span-5 space-y-5 sm:space-y-6 lg:pr-8 transition-all duration-700 ease-out ${
                  problemReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                }`}
              >
                <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-[#525C66] font-semibold block">
                  {LANDING_CONTENT.problem.eyebrow}
                </span>

                {/* 4-Line Headline matching exact line count and shape */}
                <h2 className="text-4xl sm:text-5xl lg:text-[72px] font-serif font-normal text-[#0A1521] leading-[1.02] sm:leading-[1.0] tracking-tight">
                  {LANDING_CONTENT.problem.headline.line1}<br />
                  {LANDING_CONTENT.problem.headline.line2}<br />
                  <span className="italic font-serif text-[#CA461E]">
                    {LANDING_CONTENT.problem.headline.line3ItalicEmber}<br />
                    {LANDING_CONTENT.problem.headline.line4ItalicEmber}
                  </span>
                </h2>

                <p className="text-base sm:text-lg font-sans text-[#2C3642] leading-relaxed max-w-[460px]">
                  {LANDING_CONTENT.problem.body}
                </p>

                <div className="pt-2">
                  <a
                    href={LANDING_CONTENT.problem.link.href}
                    className="inline-flex items-center gap-2 text-sm font-sans font-semibold text-[#0A1521] hover:text-[#CA461E] transition-colors group"
                  >
                    <span>{LANDING_CONTENT.problem.link.label}</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Right Column: Arch Window Duomo Collage Bleeding Flush to Right Edge */}
              <div
                ref={problemArtworkReveal.ref}
                className={`lg:col-span-7 relative flex justify-end pr-0 mt-6 lg:mt-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
                  problemArtworkReveal.isVisible
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-8 sm:translate-x-16 lg:translate-x-48'
                }`}
              >
                {/* Handwritten Note with underline stroke */}
                <div className="absolute top-2 sm:top-6 right-4 sm:right-12 lg:right-20 z-20 pointer-events-none select-none">
                  <Handwritten underline rotation="-rotate-3">
                    {LANDING_CONTENT.problem.note}
                  </Handwritten>
                </div>

                {/* Arch Window Duomo Artwork (priority loading ensures image renders in captures) */}
                <div className="relative w-full max-w-[480px] sm:max-w-[620px] lg:max-w-[780px] xl:max-w-[860px] ml-auto mr-0 select-none">
                  <Image
                    src="/assets/landing/ballast-problem.png"
                    alt="Tuscan arch window framing Florence Duomo with lantern and torn textures"
                    width={576}
                    height={498}
                    priority={true}
                    loading="eager"
                    className="w-full h-auto object-contain filter drop-shadow-sm select-none"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 3: HOW IT WORKS                                   */}
        {/* ========================================================= */}
        <section
          id="how-it-works"
          ref={stepsReveal.ref}
          className="relative py-14 sm:py-20 md:py-28 overflow-hidden"
        >
          {/* Orange Watercolor Blob at Left Edge */}
          <div className="absolute -left-2 top-4 w-20 sm:w-28 md:w-36 h-auto pointer-events-none select-none z-0">
            <Image
              src="/assets/landing/orange-blob.webp"
              alt=""
              width={120}
              height={275}
              className="w-full h-auto object-contain opacity-90"
              aria-hidden="true"
            />
          </div>

          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20 relative z-10">

            {/* Top Row: Heading on Left, Pointing Arm Entering From Right Edge */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 sm:mb-16 lg:mb-20">
              <div>
                <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-[#525C66] font-semibold block mb-2.5">
                  {LANDING_CONTENT.howItWorks.eyebrow}
                </span>
                <h2 className="text-4xl sm:text-5xl lg:text-[70px] font-serif font-normal text-[#0A1521] leading-tight">
                  {LANDING_CONTENT.howItWorks.headline.regular}{' '}
                  <span className="italic font-serif text-[#CA461E]">
                    {LANDING_CONTENT.howItWorks.headline.highlight}
                  </span>
                </h2>
              </div>

              {/* Pointing Arm Artwork with Handwritten Note */}
              <div
                ref={pointingArmReveal.ref}
                className={`relative flex items-center gap-3 sm:gap-4 self-end lg:self-auto mr-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
                  pointingArmReveal.isVisible
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-8 sm:translate-x-16 lg:translate-x-52'
                }`}
              >
                {/* Handwritten Tag pointing right */}
                <div className="mb-2 sm:mb-4 pointer-events-none select-none shrink-0">
                  <Handwritten arrow="curved-right" rotation="-rotate-6">
                    {LANDING_CONTENT.howItWorks.note}
                  </Handwritten>
                </div>

                {/* Classical Marble Pointing Arm Reaching From Screen Edge */}
                <div className="w-[220px] min-[400px]:w-[280px] sm:w-[420px] lg:w-[680px] xl:w-[760px] shrink-0 select-none">
                  <Image
                    src="/assets/landing/pointing-arm.webp"
                    alt=""
                    width={1024}
                    height={356}
                    priority={true}
                    loading="eager"
                    className="w-full h-auto object-contain filter drop-shadow-sm"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* Three Step Columns with Serif Numerals, Underlined Titles, Hairline Dividers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 pt-4">
              {LANDING_CONTENT.howItWorks.steps.map((st, idx) => (
                <div
                  key={st.number}
                  className={`space-y-3.5 ${
                    idx === 0
                      ? 'md:pr-10 lg:pr-14'
                      : idx === 1
                      ? 'pt-6 border-t border-[#0A1521]/10 md:border-t-0 md:pt-0 md:px-10 lg:px-14 md:border-l md:border-[#0A1521]/15'
                      : 'pt-6 border-t border-[#0A1521]/10 md:border-t-0 md:pt-0 md:pl-10 lg:pl-14 md:border-l md:border-[#0A1521]/15'
                  }`}
                >
                  <span className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0A1521] block">
                    {st.number}
                  </span>
                  <div className="flex items-center gap-2.5 text-[#0A1521] pt-1">
                    {idx === 0 ? (
                      <ShieldCheck className="w-5 h-5 text-[#CA461E] stroke-[2.2] shrink-0" />
                    ) : idx === 1 ? (
                      <TrendingDown className="w-5 h-5 text-[#CA461E] stroke-[2.2] shrink-0" />
                    ) : (
                      <Zap className="w-5 h-5 text-[#CA461E] stroke-[2.2] shrink-0" />
                    )}
                    <h3 className="text-lg sm:text-xl font-serif font-bold text-[#0A1521] underline decoration-1 underline-offset-4">
                      {st.title}
                    </h3>
                  </div>
                  <p className="text-sm sm:text-base font-sans text-[#525C66] leading-relaxed">
                    {st.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 4: STRESS TEST SIMULATOR (RUST PANEL)              */}
        {/* ========================================================= */}
        <section
          id="simulator"
          ref={simulatorReveal.ref}
          className="relative py-14 sm:py-20 md:py-28 overflow-hidden bg-cover bg-left-bottom bg-no-repeat text-white"
          style={{ backgroundImage: "url('/assets/landing/simulator-colosseum.webp')" }}
        >
          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

              {/* Left Column: Heading, Narrative, and CTA button */}
              {/* High contrast text styling ensures WCAG AA compliance (> 4.5:1 ratio on rust) */}
              <div
                className={`lg:col-span-5 space-y-5 sm:space-y-6 transition-all duration-700 ease-out ${
                  simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-[#FFFFFF] font-bold block drop-shadow-sm">
                  {LANDING_CONTENT.simulator.eyebrow}
                </span>

                <h2 className="text-4xl sm:text-5xl lg:text-[70px] font-serif font-normal leading-[1.02] sm:leading-[1.0] tracking-tight text-[#FFFFFF] drop-shadow-sm">
                  {LANDING_CONTENT.simulator.headline.line1}<br />
                  {LANDING_CONTENT.simulator.headline.line2}
                </h2>

                <p className="text-base sm:text-lg font-sans text-[#FFFFFF] leading-relaxed max-w-md drop-shadow-xs">
                  {LANDING_CONTENT.simulator.body}
                </p>

                <div className="pt-2">
                  <Link href={LANDING_CONTENT.simulator.cta.href}>
                    <button className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full bg-[#0A1521] text-white font-sans font-medium text-sm hover:bg-white hover:text-[#C1411C] transition-all duration-200 shadow-md">
                      <span>{LANDING_CONTENT.simulator.cta.label}</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Right Column: Wide Interactive Position Simulator Card */}
              <div
                className={`lg:col-span-7 flex justify-end w-full transition-all duration-700 ease-out ${
                  simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <div className="bg-white text-[#0A1521] rounded-2xl sm:rounded-3xl p-4 sm:p-7 md:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.25)] w-full max-w-[740px] xl:max-w-[800px]">

                  {/* Card Header & BTC Drop Preset Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 pb-5 sm:pb-6 border-b border-[#0A1521]/10">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-bold text-lg sm:text-2xl text-[#0A1521]">
                        {LANDING_CONTENT.simulator.card.title}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm bg-[#0A1521]/05 text-[#525C66] uppercase tracking-wider font-semibold">
                        {LANDING_CONTENT.simulator.card.scenarioTag}
                      </span>
                    </div>

                    {/* BTC Drop Preset Selector Pills */}
                    <div className="flex items-center rounded-full bg-[#F7EFE4] p-1 text-xs font-mono overflow-x-auto self-start sm:self-auto max-w-full">
                      {LANDING_CONTENT.simulator.card.presets.map((preset) => {
                        const dropNum = parseInt(preset.replace('-', '').replace('%', ''), 10);
                        const isSelected = btcPriceDrop === dropNum;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              setBtcPriceDrop(dropNum);
                              setActiveChartIndex(dropNum / 5);
                            }}
                            className={`px-2.5 sm:px-3 py-1 rounded-full text-xs transition-all duration-150 shrink-0 ${
                              isSelected
                                ? 'bg-[#0A1521] text-white font-bold shadow-sm'
                                : 'text-[#525C66] hover:text-[#0A1521]'
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top 3 Live Calculated Metric Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4 py-5 sm:py-6 border-b border-[#0A1521]/10">
                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-4">
                      <span className="text-[11px] font-mono uppercase text-[#525C66] block">
                        {LANDING_CONTENT.simulator.card.metricLabels.ratio}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-2xl sm:text-3xl font-mono font-bold text-[#0A1521] tracking-tight">
                          {activeICRFormatted}%
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                            healthState === 'healthy'
                              ? 'bg-[#BCD99F] text-[#2D6A2E]'
                              : healthState === 'caution'
                              ? 'bg-[#F5AF61]/30 text-[#B7791F]'
                              : 'bg-[#E16839]/20 text-[#E16839]'
                          }`}
                        >
                          {healthLabel}
                        </span>
                      </div>
                    </div>

                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-4">
                      <span className="text-[11px] font-mono uppercase text-[#525C66] block">
                        {LANDING_CONTENT.simulator.card.metricLabels.debt}
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[#0A1521] mt-1 tracking-tight">
                        ${Math.round(activeDataPoint.debt).toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-4">
                      <span className="text-[11px] font-mono uppercase text-[#525C66] block">
                        {LANDING_CONTENT.simulator.card.metricLabels.collateral}
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[#0A1521] mt-1 tracking-tight">
                        ${Math.round(activeDataPoint.collateralValue).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Interactive SVG Chart with Two Lines (With vs Without Ballast) */}
                  <div className="py-5 sm:py-6">
                    {/* Screen Reader Alternative Data Table inside sr-only wrapper */}
                    <div className="sr-only" aria-hidden="false">
                      <table>
                        <caption>Stress Test Simulation Data: Ratio vs Price Drawdown</caption>
                        <thead>
                          <tr>
                            <th scope="col">BTC Drop</th>
                            <th scope="col">Without Ballast Ratio</th>
                            <th scope="col">With Ballast Ratio</th>
                            <th scope="col">Defended</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simulationResults.map((r) => (
                            <tr key={r.dropPercent}>
                              <td>-{r.dropPercent}%</td>
                              <td>{r.unprotectedRatio.toFixed(1)}%</td>
                              <td>{r.protectedRatio.toFixed(1)}%</td>
                              <td>{r.isDefended ? 'Yes' : 'No'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="relative h-44 sm:h-48 w-full">
                      <svg
                        viewBox="0 0 600 180"
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                        role="region"
                        aria-label="Interactive stress test curve chart"
                      >
                        <defs>
                          <linearGradient id="simAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#CA461E" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#CA461E" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Reference lines matching 110% Liquidation, 150%, 200% */}
                        {/* 110% Liquidation line (Shared MCR) */}
                        <line
                          x1="0"
                          y1={chartSvgData.liquidationY}
                          x2="600"
                          y2={chartSvgData.liquidationY}
                          stroke="#E04A4A"
                          strokeWidth="1.5"
                          strokeDasharray="4 4"
                        />
                        <text
                          x="5"
                          y={chartSvgData.liquidationY - 4}
                          fill="#E04A4A"
                          fontSize="9"
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          {LANDING_CONTENT.simulator.card.chartLegend.liquidation} (MCR)
                        </text>

                        {/* 150% Reference */}
                        <line x1="0" y1="75" x2="600" y2="75" stroke="#0A1521" strokeOpacity="0.08" strokeDasharray="3 3" />
                        <text x="5" y="71" fill="#8C877D" fontSize="9" fontFamily="monospace">150% Target</text>

                        {/* 200% Reference */}
                        <line x1="0" y1="15" x2="600" y2="15" stroke="#0A1521" strokeOpacity="0.08" strokeDasharray="3 3" />
                        <text x="5" y="24" fill="#8C877D" fontSize="9" fontFamily="monospace">200% Safe</text>

                        {/* Vertical Indicator Line for Selected Point */}
                        {chartSvgData.protPoints[activeChartIndex] && (
                          <line
                            x1={chartSvgData.protPoints[activeChartIndex].x}
                            y1={chartSvgData.protPoints[activeChartIndex].y}
                            x2={chartSvgData.protPoints[activeChartIndex].x}
                            y2="175"
                            stroke="#0A1521"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                            opacity="0.6"
                          />
                        )}

                        {/* Soft Ember Area Fill */}
                        <path d={chartSvgData.protAreaPath} fill="url(#simAreaGradient)" />

                        {/* Without Ballast (Muted dashed line) */}
                        <path
                          d={chartSvgData.unprotPath}
                          fill="none"
                          stroke="#8F8A7C"
                          strokeWidth="2"
                          strokeDasharray="5 4"
                          strokeLinecap="round"
                        />

                        {/* With Ballast (Solid Ember line) */}
                        <path
                          d={chartSvgData.protPath}
                          fill="none"
                          stroke="#CA461E"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        {/* Interactive Data Points along With Ballast curve */}
                        {chartSvgData.protPoints.map((pt, i) => (
                          <g
                            key={i}
                            className="cursor-pointer"
                            tabIndex={0}
                            role="button"
                            aria-label={`Step ${simulationResults[i].dropPercent}% drop: protected ratio ${simulationResults[i].protectedRatio.toFixed(1)}%`}
                            onClick={() => {
                              setActiveChartIndex(i);
                              setBtcPriceDrop(simulationResults[i].dropPercent);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                setActiveChartIndex(i);
                                setBtcPriceDrop(simulationResults[i].dropPercent);
                              }
                            }}
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={activeChartIndex === i ? 6 : 4}
                              fill={activeChartIndex === i ? '#0A1521' : '#CA461E'}
                              stroke="white"
                              strokeWidth={activeChartIndex === i ? 2 : 1.5}
                            />
                          </g>
                        ))}
                      </svg>

                      {/* Tooltip on Active Point clamped to [12%, 88%] to avoid edge overflow */}
                      {chartSvgData.protPoints[activeChartIndex] && (
                        <div
                          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full -top-1 px-2.5 sm:px-3 py-1.5 bg-white text-[#0A1521] border border-[#0A1521]/10 rounded-xl text-xs font-mono shadow-xl text-center"
                          style={{
                            left: `${Math.max(12, Math.min(88, (activeChartIndex / (simulationResults.length - 1)) * 100))}%`,
                          }}
                        >
                          <div className="font-bold text-xs sm:text-sm text-[#CA461E]">
                            {simulationResults[activeChartIndex].protectedRatio.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-[#525C66]">
                            -{simulationResults[activeChartIndex].dropPercent}% BTC drop
                          </div>
                          <div className="text-[9px] text-[#8F8A7C]">
                            Unprotected: {simulationResults[activeChartIndex].unprotectedRatio.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chart Legend & Caption */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 border-t border-[#0A1521]/10 text-xs font-mono">
                      <div className="flex items-center gap-4 text-[#525C66]">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-0.5 bg-[#CA461E] rounded-full inline-block" />
                          <span className="text-[#0A1521] font-semibold">{LANDING_CONTENT.simulator.card.chartLegend.withBallast}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-0.5 bg-[#8F8A7C] border-b border-dashed inline-block" />
                          <span>{LANDING_CONTENT.simulator.card.chartLegend.withoutBallast}</span>
                        </span>
                      </div>
                      <div className="text-[10px] text-[#525C66] text-left sm:text-right">
                        {LANDING_CONTENT.simulator.card.caption}
                      </div>
                    </div>
                  </div>

                  {/* Three Slider Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-3.5 pt-4 border-t border-[#0A1521]/10">

                    {/* Slider 1: BTC Price Change (0% to -50%) */}
                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#525C66]">{LANDING_CONTENT.simulator.card.sliderLabels.drop}</span>
                        <span className="font-bold text-[#0A1521]">-{btcPriceDrop}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        step="1"
                        value={btcPriceDrop}
                        aria-label={LANDING_CONTENT.simulator.card.sliderLabels.drop}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setBtcPriceDrop(val);
                          setActiveChartIndex(Math.round(val / 5));
                        }}
                        style={{
                          background: `linear-gradient(to right, #CA461E 0%, #CA461E ${(btcPriceDrop / 50) * 100}%, rgba(10,21,33,0.12) ${(btcPriceDrop / 50) * 100}%, rgba(10,21,33,0.12) 100%)`,
                        }}
                        className="w-full accent-[#CA461E] cursor-pointer h-1.5 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#525C66]">
                        <span>0%</span>
                        <span>-50%</span>
                      </div>
                    </div>

                    {/* Slider 2: Reserve MUSD */}
                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#525C66]">{LANDING_CONTENT.simulator.card.sliderLabels.reserve}</span>
                        <span className="font-bold text-[#0A1521]">${reserveMusd.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="3000"
                        step="100"
                        value={reserveMusd}
                        aria-label={LANDING_CONTENT.simulator.card.sliderLabels.reserve}
                        onChange={(e) => setReserveMusd(parseInt(e.target.value, 10))}
                        style={{
                          background: `linear-gradient(to right, #CA461E 0%, #CA461E ${(reserveMusd / 3000) * 100}%, rgba(10,21,33,0.12) ${(reserveMusd / 3000) * 100}%, rgba(10,21,33,0.12) 100%)`,
                        }}
                        className="w-full accent-[#CA461E] cursor-pointer h-1.5 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#525C66]">
                        <span>$0</span>
                        <span>$3,000</span>
                      </div>
                    </div>

                    {/* Slider 3: Trigger ratio */}
                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#525C66]">{LANDING_CONTENT.simulator.card.sliderLabels.trigger}</span>
                        <span className="font-bold text-[#0A1521]">{triggerRatio}%</span>
                      </div>
                      <input
                        type="range"
                        min="115"
                        max="150"
                        step="1"
                        value={triggerRatio}
                        aria-label={LANDING_CONTENT.simulator.card.sliderLabels.trigger}
                        onChange={(e) => setTriggerRatio(parseInt(e.target.value, 10))}
                        style={{
                          background: `linear-gradient(to right, #CA461E 0%, #CA461E ${((triggerRatio - 115) / 35) * 100}%, rgba(10,21,33,0.12) ${((triggerRatio - 115) / 35) * 100}%, rgba(10,21,33,0.12) 100%)`,
                        }}
                        className="w-full accent-[#CA461E] cursor-pointer h-1.5 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#525C66]">
                        <span>115%</span>
                        <span>150%</span>
                      </div>
                    </div>

                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 5: OUR BELIEF (STICKING TO LEFT & RIGHT EDGES)     */}
        {/* ========================================================= */}
        <section
          id="belief"
          ref={beliefReveal.ref}
          className="relative py-12 sm:py-16 md:py-20 overflow-hidden bg-cover bg-right-top bg-no-repeat"
          style={{ backgroundImage: "url('/assets/landing/belief-facade.webp')", backgroundPosition: 'right top' }}
        >
          {/* David Statue Cutout Anchored Directly to the Bottom-Left Border of Section */}
          <div
            ref={beliefDavidReveal.ref}
            className={`absolute -bottom-5 sm:-bottom-6 lg:-bottom-8 left-0 z-10 w-full max-w-[200px] min-[400px]:max-w-[260px] sm:max-w-[380px] lg:max-w-[500px] xl:max-w-[540px] shrink-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform select-none pointer-events-none opacity-40 sm:opacity-90 lg:opacity-100 ${
              beliefDavidReveal.isVisible
                ? 'translate-x-0'
                : '-translate-x-16 sm:-translate-x-32 lg:-translate-x-56'
            }`}
          >
            {/* Handwritten Tag top left */}
            <div className="hidden sm:block absolute -top-10 left-6 sm:left-12 lg:left-14 z-20 pointer-events-none select-none">
              <Handwritten arrow="curved-down-left" rotation="-rotate-3">
                {LANDING_CONTENT.belief.note}
              </Handwritten>
            </div>

            {/* Large David Statue Cutout starting flush from bottom left border */}
            <div className="relative w-full -ml-0 lg:-ml-6 xl:-ml-8">
              <Image
                src="/assets/landing/belief-david.png"
                alt=""
                width={1024}
                height={682}
                priority={true}
                loading="eager"
                className="w-full h-auto object-contain object-bottom filter drop-shadow-sm select-none"
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20 relative z-10 flex flex-col lg:flex-row items-center justify-between min-h-[420px] sm:min-h-[460px] lg:min-h-[480px]">

            {/* Left spacer for desktop so middle text is centered between David and Building Facade */}
            <div className="hidden lg:block w-[300px] xl:w-[380px] shrink-0 pointer-events-none" />

            {/* Middle Part: Our Belief Narrative & Centered CTA Buttons */}
            <div
              className={`max-w-xl px-2 sm:px-6 my-6 lg:my-0 space-y-4 sm:space-y-5 text-center transition-all duration-700 ease-out ${
                beliefReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
            >
              <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-[#525C66] font-semibold block">
                {LANDING_CONTENT.belief.eyebrow}
              </span>

              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-[46px] font-serif font-normal text-[#0A1521] leading-[1.1] tracking-tight">
                {LANDING_CONTENT.belief.headline.line1}<br />
                {LANDING_CONTENT.belief.headline.line2}<br />
                {LANDING_CONTENT.belief.headline.line3}
              </h2>

              <p className="text-sm sm:text-base font-sans text-[#2C3642] leading-relaxed max-w-md mx-auto">
                {LANDING_CONTENT.belief.body}
              </p>

              {/* CTAs Centered */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <Link href={LANDING_CONTENT.belief.ctaPrimary.href}>
                  <button className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-[#0A1521] text-white font-sans font-medium text-sm hover:bg-[#CA461E] transition-all duration-200 shadow-sm">
                    <span>{LANDING_CONTENT.belief.ctaPrimary.label}</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </button>
                </Link>
                <Link href={LANDING_CONTENT.belief.ctaSecondary.href}>
                  <button className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full border border-[#0A1521]/20 bg-transparent text-[#0A1521] font-sans font-medium text-sm hover:border-[#0A1521] hover:text-[#CA461E] transition-all duration-200">
                    <span>{LANDING_CONTENT.belief.ctaSecondary.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2]" />
                  </button>
                </Link>
              </div>

              {/* Mandatory Risk Disclosure Caption under Buttons */}
              <p className="text-xs font-sans text-[#525C66] max-w-md mx-auto leading-normal pt-1">
                {LANDING_CONTENT.belief.caption}
              </p>
            </div>

            {/* Right Part: Angled Handwritten Stamp Tag positioned at bottom right */}
            <div
              className={`w-full lg:w-[260px] xl:w-[320px] shrink-0 relative flex justify-center lg:justify-end pr-0 self-end transition-all duration-700 ease-out ${
                beliefReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
              }`}
            >
              <div className="pb-3 sm:pb-4 pointer-events-none select-none">
                <div className="inline-block px-3.5 py-1.5 border border-dashed border-[#CA461E] bg-[#F7EFE4]/95 backdrop-blur-sm rounded-sm font-hand text-xs sm:text-sm font-bold text-[#CA461E] rotate-6 select-none shadow-sm leading-tight text-center">
                  {LANDING_CONTENT.belief.stamp}
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* SECTION 6: EDITORIAL FOOTER                                */}
      {/* ========================================================= */}
      <footer className="border-t border-[#0A1521]/10 bg-[#EFE6D9] text-[#0A1521]">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 xl:px-20 py-12 sm:py-16 md:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-8 lg:gap-12 items-start pb-12 sm:pb-14 border-b border-[#0A1521]/10">

            {/* Identity & Mission */}
            <div className="md:col-span-3 space-y-4">
              <Link href="/" className="flex items-center gap-2.5 group">
                <span className="relative flex items-center justify-center shrink-0">
                  <Image
                    src="/logo.png"
                    alt="Ballast Logo"
                    width={32}
                    height={32}
                    className="w-7 h-7 object-contain group-hover:scale-105 transition-transform"
                  />
                </span>
                <span className="font-serif font-bold text-lg text-[#0A1521] tracking-[0.18em] uppercase leading-none group-hover:text-[#CA461E] transition-colors">
                  {BRAND_NAME}
                </span>
              </Link>

              <p className="text-xs sm:text-sm font-sans text-[#525C66] leading-relaxed max-w-sm">
                {LANDING_CONTENT.footer.tagline}
              </p>

              {/* Verified Social Icons */}
              <div className="flex items-center gap-3 pt-1 text-[#2C3642]">
                <a
                  href={LANDING_CONTENT.brand.urls.x}
                  target="_blank"
                  rel="noreferrer"
                  title="Follow on X (@Siddhu_3116)"
                  className="w-8 h-8 rounded-full border border-[#0A1521]/15 flex items-center justify-center hover:text-[#CA461E] hover:border-[#CA461E] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">X</span>
                </a>
                <a
                  href={LANDING_CONTENT.brand.urls.discord}
                  target="_blank"
                  rel="noreferrer"
                  title="Join Mezo Discord"
                  className="w-8 h-8 rounded-full border border-[#0A1521]/15 flex items-center justify-center hover:text-[#CA461E] hover:border-[#CA461E] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">⚑</span>
                </a>
                <a
                  href={LANDING_CONTENT.brand.urls.github}
                  target="_blank"
                  rel="noreferrer"
                  title="GitHub Repository"
                  className="w-8 h-8 rounded-full border border-[#0A1521]/15 flex items-center justify-center hover:text-[#CA461E] hover:border-[#CA461E] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">&lt;/&gt;</span>
                </a>
              </div>
            </div>

            {/* Protocol Column */}
            <div className="md:col-span-2 space-y-2.5 md:border-l md:border-[#0A1521]/10 md:pl-6">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#0A1521] block mb-1">
                Protocol
              </span>
              <ul className="space-y-2 text-xs sm:text-sm font-sans text-[#525C66]">
                {LANDING_CONTENT.footer.protocolLinks.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target={item.href.startsWith('http') ? '_blank' : undefined}
                      rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                      className="hover:text-[#0A1521] transition-colors flex items-center gap-1 group"
                    >
                      <span>{item.label}</span>
                      {item.href.startsWith('http') && (
                        <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                      )}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Smart Contracts Column */}
            <div className="md:col-span-3 space-y-2.5 md:border-l md:border-[#0A1521]/10 md:pl-6">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#0A1521]">
                  Smart Contracts
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#BCD99F]/40 text-[#2D6A2E] font-medium">
                  31611
                </span>
              </div>
              <ul className="space-y-2 text-xs sm:text-sm font-sans text-[#525C66]">
                <li>
                  <a
                    href={`https://explorer.test.mezo.org/address/${MATSNET_DEPLOYMENT.ballastFactory}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#0A1521] transition-colors inline-flex items-center gap-1 group/c"
                  >
                    <span>BallastFactory</span>
                    <span className="font-mono text-[11px] text-[#CA461E] group-hover/c:underline">
                      0x8d5b...cd33
                    </span>
                    <ExternalLink className="w-3 h-3 text-[#525C66] group-hover/c:text-[#CA461E]" />
                  </a>
                </li>
                <li>
                  <a
                    href={`https://explorer.test.mezo.org/address/${MATSNET_DEPLOYMENT.sampleVault}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#0A1521] transition-colors inline-flex items-center gap-1.5 group/c"
                  >
                    <span>BallastVault (Active Vault)</span>
                    <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full bg-[#CA461E]/15 text-[#CA461E] border border-[#CA461E]/30">
                      Most Active
                    </span>
                    <span className="font-mono text-[11px] text-[#CA461E] group-hover/c:underline">
                      0xA506...5D5A
                    </span>
                    <ExternalLink className="w-3 h-3 text-[#525C66] group-hover/c:text-[#CA461E]" />
                  </a>
                </li>
                <li>
                  <a
                    href={`https://explorer.test.mezo.org/address/${MATSNET_DEPLOYMENT.ballastVaultImplementation}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#0A1521] transition-colors inline-flex items-center gap-1 group/c"
                  >
                    <span>BallastVault (Logic)</span>
                    <span className="font-mono text-[11px] text-[#CA461E] group-hover/c:underline">
                      0x8158...a4bc
                    </span>
                    <ExternalLink className="w-3 h-3 text-[#525C66] group-hover/c:text-[#CA461E]" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Community Column */}
            <div className="md:col-span-2 space-y-2.5 md:border-l md:border-[#0A1521]/10 md:pl-6">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#0A1521] block mb-1">
                Community
              </span>
              <ul className="space-y-2 text-xs sm:text-sm font-sans text-[#525C66]">
                {LANDING_CONTENT.footer.communityLinks.map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-[#0A1521] transition-colors flex items-center gap-1 group"
                    >
                      <span>{item.label}</span>
                      <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Widget: Telegram Bot Alerts (replaces unbacked newsletter email capture) */}
            <div className="md:col-span-2 space-y-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#0A1521] block mb-1">
                Alerts
              </span>
              <a
                href={LANDING_CONTENT.footer.alertsWidget.botUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-xl bg-white border border-[#0A1521]/15 p-2 px-3 shadow-xs hover:border-[#CA461E] hover:text-[#CA461E] transition-all group"
              >
                <span className="text-xs font-sans font-medium text-[#0A1521] group-hover:text-[#CA461E] leading-tight">
                  {LANDING_CONTENT.footer.alertsWidget.buttonLabel}
                </span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.2] text-[#0A1521] group-hover:text-[#CA461E] group-hover:translate-x-0.5 transition-transform shrink-0 ml-1.5" />
              </a>
              <div className="flex items-center gap-2 pt-0.5">
                <Link
                  href={LANDING_CONTENT.footer.alertsWidget.appAlertsUrl}
                  className="text-[11px] font-sans text-[#525C66] hover:text-[#0A1521] transition-colors leading-tight"
                >
                  {LANDING_CONTENT.footer.alertsWidget.caption}
                </Link>
                <span className="text-[#525C66]/40 text-[10px]">&middot;</span>
                <Link
                  href="/telegram"
                  className="text-[11px] font-sans text-[#CA461E] hover:underline transition-colors leading-tight font-medium"
                >
                  How it works &amp; setup
                </Link>
              </div>
            </div>

          </div>

          {/* Verified Deployed Contracts Strip */}
          <div className="border-t border-[#0A1521]/10 pt-8 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#CA461E] animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#0A1521]">
                  Verified On-Chain Contracts
                </span>
                <span className="text-[11px] font-mono text-[#525C66]">
                  (Mezo Matsnet Testnet &middot; Chain ID 31611)
                </span>
              </div>
              <a
                href={LANDING_CONTENT.brand.urls.mezoExplorer}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#525C66] hover:text-[#CA461E] transition-colors"
              >
                <span>Mezo Blockscout Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Contract 1: BallastFactory */}
              <div className="p-3.5 rounded-xl border border-[#0A1521]/10 bg-white/70 backdrop-blur-sm shadow-xs flex flex-col justify-between hover:border-[#CA461E]/40 transition-all">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[#0A1521] uppercase tracking-wide">
                      BallastFactory
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#CA461E]/10 text-[#CA461E] font-semibold">
                      Proxy Factory
                    </span>
                  </div>
                  <p className="text-xs font-sans text-[#525C66] mb-2.5">
                    Deterministic minimal proxy factory for autonomous borrower vaults.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#0A1521]/08 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#0A1521]/80">
                    0x8d5b...cd33
                  </span>
                  <div className="flex items-center gap-2.5">
                    <a
                      href="https://github.com/SIDDHUX9/BALLAST/blob/main/packages/contracts/src/BallastFactory.sol"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-[#525C66] hover:text-[#0A1521] transition-colors"
                    >
                      Source
                    </a>
                    <a
                      href={`https://explorer.test.mezo.org/address/${MATSNET_DEPLOYMENT.ballastFactory}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[#CA461E] hover:underline"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Contract 2: Active Borrower Vault (Most Active) */}
              <div className="p-3.5 rounded-xl border border-[#CA461E]/30 bg-white/85 backdrop-blur-sm shadow-xs flex flex-col justify-between hover:border-[#CA461E] transition-all ring-1 ring-[#CA461E]/15">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[#0A1521] uppercase tracking-wide">
                      BallastVault (Active Vault)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#CA461E]/15 text-[#CA461E] font-semibold border border-[#CA461E]/30 flex items-center gap-1">
                      ★ Most Active
                    </span>
                  </div>
                  <p className="text-xs font-sans text-[#525C66] mb-2.5">
                    Primary live borrower defense vault on Matsnet with highest transaction volume and active pre-funded reserves.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#0A1521]/08 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#0A1521]/80">
                    0xA506...5D5A
                  </span>
                  <div className="flex items-center gap-2.5">
                    <a
                      href="https://github.com/SIDDHUX9/BALLAST/blob/main/packages/contracts/src/libraries/BallastMath.sol"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-[#525C66] hover:text-[#0A1521] transition-colors"
                    >
                      Math Lib
                    </a>
                    <a
                      href={`https://explorer.test.mezo.org/address/${MATSNET_DEPLOYMENT.sampleVault}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[#CA461E] hover:underline"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Contract 3: BallastVault Implementation */}
              <div className="p-3.5 rounded-xl border border-[#0A1521]/10 bg-white/70 backdrop-blur-sm shadow-xs flex flex-col justify-between hover:border-[#CA461E]/40 transition-all">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[#0A1521] uppercase tracking-wide">
                      BallastVault (Logic)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#BCD99F] text-[#2D6A2E] font-semibold">
                      Master Impl
                    </span>
                  </div>
                  <p className="text-xs font-sans text-[#525C66] mb-2.5">
                    Master defense execution logic, reserve accounting, and keeper entrypoint.
                  </p>
                </div>
                <div className="pt-2 border-t border-[#0A1521]/08 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[#0A1521]/80">
                    0x8158...a4bc
                  </span>
                  <div className="flex items-center gap-2.5">
                    <a
                      href="https://github.com/SIDDHUX9/BALLAST/blob/main/packages/contracts/src/BallastVault.sol"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-[#525C66] hover:text-[#0A1521] transition-colors"
                    >
                      Source
                    </a>
                    <a
                      href={`https://explorer.test.mezo.org/address/${MATSNET_DEPLOYMENT.ballastVaultImplementation}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-[#CA461E] hover:underline"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar: Copyright & Architectural Florence Duomo Sketch */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="text-xs sm:text-sm font-mono text-[#525C66]">
              {LANDING_CONTENT.footer.copyright}
            </span>

            {/* Handwritten Note + Florence Cathedral Line Art Sketch */}
            <div className="flex items-center gap-5 select-none">
              <Handwritten underline rotation="-rotate-3">
                {LANDING_CONTENT.footer.note}
              </Handwritten>

              <div className="w-28 sm:w-36 h-auto opacity-80 select-none">
                <Image
                  src="/assets/landing/footer-skyline.webp"
                  alt=""
                  width={360}
                  height={272}
                  className="w-full h-auto object-contain"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
