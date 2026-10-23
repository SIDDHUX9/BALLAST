'use client';

import React from 'react';

export interface Step {
  title: string;
  description?: string;
}

export interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function Stepper({ steps, currentStep, onStepClick, className = '' }: StepperProps) {
  return (
    <div className={`w-full flex flex-col md:flex-row gap-4 items-start ${className}`}>
      {steps.map((step, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isCurrent = stepNum === currentStep;

        return (
          <div
            key={stepNum}
            onClick={() => onStepClick?.(stepNum)}
            className={`flex-1 flex items-start gap-3 w-full transition-opacity ${
              onStepClick ? 'cursor-pointer hover:opacity-80' : ''
            }`}
          >
            <div
              className={`w-7 h-7 rounded-sm flex items-center justify-center font-mono text-xs font-semibold shrink-0 border transition-colors ${
                isCompleted
                  ? 'bg-safe text-paper-raised border-safe'
                  : isCurrent
                    ? 'bg-ink text-paper-raised border-ink ring-2 ring-ember/40'
                    : 'bg-paper-surface text-ink-muted border-hairline'
              }`}
            >
              {isCompleted ? '✓' : stepNum}
            </div>

            <div className="flex flex-col">
              <span
                className={`text-xs font-mono tracking-wider uppercase font-semibold ${
                  isCurrent ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {step.title}
              </span>
              {step.description && (
                <span className="text-xs font-sans text-ink-muted mt-0.5">{step.description}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
