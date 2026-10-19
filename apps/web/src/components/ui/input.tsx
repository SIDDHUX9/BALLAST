'use client';

import React, { forwardRef, useId } from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  unit?: string;
  maxAction?: () => void;
  maxLabel?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      unit,
      maxAction,
      maxLabel = 'MAX',
      error,
      helperText,
      id,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-mono uppercase tracking-wider text-ink-muted"
          >
            {label}
          </label>
        )}

        <div
          className={`relative flex items-center bg-paper-surface border rounded-sm transition-colors duration-180 ${
            error
              ? 'border-danger focus-within:border-danger'
              : 'border-hairline hover:border-hairline-strong focus-within:border-ink'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-paper' : ''}`}
        >
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={`w-full bg-transparent px-3 py-2 text-sm font-mono text-ink placeholder:text-ink-muted/60 focus:outline-none tabular-nums ${className}`}
            {...props}
          />

          <div className="flex items-center gap-1.5 pr-2.5 select-none">
            {maxAction && !disabled && (
              <button
                type="button"
                onClick={maxAction}
                className="px-1.5 py-0.5 text-[11px] font-mono font-medium tracking-wider text-ember hover:bg-ember/10 border border-ember/30 rounded-sm transition-colors"
              >
                {maxLabel}
              </button>
            )}

            {unit && (
              <span className="text-xs font-mono text-ink-muted uppercase border-l border-hairline pl-2">
                {unit}
              </span>
            )}
          </div>
        </div>

        {error && (
          <p id={errorId} className="text-xs font-mono text-danger mt-0.5">
            {error}
          </p>
        )}

        {!error && helperText && (
          <p id={helperId} className="text-xs font-mono text-ink-muted mt-0.5">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
