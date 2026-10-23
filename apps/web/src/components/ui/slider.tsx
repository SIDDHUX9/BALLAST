'use client';

import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';

export type SliderValue = number | number[];

export interface SliderProps<T extends SliderValue = SliderValue> {
  label?: string;
  value: T;
  onValueChange: (val: T) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
}

export function Slider<T extends SliderValue = number[]>({
  label,
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  unit = '%',
  disabled = false,
  className = '',
}: SliderProps<T>) {
  const arrayValue: number[] = Array.isArray(value) ? (value as number[]) : [value as number];

  const handleChange = (vals: number[]) => {
    if (Array.isArray(value)) {
      (onValueChange as (v: number[]) => void)(vals as T & number[]);
    } else {
      (onValueChange as (v: number) => void)(vals[0]);
    }
  };

  return (
    <div className={`flex flex-col gap-2 w-full ${className}`}>
      {label && (
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="uppercase tracking-wider text-ink-muted">{label}</span>
          <span className="font-semibold text-ink tabular-nums">
            {arrayValue[0]}
            {unit}
          </span>
        </div>
      )}

      <SliderPrimitive.Root
        min={min}
        max={max}
        step={step}
        value={arrayValue}
        onValueChange={handleChange}
        disabled={disabled}
        className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
      >
        <SliderPrimitive.Track className="relative bg-hairline grow rounded-sm h-1.5 overflow-hidden">
          <SliderPrimitive.Range className="absolute bg-ember h-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className="block w-4 h-4 bg-paper-surface border border-ink shadow-sm rounded-sm hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember transition-transform active:scale-95"
          aria-label={label || 'Threshold Slider'}
        />
      </SliderPrimitive.Root>

      <div className="flex justify-between text-[11px] font-mono text-ink-muted/80">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}
