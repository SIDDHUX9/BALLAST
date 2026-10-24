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

// Scroll reveal hook ensuring smooth slide-in without ever leaving blank sections
function useScrollReveal<T extends HTMLElement>(threshold = 0.05) {
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
      { threshold, rootMargin: '0px 0px -30px 0px' }
    );

    observer.observe(node);

    const fallbackTimer = setTimeout(() => {
      setIsVisible(true);
    }, 200);

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
  const problemReveal = useScrollReveal<HTMLDivElement>(0.05);
  const stepsReveal = useScrollReveal<HTMLDivElement>(0.05);
  const simulatorReveal = useScrollReveal<HTMLDivElement>(0.05);
  const beliefReveal = useScrollReveal<HTMLDivElement>(0.05);

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
    const width = 600;
    const height = 180;
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
        {/* SECTION 1: HERO SECTION (STICKING TO RIGHT EDGE)           */}
        {/* ========================================================= */}
        <section className="relative pt-6 sm:pt-10 md:pt-14 pb-16 sm:pb-20 md:pb-24 overflow-hidden">
          <div className="w-full max-w-[1600px] mx-auto pl-6 sm:pl-10 lg:pl-16 xl:pl-20 pr-0">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
              
              {/* Left Column: Headlines & CTA Buttons */}
              <div
                ref={heroReveal.ref}
                className={`lg:col-span-5 space-y-6 z-10 pr-6 sm:pr-8 transition-all duration-700 ease-out ${
                  heroReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
              >
                {/* Category Tag */}
                <div className="inline-flex items-center">
                  <span className="text-xs font-mono font-semibold tracking-[0.18em] uppercase text-[#78736B]">
                    MUSD · COLLATERAL RISK INFRASTRUCTURE
                  </span>
                </div>

                {/* Primary Editorial Title */}
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-[76px] font-serif font-normal tracking-tight text-[#14130F] leading-[1.02]">
                  Lend<br />
                  Bitcoin<br />
                  <span className="italic font-serif text-[#C84E29]">
                    with clarity.
                  </span>
                </h1>

                {/* Narrative Lead Paragraph */}
                <p className="text-base sm:text-lg font-sans text-[#5A554E] leading-relaxed max-w-[460px]">
                  Ballast helps MUSD borrowers understand liquidation risk, model market scenarios,
                  and keep a deliberate buffer between their position and the edge.
                </p>

                {/* CTA Action Buttons */}
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <Link href="/app/overview">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#14130F] text-white font-sans font-medium text-sm hover:bg-[#C84E29] transition-all duration-200 shadow-sm hover:shadow">
                      <span>Launch App</span>
                      <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </Link>
                  <Link href="/whitepaper">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[#C8C2B4] bg-transparent text-[#14130F] font-sans font-medium text-sm hover:border-[#14130F] hover:text-[#C84E29] transition-all duration-200">
                      <span>Explore the framework</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </Link>
                </div>

                {/* 3 Pillar Micro-Badges under Hero Text */}
                <div className="pt-8 border-t border-[#DFD9CC] grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-lg">
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

              {/* Right Column: Hero Collage Sticking Flush to the Right Viewport Edge */}
              <div className="lg:col-span-7 relative flex justify-end pr-0 mt-8 lg:mt-0">
                {/* Handwritten Annotation: SAME MARKETS. BETTER DECISIONS. */}
                <div className="absolute -top-10 sm:-top-8 right-6 sm:right-16 z-30 flex flex-col items-end pointer-events-none select-none">
                  <span className="font-hand text-[#C84E29] text-2xl sm:text-3xl font-bold tracking-wide -rotate-3 whitespace-nowrap leading-tight text-right">
                    SAME MARKETS.<br />BETTER DECISIONS.
                  </span>
                  <svg width="48" height="40" viewBox="0 0 48 42" fill="none" className="text-[#C84E29] mt-0.5 mr-4">
                    <path d="M38 4C28 12 14 20 8 34" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M16 32L8 34L6 24" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Hero Artwork - Large Classical Collage flush against right border */}
                <div className="relative w-full max-w-[760px] xl:max-w-[840px] ml-auto mr-0">
                  <Image
                    src="/assets/hero-david.jpg"
                    alt="Classical sculpture collage with David wearing sunglasses, Italian stamp, and Florence Duomo"
                    width={1024}
                    height={575}
                    priority
                    className="w-full h-auto object-contain filter drop-shadow-sm select-none"
                  />

                  {/* Floating "Your Position" Card overlapping David */}
                  <div className="absolute -bottom-8 sm:-bottom-10 left-2 sm:left-6 lg:left-10 z-20 w-[310px] sm:w-[360px] bg-white rounded-2xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(20,19,15,0.1)] border border-[#EAE4D8] transition-transform duration-300 hover:scale-[1.01]">
                    <div className="flex items-center justify-between pb-3 border-b border-[#F4EFE6]">
                      <span className="font-sans font-bold text-sm sm:text-base text-[#14130F]">Your Position</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#EAF5EF] text-[#2F6F5E]">
                        Healthy
                      </span>
                    </div>

                    <div className="pt-3">
                      <span className="text-[11px] font-mono text-[#8C877D] uppercase tracking-wider block">
                        Collateral ratio
                      </span>
                      <div className="text-3xl sm:text-4xl font-mono font-bold text-[#14130F] mt-0.5 tracking-tight">
                        226.7%
                      </div>

                      {/* Gradient Health Ratio Bar with Needle Marker */}
                      <div className="mt-4 space-y-1.5">
                        <div className="relative h-2.5 w-full rounded-full bg-gradient-to-r from-[#D95C34] via-[#E5A93C] to-[#3B967D]">
                          {/* Needle Indicator */}
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[#14130F] border-2 border-white shadow-md transition-all duration-300"
                            style={{ left: '68%' }}
                          />
                        </div>

                        {/* Threshold Scale Marks */}
                        <div className="flex justify-between text-[10px] font-mono text-[#8C877D] pt-0.5">
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
        {/* SECTION 2: THE PROBLEM (COLOSSEUM STICKING TO RIGHT EDGE)  */}
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
                className={`lg:col-span-5 space-y-6 pr-6 sm:pr-8 transition-all duration-700 ease-out ${
                  problemReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
                }`}
              >
                <span className="text-xs font-mono uppercase tracking-[0.18em] text-[#78736B] font-semibold block">
                  THE PROBLEM
                </span>

                <h2 className="text-4xl sm:text-5xl lg:text-[62px] font-serif font-normal text-[#14130F] leading-[1.06] tracking-tight">
                  Markets move<br />
                  fast. <span className="italic font-serif text-[#C84E29]">Uncertainty</span><br />
                  shouldn’t decide<br />
                  for you.
                </h2>

                <p className="text-base sm:text-lg font-sans text-[#5A554E] leading-relaxed max-w-[460px]">
                  Volatility, sudden market moves, and complex parameters make it hard to know when you’re really at risk. Guessing leads to liquidations.
                </p>

                <div className="pt-2">
                  <a
                    href="#simulator"
                    className="inline-flex items-center gap-2 text-sm font-sans font-semibold text-[#14130F] hover:text-[#C84E29] transition-colors group"
                  >
                    <span>See the problem</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2] group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>
              </div>

              {/* Right Column: Large Colosseum Monument Artwork Sticking Flush to Right Edge */}
              <div
                className={`lg:col-span-7 relative flex justify-end pr-0 mt-8 lg:mt-0 transition-all duration-700 ease-out ${
                  problemReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
                }`}
              >
                {/* Handwritten Note: CLEAR DATA. CALMER POSITIONS. MORE CONTROL. */}
                <div className="absolute -top-8 sm:-top-10 right-6 sm:right-14 z-20 flex flex-col items-end pointer-events-none select-none">
                  <span className="font-hand text-[#C84E29] text-xl sm:text-2xl font-bold tracking-wide -rotate-3 text-right leading-tight">
                    CLEAR DATA.<br />
                    CALMER POSITIONS.<br />
                    MORE CONTROL.
                  </span>
                </div>

                {/* Colosseum Monument Artwork Flush to Right Screen Border */}
                <div className="relative w-full max-w-[720px] xl:max-w-[800px] ml-auto mr-0 select-none">
                  <Image
                    src="/assets/colosseum-statue.png"
                    alt="Italian architectural monument with Colosseum, cypress, and classical marble pillar"
                    width={1024}
                    height={682}
                    className="w-full h-auto object-contain filter drop-shadow-sm transition-transform duration-700 ease-out hover:scale-[1.01]"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ========================================================= */}
        {/* SECTION 3: HOW IT WORKS (POINTING ARM FROM RIGHT EDGE)     */}
        {/* ========================================================= */}
        <section
          id="how-it-works"
          ref={stepsReveal.ref}
          className="relative py-18 sm:py-24 md:py-32 overflow-hidden"
        >
          <div className="w-full max-w-[1600px] mx-auto pl-6 sm:pl-10 lg:pl-16 xl:pl-20 pr-0">
            
            {/* Top Row: Heading on Left, Large Pointing Arm Emerging From Far Right Edge */}
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-16 sm:mb-20">
              <div>
                <span className="text-xs font-mono uppercase tracking-[0.18em] text-[#78736B] font-semibold block mb-2.5">
                  HOW IT WORKS
                </span>
                <h2 className="text-4xl sm:text-5xl lg:text-[62px] font-serif font-normal text-[#14130F] leading-tight">
                  Three{' '}
                  <span className="italic font-serif text-[#C84E29]">
                    simple
                  </span>{' '}
                  steps.
                </h2>
              </div>

              {/* Pointing Arm Artwork - Extends straight out of the right screen edge */}
              <div
                className={`relative flex items-center gap-4 self-end lg:self-auto mr-0 transition-all duration-1000 ease-out ${
                  stepsReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-20'
                }`}
              >
                {/* Handwritten Tag: FROM DATA TO DECISIONS. */}
                <div className="flex flex-col items-center select-none pointer-events-none">
                  <span className="font-hand text-[#C84E29] text-2xl sm:text-3xl font-bold tracking-wide -rotate-6 whitespace-nowrap leading-tight text-center">
                    FROM DATA<br />TO DECISIONS.
                  </span>
                  <svg width="50" height="32" viewBox="0 0 54 36" fill="none" className="text-[#C84E29] mt-0.5">
                    <path d="M44 4C30 8 16 16 6 30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M15 28L6 30L8 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                {/* Pointing Arm Sculpture Image Reaching in from right edge */}
                <div className="w-[380px] sm:w-[480px] lg:w-[580px] xl:w-[680px] shrink-0 select-none">
                  <Image
                    src="/assets/pointing-arm.png"
                    alt="Classical marble sculpture arm pointing towards steps"
                    width={1024}
                    height={356}
                    className="w-full h-auto object-contain filter drop-shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* 3 Step Columns Spanning Full Width with Right Padding */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 pt-4 pr-6 sm:pr-10 lg:pr-16 xl:pr-20">
              
              {/* Step 01 */}
              <div className="space-y-3.5 md:pr-10 lg:pr-14">
                <span className="text-3xl sm:text-4xl font-mono font-bold text-[#14130F] block">01</span>
                <div className="flex items-center gap-2.5 text-[#C84E29] pt-1">
                  <Link2 className="w-5 h-5 stroke-[2.2]" />
                  <h3 className="text-xl font-serif font-bold text-[#14130F]">
                    Connect &amp; view
                  </h3>
                </div>
                <p className="text-sm sm:text-base font-sans text-[#78736B] leading-relaxed">
                  See your position and current risk in real time.
                </p>
              </div>

              {/* Step 02 */}
              <div className="space-y-3.5 md:px-10 lg:px-14 md:border-l md:border-[#DFD9CC]">
                <span className="text-3xl sm:text-4xl font-mono font-bold text-[#14130F] block">02</span>
                <div className="flex items-center gap-2.5 text-[#C84E29] pt-1">
                  <BarChart3 className="w-5 h-5 stroke-[2.2]" />
                  <h3 className="text-xl font-serif font-bold text-[#14130F]">
                    Stress-test
                  </h3>
                </div>
                <p className="text-sm sm:text-base font-sans text-[#78736B] leading-relaxed">
                  Model different market scenarios and discover thresholds.
                </p>
              </div>

              {/* Step 03 */}
              <div className="space-y-3.5 md:pl-10 lg:pl-14 md:border-l md:border-[#DFD9CC]">
                <span className="text-3xl sm:text-4xl font-mono font-bold text-[#14130F] block">03</span>
                <div className="flex items-center gap-2.5 text-[#C84E29] pt-1">
                  <Zap className="w-5 h-5 stroke-[2.2]" />
                  <h3 className="text-xl font-serif font-bold text-[#14130F]">
                    Take action
                  </h3>
                </div>
                <p className="text-sm sm:text-base font-sans text-[#78736B] leading-relaxed">
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
          className="relative py-20 sm:py-24 md:py-32 bg-[#C04A26] text-white overflow-hidden"
        >
          {/* Background Colosseum Collage Overlay */}
          <div className="absolute inset-0 z-0 opacity-40 mix-blend-multiply pointer-events-none select-none">
            <Image
              src="/assets/terracotta-colosseum.jpg"
              alt="Terracotta collage with Colosseum arches and warm textures"
              fill
              className="object-cover object-left"
            />
          </div>

          <div className="relative z-10 w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              
              {/* Left Column: Heading, Narrative, and Colosseum visual */}
              <div
                className={`lg:col-span-5 space-y-6 transition-all duration-700 ease-out ${
                  simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
              >
                <span className="text-xs font-mono uppercase tracking-[0.18em] text-[#F7EDE6] font-semibold block">
                  INTERACTIVE SIMULATOR
                </span>

                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-serif font-normal leading-[1.08] tracking-tight text-white">
                  Model<br />the unexpected.
                </h2>

                <p className="text-base sm:text-lg font-sans text-[#F7EDE6] leading-relaxed max-w-md">
                  Adjust variables, simulate market moves, and see how they impact your position in real time with zero risk.
                </p>

                <div className="pt-2">
                  <Link href="/app/stress-test">
                    <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#14130F] text-white font-sans font-medium text-sm hover:bg-white hover:text-[#C04A26] transition-all duration-200 shadow-md">
                      <span>Try the simulator</span>
                      <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Right Column: Wide Interactive Position Simulator Card */}
              <div
                className={`lg:col-span-7 flex justify-end transition-all duration-700 ease-out ${
                  simulatorReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
                }`}
              >
                <div className="bg-white text-[#14130F] rounded-2xl p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.25)] w-full max-w-[720px] xl:max-w-[780px]">
                  
                  {/* Card Header & Timeframe Tabs */}
                  <div className="flex flex-row items-center justify-between gap-3 pb-6 border-b border-[#F0EBE0]">
                    <h3 className="font-serif font-bold text-xl sm:text-2xl text-[#14130F]">
                      Position Simulator
                    </h3>

                    {/* Timeframe selector pill */}
                    <div className="flex items-center rounded-full bg-[#F4F1EA] p-1 text-xs font-mono">
                      {(['1D', '1W', '1M', '1Y'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeframe(t)}
                          className={`px-3 py-1 rounded-full text-xs transition-all duration-150 ${
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

                  {/* Top 3 Live Calculated Metric Tiles */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-4 py-6 border-b border-[#F0EBE0]">
                    <div className="bg-[#FAF8F5] border border-[#EAE5DA] rounded-xl p-3 sm:p-4">
                      <span className="text-[11px] font-mono uppercase text-[#8C877D] block">
                        Collateral ratio
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
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

                    <div className="bg-[#FAF8F5] border border-[#EAE5DA] rounded-xl p-3 sm:p-4">
                      <span className="text-[11px] font-mono uppercase text-[#8C877D] block">
                        MUSD debt
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[#14130F] mt-1 tracking-tight">
                        ${debt.toLocaleString()}
                      </div>
                    </div>

                    <div className="bg-[#FAF8F5] border border-[#EAE5DA] rounded-xl p-3 sm:p-4">
                      <span className="text-[11px] font-mono uppercase text-[#8C877D] block">
                        Collateral value
                      </span>
                      <div className="text-2xl sm:text-3xl font-mono font-bold text-[#14130F] mt-1 tracking-tight">
                        ${collateralValue.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Interactive SVG Chart with Vertical Dashed Indicator Line */}
                  <div className="py-6">
                    <div className="relative h-44 sm:h-48 w-full">
                      <svg
                        viewBox="0 0 600 180"
                        className="w-full h-full overflow-visible"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient id="simAreaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#C84E29" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#C84E29" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Reference lines */}
                        <line x1="0" y1="135" x2="600" y2="135" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="131" fill="#999" fontSize="10" fontFamily="monospace">100%</text>

                        <line x1="0" y1="92" x2="600" y2="92" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="88" fill="#999" fontSize="10" fontFamily="monospace">150%</text>

                        <line x1="0" y1="50" x2="600" y2="50" stroke="#F0EBE0" strokeDasharray="3 3" />
                        <text x="5" y="46" fill="#999" fontSize="10" fontFamily="monospace">200%</text>

                        {/* Vertical Indicator Line to Active Point */}
                        {chartSvgPath.points[activeChartPoint] && (
                          <line
                            x1={chartSvgPath.points[activeChartPoint].x}
                            y1={chartSvgPath.points[activeChartPoint].y}
                            x2={chartSvgPath.points[activeChartPoint].x}
                            y2="170"
                            stroke="#14130F"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                            opacity="0.6"
                          />
                        )}

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
                              r={activeChartPoint === i ? 5.5 : 4}
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
                          className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full -top-1 px-3 py-1.5 bg-[#14130F] text-white rounded-md text-xs font-mono shadow-md text-center"
                          style={{
                            left: `${(activeChartPoint / (chartPoints.length - 1)) * 100}%`,
                          }}
                        >
                          <div className="font-bold text-[#E0633C]">
                            {chartPoints[activeChartPoint].value.toFixed(1)}%
                          </div>
                          <div className="text-[10px] text-gray-300">
                            {chartPoints[activeChartPoint].date}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Timeline Month Labels */}
                    <div className="flex justify-between text-xs font-mono text-[#8C877D] pt-3 border-t border-[#F0EBE0]">
                      {chartPoints.map((pt, i) => (
                        <span key={i}>{pt.label}</span>
                      ))}
                    </div>
                  </div>

                  {/* 3 Interactive Sliders Inside Subtle Bordered Tiles */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-4 border-t border-[#F0EBE0]">
                    
                    {/* Slider 1: MUSD Price */}
                    <div className="bg-[#FAF8F5] border border-[#EAE5DA] rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#8C877D]">MUSD Price</span>
                        <span className="font-bold text-[#14130F]">${musdPrice.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.50"
                        max="2.00"
                        step="0.01"
                        value={musdPrice}
                        onChange={(e) => setMusdPrice(parseFloat(e.target.value))}
                        className="w-full accent-[#C84E29] cursor-pointer h-1.5 bg-[#E5DFD3] rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#8C877D]">
                        <span>$0.50</span>
                        <span>$2.00</span>
                      </div>
                    </div>

                    {/* Slider 2: Collateral Value */}
                    <div className="bg-[#FAF8F5] border border-[#EAE5DA] rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#8C877D]">Collateral Value</span>
                        <span className="font-bold text-[#14130F]">${collateralValue.toLocaleString()}</span>
                      </div>
                      <input
                        type="range"
                        min="1000"
                        max="50000"
                        step="500"
                        value={collateralValue}
                        onChange={(e) => setCollateralValue(parseInt(e.target.value, 10))}
                        className="w-full accent-[#C84E29] cursor-pointer h-1.5 bg-[#E5DFD3] rounded-lg"
                      />
                      <div className="flex justify-between text-[10px] font-mono text-[#8C877D]">
                        <span>$1k</span>
                        <span>$50k</span>
                      </div>
                    </div>

                    {/* Slider 3: Volatility */}
                    <div className="bg-[#FAF8F5] border border-[#EAE5DA] rounded-xl p-3 sm:p-3.5 space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
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
                      <div className="flex justify-between text-[10px] font-mono text-[#8C877D]">
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
        {/* SECTION 5: OUR BELIEF (STICKING TO BOTH LEFT & RIGHT EDGES)*/}
        {/* ========================================================= */}
        <section
          id="belief"
          ref={beliefReveal.ref}
          className="relative py-20 sm:py-24 md:py-32 overflow-hidden"
        >
          <div className="w-full flex flex-col lg:flex-row items-center justify-between">
            
            {/* Left Part: David Statue with Orange Bleeding Straight to Left Screen Edge */}
            <div
              className={`w-full lg:w-[480px] xl:w-[540px] shrink-0 relative flex justify-start pl-0 transition-all duration-700 ease-out ${
                beliefReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
              }`}
            >
              {/* Handwritten Tag: YOUR POSITION. YOUR RULES. */}
              <div className="absolute -top-10 left-6 sm:left-12 z-20 flex flex-col items-start select-none pointer-events-none">
                <span className="font-hand text-[#C84E29] text-2xl sm:text-3xl font-bold tracking-wide -rotate-3 whitespace-nowrap leading-tight">
                  YOUR POSITION.<br />YOUR RULES.
                </span>
                <svg width="44" height="34" viewBox="0 0 48 38" fill="none" className="text-[#C84E29] mt-0.5 ml-3">
                  <path d="M6 6C16 12 28 18 38 30" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M28 28L38 30L36 20" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              {/* David Statue Cutout with Orange Bleeding Left */}
              <div className="relative w-full max-w-[460px] xl:max-w-[520px] select-none">
                <Image
                  src="/assets/belief-david-cutout.png"
                  alt="David classical sculpture with orange and laurel wreath"
                  width={1024}
                  height={682}
                  className="w-full h-auto object-contain filter drop-shadow-sm transition-transform duration-700 ease-out hover:scale-[1.01]"
                />
              </div>
            </div>

            {/* Middle Part: Our Belief Narrative & CTA Buttons */}
            <div
              className={`max-w-xl px-6 sm:px-10 lg:px-6 my-10 lg:my-0 space-y-6 transition-all duration-700 ease-out ${
                beliefReveal.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
              }`}
            >
              <span className="text-xs font-mono uppercase tracking-[0.18em] text-[#78736B] font-semibold block">
                OUR BELIEF
              </span>

              <h2 className="text-4xl sm:text-5xl lg:text-[60px] font-serif font-normal text-[#14130F] leading-[1.06] tracking-tight">
                Better tools<br />
                for a more stable<br />
                ecosystem.
              </h2>

              <p className="text-base sm:text-lg font-sans text-[#5A554E] leading-relaxed max-w-lg">
                A more informed community leads to fewer liquidations, healthier positions, and a
                more resilient MUSD ecosystem.
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link href="/app/overview">
                  <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-[#14130F] text-white font-sans font-medium text-sm hover:bg-[#C84E29] transition-all duration-200 shadow-sm">
                    <span>Explore Ballast</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.2]" />
                  </button>
                </Link>
                <Link href="/whitepaper">
                  <button className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full border border-[#C8C2B4] bg-transparent text-[#14130F] font-sans font-medium text-sm hover:border-[#14130F] hover:text-[#C84E29] transition-all duration-200">
                    <span>Read the docs</span>
                  </button>
                </Link>
              </div>
            </div>

            {/* Right Part: Italian Building Facade Bleeding Straight to Right Edge */}
            <div
              className={`w-full lg:w-[380px] xl:w-[440px] shrink-0 relative flex justify-end pr-0 transition-all duration-700 ease-out ${
                beliefReveal.isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
              }`}
            >
              <div className="relative w-full max-w-[360px] xl:max-w-[420px] select-none">
                <Image
                  src="/assets/belief-facade.jpg"
                  alt="Italian building facade with street lamp and blue torn paper"
                  width={1024}
                  height={576}
                  className="w-full h-auto object-cover rounded-sm filter drop-shadow-sm"
                />

                {/* Rotated Stamp Badge */}
                <div className="absolute -bottom-6 left-2 sm:left-4 z-10">
                  <div className="inline-block px-4 py-2 border border-dashed border-[#C84E29] bg-[#F5F1E8]/95 backdrop-blur-sm rounded-sm font-hand text-sm sm:text-base font-bold text-[#C84E29] -rotate-3 select-none shadow-sm leading-tight text-center">
                    BUILT FOR<br />A MORE STABLE<br />MUSD ECOSYSTEM
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
        <div className="w-full max-w-[1600px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20 py-16 sm:py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12 items-start pb-14 border-b border-[#DFD9CC]">
            
            {/* Identity & Mission */}
            <div className="md:col-span-4 space-y-4">
              <Link href="/" className="flex items-center gap-2 group">
                <span className="text-[#14130F] group-hover:text-[#C84E29] transition-colors">
                  <Anchor className="w-5 h-5 stroke-[2.4]" />
                </span>
                <span className="font-serif font-black text-xl text-[#14130F] tracking-wider uppercase">
                  {BRAND_NAME}
                </span>
              </Link>

              <p className="text-xs sm:text-sm font-sans text-[#78736B] leading-relaxed max-w-sm">
                Risk tools for a more stable MUSD ecosystem.
              </p>

              {/* Social Icons */}
              <div className="flex items-center gap-3 pt-1 text-[#5A554E]">
                <a
                  href="https://twitter.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#D5CFC2] flex items-center justify-center hover:text-[#C84E29] hover:border-[#C84E29] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">X</span>
                </a>
                <a
                  href="https://discord.com"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#D5CFC2] flex items-center justify-center hover:text-[#C84E29] hover:border-[#C84E29] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">⚑</span>
                </a>
                <a
                  href="https://github.com/SIDDHUX9/BALLAST"
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-full border border-[#D5CFC2] flex items-center justify-center hover:text-[#C84E29] hover:border-[#C84E29] transition-colors"
                >
                  <span className="font-mono text-xs font-bold">&lt;/&gt;</span>
                </a>
              </div>
            </div>

            {/* Protocol Column */}
            <div className="md:col-span-2 space-y-2.5 md:border-l md:border-[#DFD9CC] md:pl-8">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#14130F] block mb-1">
                Protocol
              </span>
              <ul className="space-y-2 text-xs sm:text-sm font-sans text-[#78736B]">
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
            <div className="md:col-span-2 space-y-2.5">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-[#14130F] block mb-1">
                Community
              </span>
              <ul className="space-y-2 text-xs sm:text-sm font-sans text-[#78736B]">
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
            <div className="md:col-span-4 space-y-3">
              <div className="flex items-center rounded-lg bg-white border border-[#D5CFC2] p-1.5 pl-3.5 shadow-inner">
                <input
                  type="email"
                  placeholder="Get updates"
                  className="bg-transparent text-xs sm:text-sm font-sans text-[#14130F] placeholder-[#8C877D] focus:outline-none w-full"
                />
                <button
                  type="button"
                  className="w-7 h-7 rounded-md bg-[#14130F] text-white flex items-center justify-center shrink-0 hover:bg-[#C84E29] transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.2]" />
                </button>
              </div>
              <p className="text-xs font-sans text-[#78736B]">
                No noise. Just important updates.
              </p>
            </div>

          </div>

          {/* Bottom Bar: Copyright & Architectural Florence Duomo Sketch */}
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <span className="text-xs sm:text-sm font-mono text-[#8C877D]">
              &copy; 2026 Ballast. All rights reserved.
            </span>

            {/* Handwritten Florence Cathedral Sketch Note */}
            <div className="flex items-center gap-4 select-none">
              <span className="font-hand text-[#78736B] text-xl sm:text-2xl font-bold tracking-wide -rotate-2 leading-tight text-right">
                STAY AHEAD.<br />STAY IN CONTROL.
              </span>
              
              {/* Detailed Florence Duomo (Santa Maria del Fiore) Sketch SVG */}
              <svg width="120" height="60" viewBox="0 0 120 60" fill="none" className="text-[#8C877D] opacity-80 shrink-0">
                {/* Ground base line */}
                <path d="M4 56H116" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                {/* Nave / Basilica body */}
                <path d="M12 56V38H34V56" stroke="currentColor" strokeWidth="1" />
                <path d="M12 38L23 28L34 38" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                {/* Giotto's Campanile (Bell Tower) */}
                <path d="M38 56V14H50V56" stroke="currentColor" strokeWidth="1" />
                <path d="M44 8L50 14H38L44 8Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                <line x1="38" y1="24" x2="50" y2="24" stroke="currentColor" strokeWidth="0.8" />
                <line x1="38" y1="36" x2="50" y2="36" stroke="currentColor" strokeWidth="0.8" />
                <line x1="38" y1="46" x2="50" y2="46" stroke="currentColor" strokeWidth="0.8" />
                {/* Grand Brunelleschi Dome Drum & Ribbed Cupola */}
                <path d="M54 56V34H96V56" stroke="currentColor" strokeWidth="1" />
                <path d="M54 34C54 18 68 8 75 4C82 8 96 18 96 34" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                {/* Center Lantern */}
                <path d="M73 4V0H77V4" stroke="currentColor" strokeWidth="1" />
                <path d="M75 0V-2" stroke="currentColor" strokeWidth="1" />
                {/* Rib lines */}
                <path d="M75 4V34" stroke="currentColor" strokeWidth="0.8" strokeDasharray="1 1" />
                <path d="M64 16C68 22 70 28 71 34" stroke="currentColor" strokeWidth="0.8" />
                <path d="M86 16C82 22 80 28 79 34" stroke="currentColor" strokeWidth="0.8" />
                {/* Apse / East End */}
                <path d="M96 56V42H110V56" stroke="currentColor" strokeWidth="1" />
                <path d="M96 42C96 36 103 32 110 42" stroke="currentColor" strokeWidth="1" />
              </svg>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
