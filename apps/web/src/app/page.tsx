'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '../components/layout/header';
import { BRAND_NAME } from '@ballast/shared';
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

// Custom Intersection Observer Hook for Scroll Slide-in Animations
function useScrollReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

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
  // Base loan: $3,000 MUSD debt at $10,000 collateral gives 333.3%, or customized to match 226.7% base ratio
  const debt = 3000;
  const effectiveDebt = debt * musdPrice;
  // Scaled ratio calculation derived purely from math
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

  // Scroll Reveal Refs for hardware-accelerated slide-in effects
  const heroReveal = useScrollReveal<HTMLDivElement>(0.1);
  const problemReveal = useScrollReveal<HTMLDivElement>(0.15);
  const stepsReveal = useScrollReveal<HTMLDivElement>(0.15);
  const simulatorReveal = useScrollReveal<HTMLDivElement>(0.1);
  const beliefReveal = useScrollReveal<HTMLDivElement>(0.15);

  // Chart points data generated dynamically based on active timeframe and ICR
  const chartPoints = useMemo(() => {
    const base = simulatedICR > 0 ? simulatedICR : 226.7;
    const vFactor = volatilityPercent / 100;
    const offsets = [-0.10, 0.07, -0.04, 0.12, 0.0, -0.05, 0.03];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

    return offsets.map((offset, idx) => {
      const val = Math.max(90, Math.min(380, base * (1 + offset * vFactor)));
      return {
        label: months[idx],
        value: val,
        date: `${months[idx]} 14, 2026`,
      };
    });
  }, [simulatedICR, volatilityPercent]);

  // SVG Chart path generation
  const chartSvgPath = useMemo(() => {
    const width = 500;
    const height = 180;
    const minVal = 100;
    const maxVal = 320;

    const points = chartPoints.map((pt, idx) => {
      const x = (idx / (chartPoints.length - 1)) * width;
      const normalizedY = 1 - (pt.value - minVal) / (maxVal - minVal);
      const y = Math.max(15, Math.min(height - 20, normalizedY * height));
      return { x, y };
    });

    // Generate smooth bezier curve path
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
    <div className="min-h-screen bg-[#F5F1E8] dark:bg-[#0E0E0C] text-ink flex flex-col font-sans selection:bg-[#C84E29] selection:text-white transition-colors duration-300 overflow-x-hidden">
      <Header />

      <main className="grow">
        {/* ========================================================= */}
        {/* SECTION 1: HERO SECTION                                   */}
        {/* ========================================================= */}
        <section className="relative pt-10 md:pt-16 pb-20 md:pb-28 overflow-hidden">
          <div className="max-w-container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-6 items-center">
              
              {/* Left Column: Headlines & Action Buttons */}
              <div
                ref={heroReveal.ref}
                className={`lg:col-span-6 space-y-8 z-10 transition-all duration-1000 ease-out ${
                  heroReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                {/* Category Pill */}
                <div className="inline-flex items-center gap-2">
                  <span className="text-[11px] font-mono font-semibold tracking-widest uppercase text-[#78736B]">
                    MUSD · COLLATERAL RISK INFRASTRUCTURE
                  </span>
                </div>

                {/* Primary Editorial Title */}
                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif font-normal tracking-tight text-ink leading-[1.05]">
                  Lend<br />
                  Bitcoin<br />
                  <span className="italic font-serif text-[#C84E29] dark:text-[#E0633C] transition-colors">
                    with clarity.
                  </span>
                </h1>

                {/* Narrative Lead Paragraph */}
                <p className="text-base sm:text-lg font-sans text-ink-soft dark:text-ink-muted leading-relaxed max-w-lg">
                  Ballast helps MUSD borrowers understand liquidation risk, model market scenarios,
                  and keep a deliberate buffer between their position and the edge.
                </p>

                {/* CTA Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link href="/app/overview">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#14130F] dark:bg-white text-white dark:text-[#14130F] font-sans font-medium text-sm hover:bg-[#C84E29] dark:hover:bg-[#C84E29] dark:hover:text-white transition-all duration-200 shadow-sm hover:shadow-md">
                      <span>Launch App</span>
                      <ArrowUpRight className="w-4 h-4 stroke-[2]" />
                    </button>
                  </Link>
                  <Link href="/whitepaper">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[#C8C2B4] dark:border-hairline bg-transparent text-ink font-sans font-medium text-sm hover:border-ink hover:text-[#C84E29] transition-all duration-200">
                      <span>Explore the framework</span>
                      <ArrowRight className="w-4 h-4 stroke-[2]" />
                    </button>
                  </Link>
                </div>

                {/* 3 Pillar Micro-Badges */}
                <div className="pt-8 border-t border-[#DFD9CC] dark:border-hairline grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EAE3D4] dark:bg-[#1A1916] flex items-center justify-center shrink-0 text-[#C84E29]">
                      <BarChart3 className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-ink">
                        Real-time data
                      </h4>
                      <p className="text-xs font-sans text-ink-muted mt-0.5">
                        Live position monitoring
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EAE3D4] dark:bg-[#1A1916] flex items-center justify-center shrink-0 text-[#C84E29]">
                      <Box className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-ink">
                        Scenario analysis
                      </h4>
                      <p className="text-xs font-sans text-ink-muted mt-0.5">
                        Model market moves
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#EAE3D4] dark:bg-[#1A1916] flex items-center justify-center shrink-0 text-[#C84E29]">
                      <ShieldCheck className="w-4 h-4 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-ink">
                        Non-custodial
                      </h4>
                      <p className="text-xs font-sans text-ink-muted mt-0.5">
                        Your position, your control
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Collage & Floating Position Card */}
              <div className="lg:col-span-6 relative">
                {/* Handwritten Annotation: SAME MARKETS. BETTER DECISIONS. */}
                <div className="absolute -top-12 sm:-top-10 right-4 sm:right-8 z-30 flex flex-col items-end pointer-events-none select-none">
                  <span className="font-hand text-[#C84E29] text-xl sm:text-2xl font-bold tracking-wide -rotate-3 whitespace-nowrap">
                    SAME MARKETS.<br />BETTER DECISIONS.
                  </span>
                  <svg width="48" height="42" viewBox="0 0 48 42" fill="none" className="text-[#C84E29] -mt-1 mr-4">
                    <path d="M38 4C28 12 14 20 8 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M16 32L8 34L6 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Hero Artwork - Classical Collage sitting seamlessly on background */}
                <div className="relative transform hover:scale-[1.01] transition-transform duration-700 ease-out">
                  <Image
                    src="/assets/hero-david.jpg"
                    alt="Classical sculpture collage with David wearing sunglasses, Italian stamp, and Florence Duomo"
                    width={900}
                    height={680}
                    priority
                    className="w-full h-auto object-contain filter drop-shadow-sm select-none pointer-events-none"
                  />
                </div>

                {/* Floating "Your Position" Card overlapping David */}
                <div className="relative -mt-24 sm:-mt-28 md:-mt-32 max-w-sm ml-4 sm:ml-8 z-30 bg-white dark:bg-[#181714] rounded-2xl p-6 shadow-[0_20px_50px_rgba(20,19,15,0.12)] border border-[#E8E2D5] dark:border-hairline transition-all duration-300">
                  <div className="flex items-center justify-between pb-3 border-b border-[#F4EFE6] dark:border-hairline">
                    <span className="font-sans font-bold text-sm text-ink">Your Position</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#E9F5EF] dark:bg-[#1A3326] text-[#2F6F5E] dark:text-[#52C092]">
                      Healthy
                    </span>
                  </div>

                  <div className="pt-3">
                    <span className="text-xs font-mono text-[#8C877D] uppercase tracking-wider block">
                      Collateral ratio
                    </span>
                    <div className="text-4xl font-mono font-bold text-ink mt-0.5 tracking-tight">
                      226.7%
                    </div>

                    {/* Gradient Health Ratio Bar with Needle Marker */}
                    <div className="mt-4 space-y-1.5">
                      <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-[#D95C34] via-[#E5A93C] to-[#3B967D]">
                        {/* Needle / Indicator Circle at ~68% position */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#14130F] dark:bg-white border-2 border-white dark:border-[#14130F] shadow-md transition-all duration-300"
                          style={{ left: '68%' }}
                        />
                      </div>

                      {/* Threshold Scale Marks */}
                      <div className="flex justify-between text-[10px] font-mono text-[#8C877D] pt-1">
                        <span>110% Liquidation</span>
                        <span>150% Caution</span>
                        <span className="text-right">&gt; 200% Safe</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 2: THE PROBLEM                                    */}
        {/* ========================================================= */}
        <section
          id="problem"
          ref={problemReveal.ref}
          className="py-20 md:py-32 overflow-hidden"
        >
          <div className="max-w-container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              
              {/* Left Column: Problem Copy */}
              <div
                className={`lg:col-span-6 space-y-6 transition-all duration-1000 ease-out ${
                  problemReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'
                }`}
              >
                <span className="text-xs font-mono uppercase tracking-widest text-[#78736B] font-semibold block">
                  THE PROBLEM
                </span>

                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-normal text-ink leading-[1.1] tracking-tight">
                  Markets move<br />
                  fast. <span className="italic font-serif text-[#C84E29] dark:text-[#E0633C]">Uncertainty</span><br />
                  shouldn’t decide<br />
                  for you.
                </h2>

                <p className="text-base sm:text-lg font-sans text-ink-soft dark:text-ink-muted leading-relaxed max-w-lg">
                  Volatility, sudden market moves, and complex parameters make it hard to know when you’re really at risk. Guessing leads to liquidations.
                </p>

                <div className="pt-2">
                  <a
                    href="#simulator"
                    className="inline-flex items-center gap-2 text-sm font-sans font-semibold text-ink hover:text-[#C84E29] transition-colors group"
                  >
                    <span>See the problem</span>
                    <ArrowRight className="w-4 h-4 stroke-[2] group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Right Column: Architectural Monument Collage with Red Annotation */}
              <div
                className={`lg:col-span-6 relative transition-all duration-1000 ease-out ${
                  problemReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
                }`}
              >
                {/* Handwritten Note: CLEAR DATA. CALMER POSITIONS. MORE CONTROL. */}
                <div className="absolute -top-8 right-2 sm:right-6 z-20 flex flex-col items-end pointer-events-none select-none">
                  <span className="font-hand text-[#C84E29] text-lg sm:text-xl font-bold tracking-wide -rotate-3 text-right">
                    CLEAR DATA.<br />
                    CALMER POSITIONS.<br />
                    MORE CONTROL.
                  </span>
                </div>

                {/* Colosseum Monument Sculpture Artwork */}
                <div className="relative mx-auto max-w-lg select-none">
                  <Image
                    src="/assets/colosseum-statue.png"
                    alt="Italian architectural monument with Colosseum, cypress, and classical marble pillar"
                    width={700}
                    height={800}
                    className="w-full h-auto object-contain filter drop-shadow-sm transform hover:scale-[1.02] transition-transform duration-700 ease-out"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 3: HOW IT WORKS (3 SIMPLE STEPS)                   */}
        {/* ========================================================= */}
        <section
          id="how-it-works"
          ref={stepsReveal.ref}
          className="relative py-20 md:py-32 overflow-hidden"
        >
          <div className="max-w-container mx-auto px-4 md:px-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-16">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-[#78736B] font-semibold block mb-2">
                  HOW IT WORKS
                </span>
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-normal text-ink leading-tight">
                  Three{' '}
                  <span className="italic font-serif text-[#C84E29] dark:text-[#E0633C]">
                    simple
                  </span>{' '}
                  steps.
                </h2>
              </div>

              {/* Pointing Arm Artwork with Handwritten Annotation: FROM DATA TO DECISIONS */}
              <div
                className={`relative flex items-center gap-4 transition-all duration-1000 ease-out ${
                  stepsReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-24'
                }`}
              >
                {/* Handwritten Tag: FROM DATA TO DECISIONS. */}
                <div className="flex flex-col items-center select-none pointer-events-none">
                  <span className="font-hand text-[#C84E29] text-xl sm:text-2xl font-bold tracking-wide -rotate-6 whitespace-nowrap">
                    FROM DATA<br />TO DECISIONS.
                  </span>
                  <svg width="54" height="36" viewBox="0 0 54 36" fill="none" className="text-[#C84E29] mt-0.5">
                    <path d="M44 4C30 8 16 16 6 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M15 28L6 30L8 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Pointing Arm Sculpture Image sliding in horizontally */}
                <div className="w-56 sm:w-72 lg:w-96 shrink-0 select-none">
                  <Image
                    src="/assets/pointing-arm.png"
                    alt="Classical marble sculpture arm pointing towards steps"
                    width={500}
                    height={220}
                    className="w-full h-auto object-contain filter drop-shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* 3 Step Columns - Airy editorial layout separated by hairline dividers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 pt-4">
              
              {/* Step 01 */}
              <div className="space-y-3 md:pr-10">
                <span className="text-3xl font-mono font-bold text-ink block">01</span>
                <div className="flex items-center gap-2 text-[#C84E29] pt-1">
                  <Link2 className="w-4 h-4 stroke-[2]" />
                  <h3 className="text-lg font-serif font-bold text-ink">
                    Connect &amp; view
                  </h3>
                </div>
                <p className="text-sm font-sans text-ink-muted leading-relaxed">
                  See your position and current risk in real time.
                </p>
              </div>

              {/* Step 02 */}
              <div className="space-y-3 md:px-10 md:border-l md:border-[#DFD9CC] dark:md:border-hairline">
                <span className="text-3xl font-mono font-bold text-ink block">02</span>
                <div className="flex items-center gap-2 text-[#C84E29] pt-1">
                  <BarChart3 className="w-4 h-4 stroke-[2]" />
                  <h3 className="text-lg font-serif font-bold text-ink">
                    Stress-test
                  </h3>
                </div>
                <p className="text-sm font-sans text-ink-muted leading-relaxed">
                  Model different market scenarios and discover thresholds.
                </p>
              </div>

              {/* Step 03 */}
              <div className="space-y-3 md:pl-10 md:border-l md:border-[#DFD9CC] dark:md:border-hairline">
                <span className="text-3xl font-mono font-bold text-ink block">03</span>
                <div className="flex items-center gap-2 text-[#C84E29] pt-1">
                  <Zap className="w-4 h-4 stroke-[2]" />
                  <h3 className="text-lg font-serif font-bold text-ink">
                    Take action
                  </h3>
                </div>
                <p className="text-sm font-sans text-ink-muted leading-relaxed">
                  Adjust before you reach the edge with automated buffers.
                </p>
              </div>

            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 4: INTERACTIVE SIMULATOR (TERRACOTTA ARTWORK)      */}
        {/* ========================================================= */}
        <section
          id="simulator"
          ref={simulatorReveal.ref}
          className="relative py-20 md:py-32 bg-[#C34928] text-white overflow-hidden"
        >
          {/* Background Colosseum Artwork Image with Blend */}
          <div className="absolute inset-0 z-0 opacity-40 mix-blend-multiply pointer-events-none select-none">
            <Image
              src="/assets/terracotta-colosseum.jpg"
              alt="Terracotta collage with Colosseum arches and warm textures"
              fill
              className="object-cover object-center"
            />
          </div>

          <div className="relative z-10 max-w-container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              
              {/* Left Column: Heading & Narrative */}
              <div
                className={`lg:col-span-5 space-y-6 transition-all duration-1000 ease-out ${
                  simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <span className="text-xs font-mono uppercase tracking-widest text-[#F5E2DA] font-semibold block">
                  INTERACTIVE SIMULATOR
                </span>

                <h2 className="text-4xl sm:text-5xl font-serif font-normal leading-[1.12] tracking-tight text-white">
                  Model the unexpected.
                </h2>

                <p className="text-base font-sans text-[#F5E2DA] leading-relaxed">
                  Adjust variables, simulate market moves, and see how they impact your position in real time with zero risk.
                </p>

                <div className="pt-2">
                  <Link href="/app/stress-test">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#14130F] text-white font-sans font-medium text-sm hover:bg-white hover:text-[#C34928] transition-all duration-200 shadow-md">
                      <span>Try the simulator</span>
                      <ArrowRight className="w-4 h-4 stroke-[2]" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Right Column: Interactive White Position Simulator Card */}
              <div
                className={`lg:col-span-7 transition-all duration-1000 ease-out ${
                  simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
              >
                <div className="bg-white text-[#14130F] rounded-2xl p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.25)] border border-white/20">
                  
                  {/* Card Header & Timeframe Tabs */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#F0EBE0]">
                    <h3 className="font-serif font-bold text-xl text-[#14130F]">
                      Position Simulator
                    </h3>

                    {/* Timeframe selector pill */}
                    <div className="flex items-center rounded-full bg-[#F4F1EA] p-1 text-xs font-mono">
                      {(['1D', '1W', '1M', '1Y'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeframe(t)}
                          className={`px-3 py-1 rounded-full transition-all duration-150 ${
                            timeframe === t
                              ? 'bg-[#14130F] text-white font-bold shadow-sm'
                              : 'text-ink-muted hover:text-ink'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Top 3 Live Calculated Metrics */}
                  <div className="grid grid-cols-3 gap-4 py-6 border-b border-[#F0EBE0]">
                    <div>
                      <span className="text-[11px] font-mono uppercase text-ink-muted block">
                        Collateral ratio
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-2xl sm:text-3xl font-mono font-bold text-[#14130F] tracking-tight">
                          {icrFormatted}%
                        </span>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                            healthState === 'healthy'
                              ? 'bg-[#EAF5EF] text-[#2F6F5E]'
                              : healthState === 'caution'
                              ? 'bg-[#FEF5E7] text-[#D9983B]'
                              : 'bg-[#FDF0ED] text-[#E04A4A]'
                          }`}
                        >
                          {healthLabel}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-mono uppercase text-ink-muted block">
                        MUSD debt
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[#14130F] mt-1 tracking-tight">
                        ${debt.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] font-mono uppercase text-ink-muted block">
                        Collateral value
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[#14130F] mt-1 tracking-tight">
                        ${collateralValue.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Interactive SVG Chart */}
                  <div className="py-6">
                    <div className="relative h-44 w-full">
                      <svg
                        viewBox="0 0 500 180"
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="simAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C84E29" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#C84E29" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Reference lines (110% Liquidation, 150% Caution, 200% Safe) */}
                        <line x1="0" y1="140" x2="500" y2="140" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="136" fill="#999" fontSize="10" fontFamily="monospace">110%</text>

                        <line x1="0" y1="95" x2="500" y2="95" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="91" fill="#999" fontSize="10" fontFamily="monospace">150%</text>

                        <line x1="0" y1="50" x2="500" y2="50" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="46" fill="#999" fontSize="10" fontFamily="monospace">200%</text>

                        {/* Gradient Area Fill */}
                        <path d={chartSvgPath.areaPath} fill="url(#simAreaGradient)" />

                        {/* Smooth Curve Line */}
                        <path
                          d={chartSvgPath.linePath}
                          fill="none"
                          stroke="#C84E29"
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
                              r={activeChartPoint === i ? 5 : 3.5}
                              fill={activeChartPoint === i ? '#14130F' : '#C84E29'}
                              stroke="white"
                              strokeWidth={activeChartPoint === i ? 2 : 1.5}
                            />
                          </g>
                        ))}
                      </svg>

                      {/* Tooltip Pill on Active Point */}
                      {chartSvgPath.points[activeChartPoint] && (
                        <div
                          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full -top-1 px-3 py-1 bg-[#14130F] text-white rounded-md text-[11px] font-mono shadow-md whitespace-nowrap"
                          style={{
                            left: `${(activeChartPoint / (chartPoints.length - 1)) * 100}%`,
                          }}
                        >
                          <span className="font-bold text-[#E0633C]">
                            {chartPoints[activeChartPoint].value.toFixed(1)}%
                          </span>{' '}
                          • {chartPoints[activeChartPoint].date}
                        </div>
                      )}
                    </div>

                    {/* Timeline Month Labels */}
                    <div className="flex justify-between text-xs font-mono text-ink-muted pt-2 border-t border-[#F0EBE0]">
                      {chartPoints.map((pt, i) => (
                        <span key={i}>{pt.label}</span>
                      ))}
                    </div>
                  </div>

                  {/* 3 Interactive Range Sliders */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-[#F0EBE0]">
                    
                    {/* Slider 1: MUSD Price */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-ink-muted">MUSD Price</span>
                        <span className="font-bold text-[#14130F]">${musdPrice.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.85"
                        max="1.05"
                        step="0.01"
                        value={musdPrice}
                        onChange={(e) => setMusdPrice(parseFloat(e.target.value))}
                        className="w-full accent-[#C84E29] cursor-pointer h-1.5 bg-[#E5DFD3] rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                        <span>$0.85</span>
                        <span>$1.05</span>
                      </div>
                    </div>

                    {/* Slider 2: Collateral Value */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-ink-muted">Collateral Value</span>
                        <span className="font-bold text-[#14130F]">${collateralValue.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="2000"
                        max="25000"
                        step="500"
                        value={collateralValue}
                        onChange={(e) => setCollateralValue(parseInt(e.target.value, 10))}
                        className="w-full accent-[#C84E29] cursor-pointer h-1.5 bg-[#E5DFD3] rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                        <span>$2k</span>
                        <span>$25k</span>
                      </div>
                    </div>

                    {/* Slider 3: Volatility */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-ink-muted">Volatility</span>
                        <span className="font-bold text-[#14130F]">± {volatilityPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        step="5"
                        value={volatilityPercent}
                        onChange={(e) => setVolatilityPercent(parseInt(e.target.value, 10))}
                        className="w-full accent-[#C84E29] cursor-pointer h-1.5 bg-[#E5DFD3] rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-ink-muted">
                        <span>5%</span>
                        <span>50%</span>
                      </div>
                    </div>

                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 5: OUR BELIEF                                     */}
        {/* ========================================================= */}
        <section
          id="belief"
          ref={beliefReveal.ref}
          className="relative py-20 md:py-32 overflow-hidden"
        >
          <div className="max-w-container mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              
              {/* Left Column: Sculpture Collage with "YOUR POSITION. YOUR RULES." */}
              <div
                className={`lg:col-span-5 relative transition-all duration-1000 ease-out ${
                  beliefReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-16'
                }`}
              >
                {/* Handwritten Tag: YOUR POSITION. YOUR RULES. */}
                <div className="absolute -top-10 left-4 z-20 flex flex-col items-start select-none pointer-events-none">
                  <span className="font-hand text-[#C84E29] text-xl sm:text-2xl font-bold tracking-wide rotate-3 whitespace-nowrap">
                    YOUR POSITION.<br />YOUR RULES.
                  </span>
                  <svg width="48" height="38" viewBox="0 0 48 38" fill="none" className="text-[#C84E29] mt-1 ml-4">
                    <path d="M6 6C16 12 28 18 38 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M28 28L38 30L36 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Classical Collage Artwork Frame */}
                <div className="relative select-none">
                  <Image
                    src="/assets/colosseum-statue.png"
                    alt="Classical Roman sculpture with cypress and Colosseum"
                    width={500}
                    height={600}
                    className="w-full h-auto object-contain filter drop-shadow-sm transform hover:scale-[1.02] transition-transform duration-700 ease-out"
                  />
                </div>
              </div>

              {/* Right Column: Narrative & Links */}
              <div
                className={`lg:col-span-7 space-y-6 transition-all duration-1000 ease-out ${
                  beliefReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16'
                }`}
              >
                <span className="text-xs font-mono uppercase tracking-widest text-[#78736B] font-semibold block">
                  OUR BELIEF
                </span>

                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-normal text-ink leading-[1.12] tracking-tight">
                  Better tools<br />
                  for a more stable<br />
                  ecosystem.
                </h2>

                <p className="text-base sm:text-lg font-sans text-ink-soft dark:text-ink-muted leading-relaxed max-w-xl">
                  A more informed community leads to fewer liquidations, healthier positions, and a
                  more resilient MUSD ecosystem. We build tools that give borrowers visibility and
                  control over their own risk parameters.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link href="/app/overview">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#14130F] dark:bg-white text-white dark:text-[#14130F] font-sans font-medium text-sm hover:bg-[#C84E29] dark:hover:bg-[#C84E29] dark:hover:text-white transition-all duration-200 shadow-sm">
                      <span>Explore Ballast</span>
                      <ArrowRight className="w-4 h-4 stroke-[2]" />
                    </button>
                  </Link>
                  <Link href="/whitepaper">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[#C8C2B4] dark:border-hairline bg-transparent text-ink font-sans font-medium text-sm hover:border-ink hover:text-[#C84E29] transition-all duration-200">
                      <span>Read the docs</span>
                    </button>
                  </Link>
                </div>

                {/* Decorative Stamp Badge on Bottom Right */}
                <div className="pt-6 flex justify-end">
                  <div className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-[#C84E29]/50 rounded-sm font-hand text-sm font-bold text-[#C84E29] rotate-2 select-none">
                    <span>BUILT FOR A MORE STABLE MUSD ECOSYSTEM</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* BESPOKE EDITORIAL FOOTER                                   */}
      {/* ========================================================= */}
      <footer className="border-t border-[#DFD9CC] dark:border-hairline bg-[#EFEAE0] dark:bg-[#0E0E0C] text-ink transition-colors">
        <div className="max-w-container mx-auto px-4 md:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start pb-12 border-b border-[#DFD9CC] dark:border-hairline">
            
            {/* Identity & Mission */}
            <div className="md:col-span-5 space-y-4">
              <Link href="/" className="flex items-center gap-2.5 group">
                <span className="w-8 h-8 rounded-sm bg-[#14130F] text-white flex items-center justify-center border border-[#14130F] group-hover:bg-[#C84E29] transition-colors">
                  <Anchor className="w-4 h-4 stroke-[1.5]" />
                </span>
                <span className="font-serif font-bold text-xl text-ink tracking-tight">
                  {BRAND_NAME}
                </span>
              </Link>

              <p className="text-xs font-sans text-ink-muted leading-relaxed max-w-sm">
                Risk tools for a more stable MUSD ecosystem. Autonomous protection vaults, scenario modeling, and liquidation defenses on Mezo.
              </p>

              {/* Social icons */}
              <div className="flex items-center gap-3 pt-2 text-ink-muted">
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#D5CFC2] dark:border-hairline flex items-center justify-center hover:text-[#C84E29] hover:border-[#C84E29] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">X</span>
                </a>
                <a
                  href="https://github.com/SIDDHUX9/BALLAST"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#D5CFC2] dark:border-hairline flex items-center justify-center hover:text-[#C84E29] hover:border-[#C84E29] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Protocol Column */}
            <div className="md:col-span-2 space-y-2.5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink block mb-1">
                Protocol
              </span>
              <ul className="space-y-2 text-xs font-sans text-ink-muted">
                <li>
                  <Link href="/whitepaper" className="hover:text-ink transition-colors">
                    Docs &amp; Spec
                  </Link>
                </li>
                <li>
                  <a href="#simulator" className="hover:text-ink transition-colors">
                    Risk Framework
                  </a>
                </li>
                <li>
                  <Link href="/app/activity" className="hover:text-ink transition-colors">
                    Changelog &amp; Logs
                  </Link>
                </li>
              </ul>
            </div>

            {/* Community Column */}
            <div className="md:col-span-2 space-y-2.5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink block mb-1">
                Community
              </span>
              <ul className="space-y-2 text-xs font-sans text-ink-muted">
                <li>
                  <a
                    href="https://github.com/SIDDHUX9/BALLAST"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-ink transition-colors"
                  >
                    GitHub Source
                  </a>
                </li>
                <li>
                  <Link href="/app/alerts" className="hover:text-ink transition-colors">
                    Telegram Bot
                  </Link>
                </li>
                <li>
                  <a
                    href="https://mezo.org"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-ink transition-colors"
                  >
                    Mezo Network
                  </a>
                </li>
              </ul>
            </div>

            {/* Newsletter / Stay Updated Column */}
            <div className="md:col-span-3 space-y-3">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink block mb-1">
                Get Updates
              </span>
              <div className="flex items-center rounded-full bg-white dark:bg-[#1A1916] border border-[#D5CFC2] dark:border-hairline p-1 pl-3 shadow-inner">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="bg-transparent text-xs font-sans text-ink focus:outline-none w-full"
                />
                <button
                  type="button"
                  className="w-7 h-7 rounded-full bg-[#14130F] dark:bg-white text-white dark:text-[#14130F] flex items-center justify-center shrink-0 hover:bg-[#C84E29] transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2]" />
                </button>
              </div>
              <p className="text-[11px] font-mono text-ink-muted">
                No noise. Just important protocol updates.
              </p>
            </div>

          </div>

          {/* Bottom Bar: Copyright & Architectural Sketch */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs font-mono text-ink-muted">
              &copy; 2026 Ballast. All rights reserved.
            </span>

            {/* Handwritten architectural sketch note */}
            <div className="flex items-center gap-3 select-none">
              <span className="font-hand text-ink-muted text-lg sm:text-xl font-bold tracking-wide -rotate-2">
                STAY AHEAD.<br />STAY IN CONTROL.
              </span>
              <svg width="60" height="32" viewBox="0 0 60 32" fill="none" className="text-ink-muted opacity-60">
                <path d="M4 28H56M12 28V16M20 28V14M28 28V10C28 6 32 4 36 10V28M44 28V14M52 28V16M36 4V1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
