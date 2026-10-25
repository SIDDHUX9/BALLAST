'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '../components/layout/header';
import { BRAND_NAME, BRAND_URLS } from '@ballast/shared';
import {
  Anchor,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Box,
  ShieldCheck,
  Link2,
  Zap,
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
  // Interactive Simulator State
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '1Y'>('1M');
  const [musdPrice, setMusdPrice] = useState<number>(1.0);
  const [collateralValue, setCollateralValue] = useState<number>(10000);
  const [volatilityPercent, setVolatilityPercent] = useState<number>(20);
  const [activeChartPoint, setActiveChartPoint] = useState<number>(4);

  // Derived mathematical metrics for simulator
  const debt = 3000;
  const effectiveDebt = debt * musdPrice;
  const simulatedICR = effectiveDebt > 0 ? (collateralValue / (effectiveDebt * 1.4706)) * 100 : 0;
  const icrFormatted = simulatedICR > 0 ? simulatedICR.toFixed(1) : '226.7';

  // Health state based on ratio
  let healthState: 'healthy' | 'caution' | 'danger' = 'healthy';
  let healthLabel = 'Healthy';
  if (simulatedICR < 130) {
    healthState = 'danger';
    healthLabel = 'Danger';
  } else if (simulatedICR < 175) {
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

  // Dedicated Artwork Slide-in Reveal Refs (animate as user scrolls into view)
  const problemArtworkReveal = useScrollReveal<HTMLDivElement>({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
    resetOnExit: true,
  });
  const pointingArmReveal = useScrollReveal<HTMLDivElement>({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
    resetOnExit: true,
  });
  const beliefDavidReveal = useScrollReveal<HTMLDivElement>({
    threshold: 0.1,
    rootMargin: '0px 0px -40px 0px',
    resetOnExit: true,
  });

  // Chart points data generated dynamically based on active timeframe and ICR
  const chartPoints = useMemo(() => {
    const base = simulatedICR > 0 ? simulatedICR : 226.7;
    const vFactor = volatilityPercent / 100;
    const offsets = [-0.08, 0.05, -0.03, 0.09, 0.0, -0.04, 0.02];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

    return offsets.map((offset, idx) => {
      const val = Math.max(90, Math.min(320, base * (1 + offset * vFactor)));
      return {
        label: months[idx],
        value: val,
        date: `${months[idx]} 14, 2026`,
      };
    });
  }, [simulatedICR, volatilityPercent]);

  // SVG Chart path generation matching 100%/200%/300% axis
  const chartSvgPath = useMemo(() => {
    const width = 600;
    const height = 180;
    const minVal = 80;
    const maxVal = 320;

    const points = chartPoints.map((pt, idx) => {
      const x = (idx / (chartPoints.length - 1)) * width;
      const normalizedY = 1 - (pt.value - minVal) / (maxVal - minVal);
      const y = Math.max(15, Math.min(height - 20, normalizedY * height));
      return { x, y };
    });

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      linePath += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

    return { linePath, areaPath, points };
  }, [chartPoints]);

  return (
    <div className="min-h-screen bg-[#F7EFE4] text-[#0A1521] flex flex-col font-sans selection:bg-[#CA461E] selection:text-white overflow-x-hidden paper-texture">
      <Header />

      <main className="grow">
        {/* ========================================================= */}
        {/* SECTION 1: HERO SECTION                                   */}
        {/* ========================================================= */}
        <section
          className="relative pt-4 sm:pt-8 md:pt-10 pb-16 sm:pb-20 md:pb-28 overflow-hidden bg-cover bg-right-top bg-no-repeat"
          style={{ backgroundImage: "url('/assets/landing/hero-david.webp')" }}
        >
          <div className="relative z-10 w-full max-w-[1600px] mx-auto pl-6 sm:pl-10 lg:pl-16 xl:pl-20 pr-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center">

              {/* Left Column: Headlines & CTA Buttons */}
              <div
                ref={heroReveal.ref}
                className={`lg:col-span-5 space-y-6 z-10 pr-6 sm:pr-8 transition-all duration-700 ease-out ${heroReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
              >
                {/* Eyebrow */}
                <div className="inline-flex items-center">
                  <span className="text-[11px] sm:text-xs font-mono font-semibold tracking-[0.2em] uppercase text-[#6F7883]">
                    MUSD · COLLATERAL RISK INFRASTRUCTURE
                  </span>
                </div>

                {/* Primary Headline with clamp typography */}
                <h1 className="text-6xl sm:text-7xl lg:text-[84px] xl:text-[92px] font-serif font-normal tracking-tight text-[#0A1521] leading-[0.95]">
                  Lend<br />
                  Bitcoin<br />
                  <span className="italic font-serif text-[#CA461E]">
                    with clarity.
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-base sm:text-lg font-sans text-[#2C3642] leading-relaxed max-w-[460px]">
                  Ballast helps MUSD borrowers understand liquidation risk, model market scenarios,
                  and keep a deliberate buffer between their position and the edge.
                </p>

                {/* CTA Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <Link href="/app/overview">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#0A1521] text-white font-sans font-medium text-sm hover:bg-[#CA461E] transition-all duration-200 shadow-sm hover:shadow">
                      <span>Launch App</span>
                      <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </Link>
                  <Link href="/whitepaper">
                    <button className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-[#0A1521]/20 bg-transparent text-[#0A1521] font-sans font-medium text-sm hover:border-[#0A1521] hover:text-[#CA461E] transition-all duration-200">
                      <span>Explore the framework</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </Link>
                </div>

                {/* Three feature items in one row with clean line icons */}
                <div className="pt-8 border-t border-[#0A1521]/10 grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-lg">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-6 h-6 text-[#0A1521] stroke-[1.8] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0A1521]">
                        Real-time data
                      </h4>
                      <p className="text-[11px] font-sans text-[#6F7883] mt-0.5 leading-tight">
                        Live position monitoring
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Box className="w-6 h-6 text-[#0A1521] stroke-[1.8] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0A1521]">
                        Scenario analysis
                      </h4>
                      <p className="text-[11px] font-sans text-[#6F7883] mt-0.5 leading-tight">
                        Model market moves
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-6 h-6 text-[#0A1521] stroke-[1.8] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-[#0A1521]">
                        Non-custodial
                      </h4>
                      <p className="text-[11px] font-sans text-[#6F7883] mt-0.5 leading-tight">
                        Your positions, your control
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Collage Bleeding to Right Viewport Edge and Header */}
              <div className="lg:col-span-7 relative flex justify-end pr-0 mt-10 lg:mt-0">

                {/* Handwritten Annotation top right */}
                <div className="absolute -top-14 sm:-top-12 right-28 sm:right-48 lg:right-60 xl:right-72 z-30">
                  <Handwritten arrow="curved-down-left" rotation="-rotate-3">
                    SAME MARKETS.{'\n'}BETTER DECISIONS.
                  </Handwritten>
                </div>

                {/* Hero Artwork Spacer / Position Card */}
                <div className="relative w-full max-w-[820px] lg:max-w-[880px] xl:max-w-[940px] ml-auto mr-0 aspect-[1024/575]">
                  {/* Overlapping "Your Position" Card positioned at bottom-right */}
                  <div className="absolute -bottom-28 sm:-bottom-36 lg:-bottom-40 xl:-bottom-44 right-2 sm:right-6 lg:right-8 z-20 w-[310px] sm:w-[350px] bg-white rounded-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(10,21,33,0.12)] border border-[#0A1521]/10 transition-transform duration-300 hover:scale-[1.01]">
                    <div className="flex items-center justify-between pb-3 border-b border-[#0A1521]/08">
                      <span className="font-sans font-bold text-sm sm:text-base text-[#0A1521]">Your Position</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#BCD99F] text-[#2D6A2E]">
                        Healthy
                      </span>
                    </div>

                    <div className="pt-3">
                      <span className="text-[11px] font-mono text-[#6F7883] uppercase tracking-wider block">
                        Collateral ratio
                      </span>
                      <div className="text-3xl sm:text-4xl font-mono font-bold text-[#0A1521] mt-0.5 tracking-tight">
                        226.7%
                      </div>

                      {/* Calibrated Gauge Bar */}
                      <div className="mt-4 space-y-1.5">
                        <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-[#E16839] via-[#F5AF61] to-[#96B987]">
                          {/* Needle Indicator */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#0A1521] border-2 border-white shadow-md transition-all duration-300"
                            style={{ left: '68%' }}
                          />
                        </div>

                        {/* Three Tick Labels */}
                        <div className="flex justify-between text-[10px] font-mono text-[#6F7883] pt-0.5">
                          <span>150% Liquidation</span>
                          <span>200% Caution</span>
                          <span className="text-right">&gt; 200% Safe</span>
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
          className="py-18 sm:py-24 md:py-32 overflow-hidden"
        >
          <div className="w-full max-w-[1600px] mx-auto pl-6 sm:pl-10 lg:pl-16 xl:pl-20 pr-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center">

              {/* Left Column: Problem Narrative */}
              <div
                className={`lg:col-span-5 space-y-6 pr-6 sm:pr-8 transition-all duration-700 ease-out ${problemReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
                  }`}
              >
                <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-[#6F7883] font-semibold block">
                  THE PROBLEM
                </span>

                <h2 className="text-5xl sm:text-6xl lg:text-[72px] font-serif font-normal text-[#0A1521] leading-[1.0] tracking-tight">
                  Markets move<br />
                  fast. <span className="italic font-serif text-[#CA461E]">Uncertainty</span><br />
                  shouldn’t decide<br />
                  for you.
                </h2>

                <p className="text-base sm:text-lg font-sans text-[#2C3642] leading-relaxed max-w-[460px]">
                  Volatility, sudden market moves, and complex parameters make it hard to know when you’re really at risk. Guessing leads to liquidations.
                </p>

                <div className="pt-2">
                  <a
                    href="#simulator"
                    className="inline-flex items-center gap-2 text-sm font-sans font-semibold text-[#0A1521] hover:text-[#CA461E] transition-colors group"
                  >
                    <span>See the problem</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Right Column: Arch Window Duomo Collage Bleeding Flush to Right Edge */}
              <div
                ref={problemArtworkReveal.ref}
                className={`lg:col-span-7 relative flex justify-end pr-0 mt-8 lg:mt-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
                  problemArtworkReveal.isVisible
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-24 sm:translate-x-36 lg:translate-x-48'
                }`}
              >
                {/* Handwritten Note with underline stroke */}
                <div className="absolute top-4 sm:top-8 right-8 sm:right-20 z-20">
                  <Handwritten underline rotation="-rotate-3">
                    CLEAR DATA.{'\n'}CALMER POSITIONS.{'\n'}MORE CONTROL.
                  </Handwritten>
                </div>

                {/* Arch Window Duomo Artwork */}
                <div className="relative w-full max-w-[780px] xl:max-w-[860px] ml-auto mr-0 select-none">
                  <Image
                    src="/assets/landing/ballast-problem.png"
                    alt="Tuscan arch window framing Florence Duomo with lantern and torn textures"
                    width={576}
                    height={498}
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
          className="relative py-18 sm:py-24 md:py-32 overflow-hidden"
        >
          {/* Orange Watercolor Blob at Left Edge */}
          <div className="absolute -left-2 top-4 w-28 sm:w-36 h-auto pointer-events-none select-none z-0">
            <Image
              src="/assets/landing/orange-blob.webp"
              alt=""
              width={120}
              height={275}
              className="w-full h-auto object-contain opacity-90"
              aria-hidden="true"
            />
          </div>

          <div className="w-full max-w-[1600px] mx-auto pl-6 sm:pl-10 lg:pl-16 xl:pl-20 pr-0 relative z-10">

            {/* Top Row: Heading on Left, Pointing Arm Entering From Right Edge */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-16 sm:mb-20">
              <div>
                <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-[#6F7883] font-semibold block mb-2.5">
                  HOW IT WORKS
                </span>
                <h2 className="text-5xl sm:text-6xl lg:text-[70px] font-serif font-normal text-[#0A1521] leading-tight">
                  Three{' '}
                  <span className="italic font-serif text-[#CA461E]">
                    simple
                  </span>{' '}
                  steps.
                </h2>
              </div>

              {/* Pointing Arm Artwork with Handwritten Note */}
              <div
                ref={pointingArmReveal.ref}
                className={`relative flex items-center gap-4 self-end lg:self-auto mr-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
                  pointingArmReveal.isVisible
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-36 sm:translate-x-52 lg:translate-x-72'
                }`}
              >
                {/* Handwritten Tag pointing right */}
                <div className="mb-2 sm:mb-4">
                  <Handwritten arrow="curved-right" rotation="-rotate-6">
                    FROM{'\n'}DATA{'\n'}TO{'\n'}DECISIONS.
                  </Handwritten>
                </div>

                {/* Classical Marble Pointing Arm Reaching From Screen Edge */}
                <div className="w-[420px] sm:w-[540px] lg:w-[680px] xl:w-[760px] shrink-0 select-none">
                  <Image
                    src="/assets/landing/pointing-arm.webp"
                    alt=""
                    width={1024}
                    height={356}
                    className="w-full h-auto object-contain filter drop-shadow-sm"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* Three Step Columns with Serif Numerals, Underlined Titles, Hairline Dividers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 pt-4 pr-6 sm:pr-10 lg:pr-16 xl:pr-20">

              {/* Step 01 */}
              <div className="space-y-3.5 md:pr-10 lg:pr-14">
                <span className="font-serif text-4xl sm:text-5xl font-bold text-[#0A1521] block">01</span>
                <div className="flex items-center gap-2.5 text-[#0A1521] pt-1">
                  <Link2 className="w-5 h-5 text-[#CA461E] stroke-[2.2]" />
                  <h3 className="text-xl font-serif font-bold text-[#0A1521] underline decoration-1 underline-offset-4">
                    Connect &amp; view
                  </h3>
                </div>
                <p className="text-sm sm:text-base font-sans text-[#6F7883] leading-relaxed">
                  See your position and current risk in real time.
                </p>
              </div>

              {/* Step 02 */}
              <div className="space-y-3.5 md:px-10 lg:px-14 md:border-l md:border-[#0A1521]/15">
                <span className="font-serif text-4xl sm:text-5xl font-bold text-[#0A1521] block">02</span>
                <div className="flex items-center gap-2.5 text-[#0A1521] pt-1">
                  <BarChart3 className="w-5 h-5 text-[#CA461E] stroke-[2.2]" />
                  <h3 className="text-xl font-serif font-bold text-[#0A1521] underline decoration-1 underline-offset-4">
                    Stress-test
                  </h3>
                </div>
                <p className="text-sm sm:text-base font-sans text-[#6F7883] leading-relaxed">
                  Model different market scenarios and discover thresholds.
                </p>
              </div>

              {/* Step 03 */}
              <div className="space-y-3.5 md:pl-10 lg:pl-14 md:border-l md:border-[#0A1521]/15">
                <span className="font-serif text-4xl sm:text-5xl font-bold text-[#0A1521] block">03</span>
                <div className="flex items-center gap-2.5 text-[#0A1521] pt-1">
                  <Zap className="w-5 h-5 text-[#CA461E] stroke-[2.2]" />
                  <h3 className="text-xl font-serif font-bold text-[#0A1521] underline decoration-1 underline-offset-4">
                    Take action
                  </h3>
                </div>
                <p className="text-sm sm:text-base font-sans text-[#6F7883] leading-relaxed">
                  Adjust before you reach the edge with automated buffers.
                </p>
              </div>

            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 4: INTERACTIVE SIMULATOR                          */}
        {/* ========================================================= */}
        <section
          id="simulator"
          ref={simulatorReveal.ref}
          className="relative py-20 sm:py-24 md:py-32 overflow-hidden bg-cover bg-left-bottom bg-no-repeat text-white"
          style={{ backgroundImage: "url('/assets/landing/simulator-colosseum.webp')" }}
        >
          <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">

              {/* Left Column: Heading, Narrative, and CTA button */}
              <div
                className={`lg:col-span-5 space-y-6 transition-all duration-700 ease-out ${simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
              >
                <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-white/80 font-semibold block">
                  INTERACTIVE SIMULATOR
                </span>

                <h2 className="text-5xl sm:text-6xl lg:text-[70px] font-serif font-normal leading-[1.0] tracking-tight text-white">
                  Model<br />the unexpected.
                </h2>

                <p className="text-base sm:text-lg font-sans text-white/90 leading-relaxed max-w-md">
                  Adjust variables, simulate market moves, and see how they impact your position in real time.
                </p>

                <div className="pt-2">
                  <Link href="/app/stress-test">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#0A1521] text-white font-sans font-medium text-sm hover:bg-white hover:text-[#C1411C] transition-all duration-200 shadow-md">
                      <span>Try the simulator</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Right Column: Wide Interactive Position Simulator Card */}
              <div
                className={`lg:col-span-7 flex justify-end transition-all duration-700 ease-out ${simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`}
              >
                <div className="bg-white text-[#0A1521] rounded-3xl p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.25)] w-full max-w-[740px] xl:max-w-[800px]">

                  {/* Card Header & Timeframe Tabs */}
                  <div className="flex flex-row items-center justify-between gap-3 pb-6 border-b border-[#0A1521]/10">
                    <h3 className="font-serif font-bold text-xl sm:text-2xl text-[#0A1521]">
                      Position Simulator
                    </h3>

                    {/* Timeframe selector pill */}
                    <div className="flex items-center rounded-full bg-[#F7EFE4] p-1 text-xs font-mono">
                      {(['1D', '1W', '1M', '1Y'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeframe(t)}
                          className={`px-3 py-1 rounded-full text-xs transition-all duration-150 ${timeframe === t
                            ? 'bg-[#0A1521] text-white font-bold shadow-sm'
                            : 'text-[#6F7883] hover:text-[#0A1521]'
                            }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Top 3 Live Calculated Metric Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 py-6 border-b border-[#0A1521]/10">
                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-4">
                      <span className="text-[11px] font-mono uppercase text-[#6F7883] block">
                        Collateral ratio
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-2xl sm:text-3xl font-mono font-bold text-[#0A1521] tracking-tight">
                          {icrFormatted}%
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${healthState === 'healthy'
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
                      <span className="text-[11px] font-mono uppercase text-[#6F7883] block">
                        MUSD debt
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[#0A1521] mt-1 tracking-tight">
                        ${debt.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-4">
                      <span className="text-[11px] font-mono uppercase text-[#6F7883] block">
                        Collateral value
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[#0A1521] mt-1 tracking-tight">
                        ${collateralValue.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Interactive SVG Chart matching 100/200/300% axis */}
                  <div className="py-6">
                    <div className="relative h-44 sm:h-48 w-full">
                      <svg
                        viewBox="0 0 600 180"
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="simAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#CA461E" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#CA461E" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Reference lines matching 100/200/300% */}
                        <line x1="0" y1="140" x2="600" y2="140" stroke="#0A1521" strokeOpacity="0.1" strokeDasharray="3 3" />
                        <text x="5" y="136" fill="#8C877D" fontSize="10" fontFamily="monospace">100%</text>

                        <line x1="0" y1="80" x2="600" y2="80" stroke="#0A1521" strokeOpacity="0.1" strokeDasharray="3 3" />
                        <text x="5" y="76" fill="#8C877D" fontSize="10" fontFamily="monospace">200%</text>

                        <line x1="0" y1="20" x2="600" y2="20" stroke="#0A1521" strokeOpacity="0.1" strokeDasharray="3 3" />
                        <text x="5" y="16" fill="#8C877D" fontSize="10" fontFamily="monospace">300%</text>

                        {/* Vertical Indicator Line */}
                        {chartSvgPath.points[activeChartPoint] && (
                          <line
                            x1={chartSvgPath.points[activeChartPoint].x}
                            y1={chartSvgPath.points[activeChartPoint].y}
                            x2={chartSvgPath.points[activeChartPoint].x}
                            y2="170"
                            stroke="#0A1521"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                            opacity="0.6"
                          />
                        )}

                        {/* Soft Ember Area Fill */}
                        <path d={chartSvgPath.areaPath} fill="url(#simAreaGradient)" />

                        {/* Smooth Curve Line */}
                        <path
                          d={chartSvgPath.linePath}
                          fill="none"
                          stroke="#CA461E"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        {/* Interactive Data Points */}
                        {chartSvgPath.points.map((pt, i) => (
                          <g
                            key={i}
                            className="cursor-pointer"
                            onClick={() => setActiveChartPoint(i)}
                          >
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={activeChartPoint === i ? 5.5 : 4}
                              fill={activeChartPoint === i ? '#0A1521' : '#CA461E'}
                              stroke="white"
                              strokeWidth={activeChartPoint === i ? 2 : 1.5}
                            />
                          </g>
                        ))}
                      </svg>

                      {/* Tooltip on Active Point */}
                      {chartSvgPath.points[activeChartPoint] && (
                        <div
                          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full -top-1 px-3 py-1.5 bg-white text-[#0A1521] border border-[#0A1521]/10 rounded-xl text-xs font-mono shadow-xl text-center"
                          style={{
                            left: `${(activeChartPoint / (chartPoints.length - 1)) * 100}%`,
                          }}
                        >
                          <div className="font-bold text-sm text-[#0A1521]">
                            {chartPoints[activeChartPoint].value.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-[#6F7883]">
                            {chartPoints[activeChartPoint].date}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Month Labels */}
                    <div className="flex justify-between text-xs font-mono text-[#6F7883] pt-3 border-t border-[#0A1521]/10">
                      {chartPoints.map((pt, i) => (
                        <span key={i}>{pt.label}</span>
                      ))}
                    </div>
                  </div>

                  {/* Three Slider Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4 border-t border-[#0A1521]/10">

                    {/* Slider 1: MUSD Price */}
                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#6F7883]">MUSD Price</span>
                        <span className="font-bold text-[#0A1521]">${musdPrice.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.50"
                        max="2.00"
                        step="0.01"
                        value={musdPrice}
                        onChange={(e) => setMusdPrice(parseFloat(e.target.value))}
                        style={{
                          background: `linear-gradient(to right, #CA461E 0%, #CA461E ${((musdPrice - 0.5) / 1.5) * 100}%, rgba(10,21,33,0.12) ${((musdPrice - 0.5) / 1.5) * 100}%, rgba(10,21,33,0.12) 100%)`,
                        }}
                        className="w-full accent-[#CA461E] cursor-pointer h-1.5 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#6F7883]">
                        <span>$0.50</span>
                        <span>$2.00</span>
                      </div>
                    </div>

                    {/* Slider 2: Collateral Value */}
                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#6F7883]">Collateral Value</span>
                        <span className="font-bold text-[#0A1521]">${collateralValue.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="1000"
                        max="50000"
                        step="500"
                        value={collateralValue}
                        onChange={(e) => setCollateralValue(parseInt(e.target.value, 10))}
                        style={{
                          background: `linear-gradient(to right, #CA461E 0%, #CA461E ${((collateralValue - 1000) / 49000) * 100}%, rgba(10,21,33,0.12) ${((collateralValue - 1000) / 49000) * 100}%, rgba(10,21,33,0.12) 100%)`,
                        }}
                        className="w-full accent-[#CA461E] cursor-pointer h-1.5 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#6F7883]">
                        <span>$1k</span>
                        <span>$50k</span>
                      </div>
                    </div>

                    {/* Slider 3: Volatility */}
                    <div className="bg-[#FBF7F0] border border-[#0A1521]/08 rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#6F7883]">Volatility</span>
                        <span className="font-bold text-[#0A1521]">± {volatilityPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={volatilityPercent}
                        onChange={(e) => setVolatilityPercent(parseInt(e.target.value, 10))}
                        style={{
                          background: `linear-gradient(to right, #CA461E 0%, #CA461E ${volatilityPercent}%, rgba(10,21,33,0.12) ${volatilityPercent}%, rgba(10,21,33,0.12) 100%)`,
                        }}
                        className="w-full accent-[#CA461E] cursor-pointer h-1.5 rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#6F7883]">
                        <span>0%</span>
                        <span>100%</span>
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
          className="relative py-12 sm:py-14 md:py-16 overflow-hidden bg-cover bg-right-top bg-no-repeat"
          style={{ backgroundImage: "url('/assets/landing/belief-facade.webp')", backgroundPosition: 'right top' }}
        >
          {/* David Statue Cutout Anchored Directly to the Bottom-Left Border of Section */}
          <div
            ref={beliefDavidReveal.ref}
            className={`absolute -bottom-5 sm:-bottom-6 lg:-bottom-8 left-0 z-10 w-full max-w-[380px] sm:max-w-[440px] lg:max-w-[500px] xl:max-w-[540px] shrink-0 transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform select-none pointer-events-none ${
              beliefDavidReveal.isVisible
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-32 sm:-translate-x-44 lg:-translate-x-56'
            }`}
          >
            {/* Handwritten Tag top left */}
            <div className="absolute -top-10 left-6 sm:left-12 lg:left-14 z-20">
              <Handwritten arrow="curved-down-left" rotation="-rotate-3">
                YOUR POSITION.{'\n'}YOUR RULES.
              </Handwritten>
            </div>

            {/* Large David Statue Cutout starting flush from bottom left border */}
            <div className="relative w-full -ml-0 lg:-ml-6 xl:-ml-8">
              <Image
                src="/assets/landing/belief-david.png"
                alt=""
                width={1024}
                height={682}
                className="w-full h-auto object-contain object-bottom filter drop-shadow-sm select-none"
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 relative z-10 flex flex-col lg:flex-row items-center justify-between min-h-[440px] lg:min-h-[480px]">

            {/* Left spacer for desktop so middle text is centered between David and Building Facade */}
            <div className="hidden lg:block w-[320px] xl:w-[400px] shrink-0 pointer-events-none" />

            {/* Middle Part: Our Belief Narrative & Centered CTA Buttons */}
            <div
              className={`max-w-xl px-4 sm:px-6 my-6 lg:my-0 space-y-4 sm:space-y-5 text-center transition-all duration-700 ease-out ${beliefReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
            >
              <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.2em] text-[#6F7883] font-semibold block">
                OUR BELIEF
              </span>

              <h2 className="text-3xl sm:text-4xl lg:text-[46px] font-serif font-normal text-[#0A1521] leading-[1.08] tracking-tight">
                Better tools<br />
                for a more stable<br />
                ecosystem.
              </h2>

              <p className="text-sm sm:text-base font-sans text-[#2C3642] leading-relaxed max-w-md mx-auto">
                A more informed community leads to fewer liquidations, healthier positions, and a
                more resilient MUSD ecosystem.
              </p>

              {/* CTAs Centered */}
              <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
                <Link href="/app/overview">
                  <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#0A1521] text-white font-sans font-medium text-sm hover:bg-[#CA461E] transition-all duration-200 shadow-sm">
                    <span>Explore Ballast</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </button>
                </Link>
                <Link href="/whitepaper">
                  <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#0A1521]/20 bg-transparent text-[#0A1521] font-sans font-medium text-sm hover:border-[#0A1521] hover:text-[#CA461E] transition-all duration-200">
                    <span>Read the docs</span>
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Part: Angled Handwritten Stamp Tag positioned at bottom right */}
            <div
              className={`w-full lg:w-[280px] xl:w-[340px] shrink-0 relative flex justify-center lg:justify-end pr-0 self-end transition-all duration-700 ease-out ${beliefReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
                }`}
            >
              <div className="pb-3 sm:pb-4">
                <div className="inline-block px-3.5 py-1.5 border border-dashed border-[#CA461E] bg-[#F7EFE4]/95 backdrop-blur-sm rounded-sm font-hand text-xs sm:text-sm font-bold text-[#CA461E] rotate-6 select-none shadow-sm leading-tight text-center">
                  BUILT FOR<br />A MORE STABLE<br />ECOSYSTEM
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
        <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 py-16 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 items-start pb-14 border-b border-[#0A1521]/10">

            {/* Identity & Mission */}
            <div className="md:col-span-3 space-y-4">
              <Link href="/" className="flex items-center gap-2.5 group">
                <span className="text-[#0A1521] group-hover:text-[#CA461E] transition-colors">
                  <Anchor className="w-5 h-5 stroke-[2.2]" />
                </span>
                <span className="font-serif font-bold text-lg text-[#0A1521] tracking-[0.18em] uppercase leading-none group-hover:text-[#CA461E] transition-colors">
                  {BRAND_NAME}
                </span>
              </Link>

              <p className="text-xs sm:text-sm font-sans text-[#6F7883] leading-relaxed max-w-sm">
                Autonomous liquidation and redemption guardian for MUSD troves on Mezo.
              </p>

              {/* Three Social Icons */}
              <div className="flex items-center gap-3 pt-1 text-[#2C3642]">
                <a
                  href={BRAND_URLS.x}
                  target="_blank"
                  rel="noreferrer"
                  title="Follow on X (@Siddhu_3116)"
                  className="w-8 h-8 rounded-full border border-[#0A1521]/15 flex items-center justify-center hover:text-[#CA461E] hover:border-[#CA461E] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">X</span>
                </a>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#0A1521]/15 flex items-center justify-center hover:text-[#CA461E] hover:border-[#CA461E] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">⚑</span>
                </a>
                <a
                  href="https://github.com/SIDDHUX9/BALLAST"
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
              <ul className="space-y-2 text-xs sm:text-sm font-sans text-[#6F7883]">
                <li>
                  <Link href="/whitepaper" className="hover:text-[#0A1521] transition-colors">
                    Whitepaper
                  </Link>
                </li>
                <li>
                  <a href="#simulator" className="hover:text-[#0A1521] transition-colors">
                    Risk framework
                  </a>
                </li>
                <li>
                  <Link href="/app" className="hover:text-[#0A1521] transition-colors">
                    Borrower App
                  </Link>
                </li>
                <li>
                  <Link href="/app/activity" className="hover:text-[#0A1521] transition-colors">
                    Changelog
                  </Link>
                </li>
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
              <ul className="space-y-2 text-xs sm:text-sm font-sans text-[#6F7883]">
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
                    <ExternalLink className="w-3 h-3 text-[#6F7883] group-hover/c:text-[#CA461E]" />
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
                    <ExternalLink className="w-3 h-3 text-[#6F7883] group-hover/c:text-[#CA461E]" />
                  </a>
                </li>
                <li>
                  <a
                    href={`https://explorer.test.mezo.org/address/${MATSNET_DEPLOYMENT.sampleVault}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#0A1521] transition-colors inline-flex items-center gap-1 group/c"
                  >
                    <span>BallastVault (Clone)</span>
                    <span className="font-mono text-[11px] text-[#CA461E] group-hover/c:underline">
                      0xA506...5D5A
                    </span>
                    <ExternalLink className="w-3 h-3 text-[#6F7883] group-hover/c:text-[#CA461E]" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Community Column */}
            <div className="md:col-span-2 space-y-2.5 md:border-l md:border-[#0A1521]/10 md:pl-6">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#0A1521] block mb-1">
                Community
              </span>
              <ul className="space-y-2 text-xs sm:text-sm font-sans text-[#6F7883]">
                <li>
                  <a
                    href={BRAND_URLS.x}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#0A1521] transition-colors flex items-center gap-1 group"
                  >
                    <span>X (@Siddhu_3116)</span>
                    <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/SIDDHUX9/BALLAST"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#0A1521] transition-colors flex items-center gap-1 group"
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
                <li>
                  <a
                    href={BRAND_URLS.mezoDocs}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#0A1521] transition-colors flex items-center gap-1 group"
                  >
                    <span>Mezo Docs</span>
                    <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Newsletter Input with Circle Arrow Button */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex items-center rounded-xl bg-white border border-[#0A1521]/15 p-1.5 pl-3 shadow-sm">
                <input
                  type="email"
                  placeholder="Get updates"
                  className="bg-transparent text-xs font-sans text-[#0A1521] placeholder-[#6F7883] focus:outline-none w-full min-w-0"
                />
                <button
                  type="button"
                  aria-label="Submit newsletter subscription"
                  className="w-7 h-7 rounded-full bg-[#0A1521] text-white flex items-center justify-center shrink-0 hover:bg-[#CA461E] transition-colors ml-1"
                >
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>
              </div>
              <p className="text-[11px] font-sans text-[#6F7883]">
                No noise. Just updates.
              </p>
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
                <span className="text-[11px] font-mono text-[#6F7883]">
                  (Mezo Matsnet Testnet &middot; Chain ID 31611)
                </span>
              </div>
              <a
                href={BRAND_URLS.mezoExplorer}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#6F7883] hover:text-[#CA461E] transition-colors"
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
                  <p className="text-xs font-sans text-[#6F7883] mb-2.5">
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
                      className="text-[11px] font-mono text-[#6F7883] hover:text-[#0A1521] transition-colors"
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

              {/* Contract 2: BallastVault Implementation */}
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
                  <p className="text-xs font-sans text-[#6F7883] mb-2.5">
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
                      className="text-[11px] font-mono text-[#6F7883] hover:text-[#0A1521] transition-colors"
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

              {/* Contract 3: Active Borrower Vault Clone */}
              <div className="p-3.5 rounded-xl border border-[#0A1521]/10 bg-white/70 backdrop-blur-sm shadow-xs flex flex-col justify-between hover:border-[#CA461E]/40 transition-all">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-[#0A1521] uppercase tracking-wide">
                      BallastVault (Clone)
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0A1521]/10 text-[#0A1521] font-semibold">
                      Active Vault
                    </span>
                  </div>
                  <p className="text-xs font-sans text-[#6F7883] mb-2.5">
                    Live borrower defense vault clone on Matsnet with pre-funded reserves.
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
                      className="text-[11px] font-mono text-[#6F7883] hover:text-[#0A1521] transition-colors"
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
            </div>
          </div>

          {/* Bottom Bar: Copyright & Architectural Florence Duomo Sketch */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="text-xs sm:text-sm font-mono text-[#6F7883]">
              &copy; 2026 Ballast. All rights reserved.
            </span>

            {/* Handwritten Note + Florence Cathedral Line Art Sketch */}
            <div className="flex items-center gap-5 select-none">
              <Handwritten underline rotation="-rotate-3">
                STAY AHEAD.{'\n'}STAY IN CONTROL.
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
