'use client';

import React, { useId } from 'react';

export interface HealthGaugeProps {
  current?: number | null;
  trigger?: number | null;
  target?: number | null;
  mcr?: number;
  ccr?: number;
  loading?: boolean;
  className?: string;
}

export function HealthGauge({
  current = null,
  trigger = null,
  target = null,
  mcr = 110,
  ccr = 150,
  loading = false,
  className = '',
}: HealthGaugeProps) {
  const labelId = useId();

  // Helper to map ratio [100, 300] to percentage [0, 100]
  const toPercent = (val: number) => {
    const clamped = Math.max(100, Math.min(300, val));
    return ((clamped - 100) / 200) * 100;
  };

  const mcrPos = toPercent(mcr);
  const ccrPos = toPercent(ccr);
  const currentPos = current !== null && current !== undefined ? toPercent(current) : null;
  const triggerPos = trigger !== null && trigger !== undefined ? toPercent(trigger) : null;
  const targetPos = target !== null && target !== undefined ? toPercent(target) : null;

  const getStatusText = () => {
    if (loading) return 'Calculating collateral health...';
    if (current === null || current === undefined) return 'No active position to measure';
    if (current < mcr) return `Critical: ${current.toFixed(1)}% (below ${mcr}% liquidation MCR)`;
    if (current < ccr) return `Caution: ${current.toFixed(1)}% (in recovery/watch band)`;
    return `Safe: ${current.toFixed(1)}% (above ${ccr}% target threshold)`;
  };

  if (loading) {
    return (
      <div
        className={`p-4 border border-hairline bg-paper-raised rounded ${className}`}
        aria-busy="true"
      >
        <div className="flex justify-between items-center mb-3">
          <div className="h-4 w-32 bg-hairline/40 animate-pulse rounded-sm" />
          <div className="h-4 w-20 bg-hairline/40 animate-pulse rounded-sm" />
        </div>
        <div className="h-10 w-full bg-hairline/30 animate-pulse rounded-sm" />
        <div className="flex justify-between mt-2">
          <div className="h-3 w-12 bg-hairline/30 animate-pulse rounded-sm" />
          <div className="h-3 w-12 bg-hairline/30 animate-pulse rounded-sm" />
          <div className="h-3 w-12 bg-hairline/30 animate-pulse rounded-sm" />
        </div>
      </div>
    );
  }

  const ticks = [100, 110, 125, 150, 175, 200, 225, 250, 275, 300];

  return (
    <div
      className={`border border-hairline bg-paper-raised p-5 rounded ${className}`}
      role="meter"
      aria-labelledby={labelId}
      aria-valuenow={current ?? undefined}
      aria-valuemin={100}
      aria-valuemax={300}
      aria-valuetext={getStatusText()}
    >
      {/* Header and status readout */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <span id={labelId} className="text-xs tracking-wider uppercase text-ink-muted font-mono">
            Collateral Ratio Waterline
          </span>
          <div className="text-sm font-sans font-medium text-ink mt-0.5">
            {current !== null && current !== undefined ? (
              <span className="tabular-nums font-mono font-semibold text-lg mr-2">
                {current.toFixed(1)}%
              </span>
            ) : (
              <span className="text-ink-muted italic mr-2">Uncalculated</span>
            )}
            <span
              className={`inline-block px-1.5 py-0.5 text-xs font-mono rounded-sm border ${
                current === null
                  ? 'border-hairline text-ink-muted'
                  : current < mcr
                    ? 'border-danger/30 text-danger bg-danger/10'
                    : current < ccr
                      ? 'border-watch/30 text-watch bg-watch/10'
                      : 'border-safe/30 text-safe bg-safe/10'
              }`}
            >
              {current === null
                ? 'STANDBY'
                : current < mcr
                  ? 'LIQUIDATION RISK'
                  : current < ccr
                    ? 'WATCH BAND'
                    : 'SOUND WATERLINE'}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono text-ink-muted">
          {trigger !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-ember rounded-sm inline-block" />
              <span>Trigger {trigger}%</span>
            </div>
          )}
          {target !== null && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-safe rounded-sm inline-block" />
              <span>Target {target}%</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-danger rounded-sm inline-block" />
            <span>MCR {mcr}%</span>
          </div>
        </div>
      </div>

      {/* SVG Instrument Gauge */}
      <div className="relative select-none py-2">
        <svg
          viewBox="0 0 1000 120"
          className="w-full h-auto overflow-visible"
          role="img"
          aria-label="Waterline ratio scale"
        >
          <defs>
            <pattern id="ruler-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="10"
                stroke="var(--border-hairline)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>

          {/* Background Track Zones */}
          {/* Danger Zone: 100% to MCR (110%) */}
          <rect
            x="40"
            y="45"
            width={(mcrPos / 100) * 920}
            height="18"
            fill="var(--color-danger-bg)"
            stroke="var(--color-danger)"
            strokeWidth="1"
            rx="2"
          />

          {/* Caution Zone: MCR (110%) to CCR (150%) */}
          <rect
            x={40 + (mcrPos / 100) * 920}
            y="45"
            width={((ccrPos - mcrPos) / 100) * 920}
            height="18"
            fill="var(--color-watch-bg)"
            stroke="var(--color-watch)"
            strokeWidth="1"
            rx="2"
          />

          {/* Safe Zone: CCR (150%) to 300% */}
          <rect
            x={40 + (ccrPos / 100) * 920}
            y="45"
            width={((100 - ccrPos) / 100) * 920}
            height="18"
            fill="var(--color-safe-bg)"
            stroke="var(--color-safe)"
            strokeWidth="1"
            rx="2"
          />

          {/* Baseline hairline waterline */}
          <line
            x1="40"
            y1="54"
            x2="960"
            y2="54"
            stroke="var(--border-strong)"
            strokeWidth="1"
            strokeDasharray="2 2"
          />

          {/* Tick Marks & Labels */}
          {ticks.map((tick) => {
            const pos = 40 + (toPercent(tick) / 100) * 920;
            const isMajor =
              tick === 100 || tick === mcr || tick === ccr || tick === 200 || tick === 300;
            return (
              <g key={tick}>
                <line
                  x1={pos}
                  y1={isMajor ? 38 : 42}
                  x2={pos}
                  y2={isMajor ? 70 : 66}
                  stroke={
                    tick === mcr
                      ? 'var(--color-danger)'
                      : tick === ccr
                        ? 'var(--color-watch)'
                        : 'var(--border-strong)'
                  }
                  strokeWidth={isMajor ? '1.5' : '1'}
                />
                <text
                  x={pos}
                  y="85"
                  textAnchor="middle"
                  className="font-mono text-[11px] fill-ink-muted"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {tick}%
                </text>
              </g>
            );
          })}

          {/* MCR annotation */}
          <text
            x={40 + (mcrPos / 100) * 920}
            y="26"
            textAnchor="middle"
            className="font-mono text-[10px] font-semibold fill-danger uppercase"
          >
            MCR (110%)
          </text>

          {/* CCR annotation */}
          <text
            x={40 + (ccrPos / 100) * 920}
            y="26"
            textAnchor="middle"
            className="font-mono text-[10px] font-semibold fill-watch uppercase"
          >
            CCR (150%)
          </text>

          {/* Trigger Marker (Points UP from below) */}
          {triggerPos !== null && (
            <g
              transform={`translate(${40 + (triggerPos / 100) * 920}, 76)`}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`Trigger threshold at ${trigger}%`}
              className="focus:outline-none transition-transform duration-200"
            >
              <polygon
                points="0,0 -6,10 6,10"
                fill="var(--color-ember)"
                stroke="var(--bg-paper)"
                strokeWidth="1"
              />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="-31"
                stroke="var(--color-ember)"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <text
                x="0"
                y="24"
                textAnchor="middle"
                className="font-mono text-[10px] fill-ember font-bold"
              >
                DEFEND
              </text>
            </g>
          )}

          {/* Target Marker (Points DOWN from above) */}
          {targetPos !== null && (
            <g
              transform={`translate(${40 + (targetPos / 100) * 920}, 32)`}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`Target restoration threshold at ${target}%`}
              className="focus:outline-none transition-transform duration-200"
            >
              <polygon
                points="0,0 -6,-10 6,-10"
                fill="var(--color-safe)"
                stroke="var(--bg-paper)"
                strokeWidth="1"
              />
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="31"
                stroke="var(--color-safe)"
                strokeWidth="1.5"
                strokeDasharray="3 2"
              />
              <text
                x="0"
                y="-14"
                textAnchor="middle"
                className="font-mono text-[10px] fill-safe font-bold"
              >
                TARGET
              </text>
            </g>
          )}

          {/* Current Needle Marker (Diamond / Compass needle) */}
          {currentPos !== null && (
            <g
              transform={`translate(${40 + (currentPos / 100) * 920}, 54)`}
              tabIndex={0}
              role="graphics-symbol"
              aria-label={`Current ratio at ${current?.toFixed(1)}%`}
              className="focus:outline-none transition-transform duration-200"
            >
              {/* Outer halo */}
              <circle r="9" fill="var(--bg-surface)" stroke="var(--text-ink)" strokeWidth="2" />
              {/* Center point */}
              <circle r="3.5" fill="var(--text-ink)" />
              {/* Vertical needle bar */}
              <line x1="0" y1="-26" x2="0" y2="26" stroke="var(--text-ink)" strokeWidth="1.5" />
              {/* Value indicator on top */}
              <rect x="-24" y="-45" width="48" height="16" rx="2" fill="var(--text-ink)" />
              <text
                x="0"
                y="-33"
                textAnchor="middle"
                className="font-mono text-[10px] font-bold fill-paper-raised"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {current?.toFixed(0)}%
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Waterline description */}
      <div className="mt-3 pt-3 border-t border-hairline flex flex-wrap justify-between items-center text-xs font-mono text-ink-muted">
        <span>MIN RATIO: 100%</span>
        <span>
          {current !== null
            ? `BUFFER ABOVE MCR: +${Math.max(0, current - mcr).toFixed(1)}%`
            : 'AWAITING CALCULATOR INPUT'}
        </span>
        <span>MAX SCALE: 300%</span>
      </div>
    </div>
  );
}
