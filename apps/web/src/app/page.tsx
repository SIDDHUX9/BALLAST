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
} from 'lucide-react';

// Scroll reveal hook that ensures visibility even if observer triggers late or static render
function useScrollReveal<T extends HTMLElement>(threshold = 0.1) {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    );

    observer.observe(node);

    // Fallback: Ensure elements become visible after a short delay so content is never blank
    const fallbackTimer = setTimeout(() => {
      setIsVisible(true);
    }, 350);

    return () => {
      observer.disconnect();
      clearTimeout(fallbackTimer);
    };
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

  // Scroll Reveal Refs
  const heroReveal = useScrollReveal<HTMLDivElement>(0.05);
  const problemReveal = useScrollReveal<HTMLDivElement>(0.1);
  const stepsReveal = useScrollReveal<HTMLDivElement>(0.1);
  const simulatorReveal = useScrollReveal<HTMLDivElement>(0.1);
  const beliefReveal = useScrollReveal<HTMLDivElement>(0.1);

  // Chart points data generated dynamically based on active timeframe and ICR
  const chartPoints = useMemo(() => {
    const base = simulatedICR > 0 ? simulatedICR : 226.7;
    const vFactor = volatilityPercent / 100;
    const offsets = [-0.08, 0.05, -0.03, 0.09, 0.0, -0.04, 0.02];
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
    const height = 170;
    const minVal = 100;
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
    <div className="min-h-screen bg-[#F5F1E8] text-[#14130F] flex flex-col font-sans selection:bg-[#C84E29] selection:text-white overflow-x-hidden">
      <Header />

      <main className="grow">
        {/* ========================================================= */}
        {/* SECTION 1: HERO SECTION                                   */}
        {/* ========================================================= */}
        <section className="relative pt-8 sm:pt-12 md:pt-16 pb-16 sm:pb-20 md:pb-24 overflow-hidden">
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
              
              {/* Left Column: Headlines & CTA Buttons */}
              <div
                ref={heroReveal.ref}
                className={`lg:col-span-6 space-y-6 z-10 transition-all duration-700 ease-out ${
                  heroReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
              >
                {/* Category Tag */}
                <div className="inline-flex items-center">
                  <span className="text-[11px] font-mono font-semibold tracking-[0.16em] uppercase text-[#78736B]">
                    MUSD · COLLATERAL RISK INFRASTRUCTURE
                  </span>
                </div>

                {/* Primary Editorial Title */}
                <h1 className="text-[52px] sm:text-[64px] lg:text-[72px] font-serif font-normal tracking-tight text-[#14130F] leading-[1.03]">
                  Lend<br />
                  Bitcoin<br />
                  <span className="italic font-serif text-[#C84E29]">
                    with clarity.
                  </span>
                </h1>

                {/* Narrative Lead Paragraph */}
                <p className="text-[15px] sm:text-base font-sans text-[#5A554E] leading-relaxed max-w-[430px]">
                  Ballast helps MUSD borrowers understand liquidation risk, model market scenarios,
                  and keep a deliberate buffer between their position and the edge.
                </p>

                {/* CTA Action Buttons */}
                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link href="/app/overview">
                    <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#14130F] text-white font-sans font-medium text-xs sm:text-sm hover:bg-[#C84E29] transition-all duration-200 shadow-sm hover:shadow">
                      <span>Launch App</span>
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                  </Link>
                  <Link href="/whitepaper">
                    <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#C8C2B4] bg-transparent text-[#14130F] font-sans font-medium text-xs sm:text-sm hover:border-[#14130F] hover:text-[#C84E29] transition-all duration-200">
                      <span>Explore the framework</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                  </Link>
                </div>

                {/* 3 Pillar Micro-Badges */}
                <div className="pt-8 border-t border-[#DFD9CC] grid grid-cols-1 sm:grid-cols-3 gap-5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#EAE3D4] flex items-center justify-center shrink-0 text-[#C84E29]">
                      <BarChart3 className="w-3.5 h-3.5 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#14130F]">
                        Real-time data
                      </h4>
                      <p className="text-[11px] font-sans text-[#78736B] mt-0.5 leading-tight">
                        Live position monitoring
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#EAE3D4] flex items-center justify-center shrink-0 text-[#C84E29]">
                      <Box className="w-3.5 h-3.5 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#14130F]">
                        Scenario analysis
                      </h4>
                      <p className="text-[11px] font-sans text-[#78736B] mt-0.5 leading-tight">
                        Model market moves
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#EAE3D4] flex items-center justify-center shrink-0 text-[#C84E29]">
                      <ShieldCheck className="w-3.5 h-3.5 stroke-[2]" />
                    </div>
                    <div>
                      <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#14130F]">
                        Non-custodial
                      </h4>
                      <p className="text-[11px] font-sans text-[#78736B] mt-0.5 leading-tight">
                        Your positions, your control
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Collage & Floating Position Card */}
              <div className="lg:col-span-6 relative flex flex-col items-center lg:items-end">
                {/* Handwritten Annotation: SAME MARKETS. BETTER DECISIONS. */}
                <div className="absolute -top-10 sm:-top-8 right-6 sm:right-10 z-30 flex flex-col items-end pointer-events-none select-none">
                  <span className="font-hand text-[#C84E29] text-xl sm:text-2xl font-bold tracking-wide -rotate-3 whitespace-nowrap leading-tight text-right">
                    SAME MARKETS.<br />BETTER DECISIONS.
                  </span>
                  <svg width="42" height="36" viewBox="0 0 48 42" fill="none" className="text-[#C84E29] mt-0.5 mr-3">
                    <path d="M38 4C28 12 14 20 8 34" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M16 32L8 34L6 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Hero Artwork - Classical Collage sitting seamlessly on warm background */}
                <div className="relative w-full max-w-[500px]">
                  <Image
                    src="/assets/hero-david.jpg"
                    alt="Classical sculpture collage with David wearing sunglasses, Italian stamp, and Florence Duomo"
                    width={520}
                    height={540}
                    priority
                    className="w-full h-auto object-contain filter drop-shadow-sm select-none"
                  />

                  {/* Floating "Your Position" Card overlapping David */}
                  <div className="absolute -bottom-6 left-0 sm:left-4 z-20 w-[290px] sm:w-[320px] bg-white rounded-2xl p-4 sm:p-5 shadow-[0_16px_40px_rgba(20,19,15,0.08)] border border-[#EAE4D8] transition-transform duration-300 hover:scale-[1.01]">
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#F4EFE6]">
                      <span className="font-sans font-bold text-xs sm:text-sm text-[#14130F]">Your Position</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[#EAF5EF] text-[#2F6F5E]">
                        Healthy
                      </span>
                    </div>

                    <div className="pt-2.5">
                      <span className="text-[10px] font-mono text-[#8C877D] uppercase tracking-wider block">
                        Collateral ratio
                      </span>
                      <div className="text-3xl sm:text-4xl font-mono font-bold text-[#14130F] mt-0.5 tracking-tight">
                        226.7%
                      </div>

                      {/* Gradient Health Ratio Bar with Needle Marker */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="relative h-2 w-full rounded-full bg-gradient-to-r from-[#D95C34] via-[#E5A93C] to-[#3B967D]">
                          {/* Needle Indicator at ~68% position */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#14130F] border-2 border-white shadow-md transition-all duration-300"
                            style={{ left: '68%' }}
                          />
                        </div>

                        {/* Threshold Scale Marks */}
                        <div className="flex justify-between text-[9px] font-mono text-[#8C877D] pt-0.5">
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
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 2: THE PROBLEM (WITH COLOSSEUM-STATUE.PNG)        */}
        {/* ========================================================= */}
        <section
          id="problem"
          ref={problemReveal.ref}
          className="py-16 sm:py-20 md:py-28 overflow-hidden"
        >
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              
              {/* Left Column: Problem Narrative */}
              <div
                className={`lg:col-span-6 space-y-5 transition-all duration-700 ease-out ${
                  problemReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
                }`}
              >
                <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#78736B] font-semibold block">
                  THE PROBLEM
                </span>

                <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-serif font-normal text-[#14130F] leading-[1.08] tracking-tight">
                  Markets move<br />
                  fast. <span className="italic font-serif text-[#C84E29]">Uncertainty</span><br />
                  shouldn’t decide<br />
                  for you.
                </h2>

                <p className="text-[15px] sm:text-base font-sans text-[#5A554E] leading-relaxed max-w-[430px]">
                  Volatility, sudden market moves, and complex parameters make it hard to know when you’re really at risk. Guessing leads to liquidations.
                </p>

                <div className="pt-2">
                  <a
                    href="#simulator"
                    className="inline-flex items-center gap-2 text-xs sm:text-sm font-sans font-semibold text-[#14130F] hover:text-[#C84E29] transition-colors group"
                  >
                    <span>See the problem</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.2] group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Right Column: Colosseum Architectural Sculpture with Annotation */}
              <div
                className={`lg:col-span-6 relative flex flex-col items-center lg:items-end transition-all duration-700 ease-out ${
                  problemReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
                }`}
              >
                {/* Handwritten Note: CLEAR DATA. CALMER POSITIONS. MORE CONTROL. */}
                <div className="absolute -top-7 sm:-top-8 right-4 sm:right-8 z-20 flex flex-col items-end pointer-events-none select-none">
                  <span className="font-hand text-[#C84E29] text-lg sm:text-xl font-bold tracking-wide -rotate-3 text-right leading-tight">
                    CLEAR DATA.<br />
                    CALMER POSITIONS.<br />
                    MORE CONTROL.
                  </span>
                </div>

                {/* Colosseum Monument Artwork */}
                <div className="relative w-full max-w-[460px] select-none">
                  <Image
                    src="/assets/colosseum-statue.png"
                    alt="Italian architectural monument with Colosseum, cypress, and classical marble pillar"
                    width={480}
                    height={520}
                    className="w-full h-auto object-contain filter drop-shadow-sm transition-transform duration-700 ease-out hover:scale-[1.02]"
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
          className="relative py-16 sm:py-20 md:py-28 overflow-hidden"
        >
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12">
            
            {/* Top Row: Heading and Michelangelo Pointing Arm */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12 sm:mb-16">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#78736B] font-semibold block mb-2">
                  HOW IT WORKS
                </span>
                <h2 className="text-4xl sm:text-5xl lg:text-[56px] font-serif font-normal text-[#14130F] leading-tight">
                  Three{' '}
                  <span className="italic font-serif text-[#C84E29]">
                    simple
                  </span>{' '}
                  steps.
                </h2>
              </div>

              {/* Pointing Arm Artwork with Smooth Slide-in from Right */}
              <div
                className={`relative flex items-center gap-3 self-end lg:self-auto transition-all duration-1000 ease-out ${
                  stepsReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-16'
                }`}
              >
                {/* Handwritten Tag: FROM DATA TO DECISIONS. */}
                <div className="flex flex-col items-center select-none pointer-events-none">
                  <span className="font-hand text-[#C84E29] text-xl sm:text-2xl font-bold tracking-wide -rotate-6 whitespace-nowrap leading-tight text-center">
                    FROM DATA<br />TO DECISIONS.
                  </span>
                  <svg width="44" height="28" viewBox="0 0 54 36" fill="none" className="text-[#C84E29] mt-0.5">
                    <path d="M44 4C30 8 16 16 6 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M15 28L6 30L8 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Pointing Arm Sculpture Image */}
                <div className="w-56 sm:w-72 lg:w-80 shrink-0 select-none">
                  <Image
                    src="/assets/pointing-arm.png"
                    alt="Classical marble sculpture arm pointing towards steps"
                    width={420}
                    height={180}
                    className="w-full h-auto object-contain filter drop-shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* 3 Step Columns with Hairline Separators */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 pt-4">
              
              {/* Step 01 */}
              <div className="space-y-3 md:pr-8 lg:pr-10">
                <span className="text-3xl font-mono font-bold text-[#14130F] block">01</span>
                <div className="flex items-center gap-2 text-[#C84E29] pt-1">
                  <Link2 className="w-4 h-4 stroke-[2.2]" />
                  <h3 className="text-lg font-serif font-bold text-[#14130F]">
                    Connect &amp; view
                  </h3>
                </div>
                <p className="text-sm font-sans text-[#78736B] leading-relaxed">
                  See your position and current risk in real time.
                </p>
              </div>

              {/* Step 02 */}
              <div className="space-y-3 md:px-8 lg:px-10 md:border-l md:border-[#DFD9CC]">
                <span className="text-3xl font-mono font-bold text-[#14130F] block">02</span>
                <div className="flex items-center gap-2 text-[#C84E29] pt-1">
                  <BarChart3 className="w-4 h-4 stroke-[2.2]" />
                  <h3 className="text-lg font-serif font-bold text-[#14130F]">
                    Stress-test
                  </h3>
                </div>
                <p className="text-sm font-sans text-[#78736B] leading-relaxed">
                  Model different market scenarios and discover thresholds.
                </p>
              </div>

              {/* Step 03 */}
              <div className="space-y-3 md:pl-8 lg:pl-10 md:border-l md:border-[#DFD9CC]">
                <span className="text-3xl font-mono font-bold text-[#14130F] block">03</span>
                <div className="flex items-center gap-2 text-[#C84E29] pt-1">
                  <Zap className="w-4 h-4 stroke-[2.2]" />
                  <h3 className="text-lg font-serif font-bold text-[#14130F]">
                    Take action
                  </h3>
                </div>
                <p className="text-sm font-sans text-[#78736B] leading-relaxed">
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
          className="relative py-16 sm:py-20 md:py-28 bg-[#C04A26] text-white overflow-hidden"
        >
          {/* Background Colosseum Collage Overlay */}
          <div className="absolute inset-0 z-0 opacity-35 mix-blend-multiply pointer-events-none select-none">
            <Image
              src="/assets/terracotta-colosseum.jpg"
              alt="Terracotta collage with Colosseum arches and warm textures"
              fill
              className="object-cover object-left"
            />
          </div>

          <div className="relative z-10 max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              
              {/* Left Column: Heading & Narrative */}
              <div
                className={`lg:col-span-5 space-y-5 transition-all duration-700 ease-out ${
                  simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
              >
                <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#F7EDE6] font-semibold block">
                  INTERACTIVE SIMULATOR
                </span>

                <h2 className="text-4xl sm:text-5xl font-serif font-normal leading-[1.12] tracking-tight text-white">
                  Model<br />the unexpected.
                </h2>

                <p className="text-[15px] sm:text-base font-sans text-[#F7EDE6] leading-relaxed max-w-sm">
                  Adjust variables, simulate market moves, and see how they impact your position in real time.
                </p>

                <div className="pt-2">
                  <Link href="/app/stress-test">
                    <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#14130F] text-white font-sans font-medium text-xs sm:text-sm hover:bg-white hover:text-[#C04A26] transition-all duration-200 shadow-md">
                      <span>Try the simulator</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Right Column: Interactive Position Simulator Card */}
              <div
                className={`lg:col-span-7 transition-all duration-700 ease-out ${
                  simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
              >
                <div className="bg-white text-[#14130F] rounded-2xl p-5 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.22)] max-w-xl mx-auto lg:mr-0">
                  
                  {/* Card Header & Timeframe Tabs */}
                  <div className="flex flex-row items-center justify-between gap-3 pb-5 border-b border-[#F0EBE0]">
                    <h3 className="font-serif font-bold text-lg sm:text-xl text-[#14130F]">
                      Position Simulator
                    </h3>

                    {/* Timeframe selector pill */}
                    <div className="flex items-center rounded-full bg-[#F4F1EA] p-0.5 text-xs font-mono">
                      {(['1D', '1W', '1M', '1Y'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeframe(t)}
                          className={`px-3 py-1 rounded-full text-[11px] transition-all duration-150 ${
                            timeframe === t
                              ? 'bg-[#14130F] text-white font-bold shadow-sm'
                              : 'text-[#78736B] hover:text-[#14130F]'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Top 3 Live Calculated Metrics */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 py-5 border-b border-[#F0EBE0]">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#8C877D] block">
                        Collateral ratio
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xl sm:text-2xl font-mono font-bold text-[#14130F] tracking-tight">
                          {icrFormatted}%
                        </span>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold uppercase ${
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
                      <span className="text-[10px] font-mono uppercase text-[#8C877D] block">
                        MUSD debt
                      </span>
                      <div className="text-xl sm:text-2xl font-mono font-bold text-[#14130F] mt-0.5 tracking-tight">
                        ${debt.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-[#8C877D] block">
                        Collateral value
                      </span>
                      <div className="text-xl sm:text-2xl font-mono font-bold text-[#14130F] mt-0.5 tracking-tight">
                        ${collateralValue.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Interactive SVG Chart */}
                  <div className="py-5">
                    <div className="relative h-40 w-full">
                      <svg
                        viewBox="0 0 500 170"
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="simAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C84E29" stopOpacity="0.22" />
                            <stop offset="100%" stopColor="#C84E29" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Reference lines */}
                        <line x1="0" y1="130" x2="500" y2="130" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="126" fill="#999" fontSize="9" fontFamily="monospace">100%</text>

                        <line x1="0" y1="90" x2="500" y2="90" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="86" fill="#999" fontSize="9" fontFamily="monospace">150%</text>

                        <line x1="0" y1="48" x2="500" y2="48" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="44" fill="#999" fontSize="9" fontFamily="monospace">200%</text>

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

                      {/* Tooltip on Active Point */}
                      {chartSvgPath.points[activeChartPoint] && (
                        <div
                          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full -top-1 px-2.5 py-1 bg-[#14130F] text-white rounded text-[10px] font-mono shadow-md whitespace-nowrap"
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
                    <div className="flex justify-between text-[11px] font-mono text-[#8C877D] pt-2 border-t border-[#F0EBE0]">
                      {chartPoints.map((pt, i) => (
                        <span key={i}>{pt.label}</span>
                      ))}
                    </div>
                  </div>

                  {/* 3 Interactive Sliders */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#F0EBE0]">
                    
                    {/* Slider 1: MUSD Price */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-[#8C877D]">MUSD Price</span>
                        <span className="font-bold text-[#14130F]">${musdPrice.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.50"
                        max="1.50"
                        step="0.01"
                        value={musdPrice}
                        onChange={(e) => setMusdPrice(parseFloat(e.target.value))}
                        className="w-full accent-[#C84E29] cursor-pointer h-1.5 bg-[#E5DFD3] rounded-lg"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-[#8C877D]">
                        <span>$0.50</span>
                        <span>$1.50</span>
                      </div>
                    </div>

                    {/* Slider 2: Collateral Value */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-[#8C877D]">Collateral Value</span>
                        <span className="font-bold text-[#14130F]">${collateralValue.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="1000"
                        max="30000"
                        step="500"
                        value={collateralValue}
                        onChange={(e) => setCollateralValue(parseInt(e.target.value, 10))}
                        className="w-full accent-[#C84E29] cursor-pointer h-1.5 bg-[#E5DFD3] rounded-lg"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-[#8C877D]">
                        <span>$1k</span>
                        <span>$30k</span>
                      </div>
                    </div>

                    {/* Slider 3: Volatility */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-[#8C877D]">Volatility</span>
                        <span className="font-bold text-[#14130F]">± {volatilityPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={volatilityPercent}
                        onChange={(e) => setVolatilityPercent(parseInt(e.target.value, 10))}
                        className="w-full accent-[#C84E29] cursor-pointer h-1.5 bg-[#E5DFD3] rounded-lg"
                      />
                      <div className="flex justify-between text-[9px] font-mono text-[#8C877D]">
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
        {/* SECTION 5: OUR BELIEF (WITH DAVID-CUTOUT & FACADE)        */}
        {/* ========================================================= */}
        <section
          id="belief"
          ref={beliefReveal.ref}
          className="relative py-16 sm:py-20 md:py-28 overflow-hidden"
        >
          <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              
              {/* Left Part: David Statue with Orange & "YOUR POSITION. YOUR RULES." */}
              <div
                className={`lg:col-span-4 relative flex flex-col items-center lg:items-start transition-all duration-700 ease-out ${
                  beliefReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
                }`}
              >
                {/* Handwritten Tag: YOUR POSITION. YOUR RULES. */}
                <div className="absolute -top-8 left-2 sm:left-4 z-20 flex flex-col items-start select-none pointer-events-none">
                  <span className="font-hand text-[#C84E29] text-lg sm:text-xl font-bold tracking-wide -rotate-3 whitespace-nowrap leading-tight">
                    YOUR POSITION.<br />YOUR RULES.
                  </span>
                  <svg width="40" height="30" viewBox="0 0 48 38" fill="none" className="text-[#C84E29] mt-0.5 ml-2">
                    <path d="M6 6C16 12 28 18 38 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M28 28L38 30L36 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* David Statue Cutout with Orange */}
                <div className="relative w-full max-w-[340px] select-none">
                  <Image
                    src="/assets/belief-david-cutout.png"
                    alt="David classical sculpture with orange and laurel wreath"
                    width={380}
                    height={460}
                    className="w-full h-auto object-contain filter drop-shadow-sm transition-transform duration-700 ease-out hover:scale-[1.02]"
                  />
                </div>
              </div>

              {/* Middle Part: Our Belief Copy & CTA Buttons */}
              <div
                className={`lg:col-span-5 space-y-5 transition-all duration-700 ease-out ${
                  beliefReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
              >
                <span className="text-[11px] font-mono uppercase tracking-[0.16em] text-[#78736B] font-semibold block">
                  OUR BELIEF
                </span>

                <h2 className="text-4xl sm:text-5xl lg:text-[54px] font-serif font-normal text-[#14130F] leading-[1.08] tracking-tight">
                  Better tools<br />
                  for a more stable<br />
                  ecosystem.
                </h2>

                <p className="text-[15px] sm:text-base font-sans text-[#5A554E] leading-relaxed max-w-md">
                  A more informed community leads to fewer liquidations, healthier positions, and a
                  more resilient MUSD ecosystem.
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <Link href="/app/overview">
                    <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[#14130F] text-white font-sans font-medium text-xs sm:text-sm hover:bg-[#C84E29] transition-all duration-200 shadow-sm">
                      <span>Explore Ballast</span>
                      <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
                    </button>
                  </Link>
                  <Link href="/whitepaper">
                    <button className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-[#C8C2B4] bg-transparent text-[#14130F] font-sans font-medium text-xs sm:text-sm hover:border-[#14130F] hover:text-[#C84E29] transition-all duration-200">
                      <span>Read the docs</span>
                    </button>
                  </Link>
                </div>
              </div>

              {/* Right Part: Italian Building Facade with Lamp & Stamp */}
              <div
                className={`lg:col-span-3 relative flex flex-col items-center lg:items-end justify-center transition-all duration-700 ease-out ${
                  beliefReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
                }`}
              >
                <div className="relative w-full max-w-[240px] sm:max-w-[280px] lg:max-w-[260px] select-none">
                  <Image
                    src="/assets/belief-david-facade.jpg"
                    alt="Italian building facade with street lamp and blue torn paper"
                    width={300}
                    height={380}
                    className="w-full h-auto object-cover rounded-sm filter drop-shadow-sm"
                  />

                  {/* Rotated Stamp Badge */}
                  <div className="absolute -bottom-5 -left-3 sm:-left-6 z-10">
                    <div className="inline-block px-3 py-1.5 border border-dashed border-[#C84E29] bg-[#F5F1E8]/95 backdrop-blur-sm rounded-sm font-hand text-xs sm:text-sm font-bold text-[#C84E29] -rotate-3 select-none shadow-sm leading-tight text-center">
                      BUILT FOR<br />A MORE STABLE<br />MUSD ECOSYSTEM
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      </main>

      {/* ========================================================= */}
      {/* SECTION 6: EDITORIAL FOOTER                                */}
      {/* ========================================================= */}
      <footer className="border-t border-[#DFD9CC] bg-[#EFEAE0] text-[#14130F]">
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 lg:px-12 py-14 sm:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 items-start pb-12 border-b border-[#DFD9CC]">
            
            {/* Identity & Mission */}
            <div className="md:col-span-5 space-y-3.5">
              <Link href="/" className="flex items-center gap-2 group">
                <span className="text-[#14130F] group-hover:text-[#C84E29] transition-colors">
                  <Anchor className="w-5 h-5 stroke-[2.2]" />
                </span>
                <span className="font-serif font-black text-xl text-[#14130F] tracking-wider uppercase">
                  {BRAND_NAME}
                </span>
              </Link>

              <p className="text-xs font-sans text-[#78736B] leading-relaxed max-w-xs">
                Risk tools for a more stable MUSD ecosystem.
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-2.5 pt-1 text-[#5A554E]">
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-7 h-7 rounded-full border border-[#D5CFC2] flex items-center justify-center hover:text-[#C84E29] hover:border-[#C84E29] transition-colors"
                >
                  <span className="font-mono text-[11px] font-bold">X</span>
                </a>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-7 h-7 rounded-full border border-[#D5CFC2] flex items-center justify-center hover:text-[#C84E29] hover:border-[#C84E29] transition-colors"
                >
                  <span className="font-mono text-[11px] font-bold">⚑</span>
                </a>
                <a
                  href="https://github.com/SIDDHUX9/BALLAST"
                  target="_blank"
                  rel="noreferrer"
                  className="w-7 h-7 rounded-full border border-[#D5CFC2] flex items-center justify-center hover:text-[#C84E29] hover:border-[#C84E29] transition-colors"
                >
                  <span className="font-mono text-[11px] font-bold">&lt;/&gt;</span>
                </a>
              </div>
            </div>

            {/* Protocol Column */}
            <div className="md:col-span-2 space-y-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#14130F] block mb-1">
                Protocol
              </span>
              <ul className="space-y-1.5 text-xs font-sans text-[#78736B]">
                <li>
                  <Link href="/whitepaper" className="hover:text-[#14130F] transition-colors">
                    Docs
                  </Link>
                </li>
                <li>
                  <a href="#simulator" className="hover:text-[#14130F] transition-colors">
                    Risk framework
                  </a>
                </li>
                <li>
                  <Link href="/app/activity" className="hover:text-[#14130F] transition-colors">
                    Changelog
                  </Link>
                </li>
              </ul>
            </div>

            {/* Community Column */}
            <div className="md:col-span-2 space-y-2">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#14130F] block mb-1">
                Community
              </span>
              <ul className="space-y-1.5 text-xs font-sans text-[#78736B]">
                <li>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#14130F] transition-colors"
                  >
                    X
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/SIDDHUX9/BALLAST"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#14130F] transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:contact@ballast.fi"
                    className="hover:text-[#14130F] transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            {/* Newsletter / Get Updates */}
            <div className="md:col-span-3 space-y-2.5">
              <div className="flex items-center rounded-lg bg-white border border-[#D5CFC2] p-1 pl-3 shadow-inner">
                <input
                  type="email"
                  placeholder="Get updates"
                  className="bg-transparent text-xs font-sans text-[#14130F] placeholder-[#8C877D] focus:outline-none w-full"
                />
                <button
                  type="button"
                  className="w-6 h-6 rounded-md bg-[#14130F] text-white flex items-center justify-center shrink-0 hover:bg-[#C84E29] transition-colors"
                >
                  <ArrowRight className="w-3 h-3 stroke-[2.2]" />
                </button>
              </div>
              <p className="text-[11px] font-sans text-[#78736B]">
                No noise. Just important updates.
              </p>
            </div>

          </div>

          {/* Bottom Bar: Copyright & Architectural Cathedral Sketch */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-xs font-mono text-[#8C877D]">
              &copy; 2026 Ballast. All rights reserved.
            </span>

            {/* Handwritten Architectural Sketch Note */}
            <div className="flex items-center gap-3 select-none">
              <span className="font-hand text-[#78736B] text-lg sm:text-xl font-bold tracking-wide -rotate-2">
                STAY AHEAD.<br />STAY IN CONTROL.
              </span>
              <svg width="68" height="34" viewBox="0 0 60 32" fill="none" className="text-[#8C877D] opacity-70">
                <path d="M4 28H56M12 28V16M20 28V14M28 28V10C28 6 32 4 36 10V28M44 28V14M52 28V16M36 4V1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
