'use client';

import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled = false,
      icon,
      className = '',
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-sans font-medium transition-all duration-180 rounded-sm select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:opacity-50 disabled:pointer-events-none active:translate-y-px';

    const sizeStyles = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5 min-h-[30px]',
      md: 'text-sm px-4 py-2 gap-2 min-h-[38px]',
      lg: 'text-base px-5 py-2.5 gap-2.5 min-h-[46px]',
    };

    const variantStyles = {
      primary: 'bg-ink text-paper-raised hover:bg-ink-soft border border-ink',
      secondary:
        'bg-paper-raised text-ink border border-hairline hover:border-hairline-strong hover:bg-paper',
      quiet:
        'bg-transparent text-ink-soft hover:text-ink hover:bg-hairline/20 border border-transparent',
      danger: 'bg-danger text-paper-raised hover:opacity-90 border border-danger',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon
        )}
        <span>{children}</span>
      </button>
    );
  },
);

Button.displayName = 'Button';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  'aria-label': string;
  icon: React.ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      'aria-label': ariaLabel,
      icon,
      className = '',
      disabled = false,
      type = 'button',
      ...props
    },
    ref,
  ) => {
    const sizeStyles = {
      sm: 'w-7 h-7 text-xs p-1',
      md: 'w-9 h-9 text-sm p-1.5',
      lg: 'w-11 h-11 text-base p-2',
    };

    const variantStyles = {
      primary: 'bg-ink text-paper-raised hover:bg-ink-soft border border-ink',
      secondary:
        'bg-paper-raised text-ink border border-hairline hover:border-hairline-strong hover:bg-paper',
      quiet:
        'bg-transparent text-ink-soft hover:text-ink hover:bg-hairline/20 border border-transparent',
      danger: 'bg-danger text-paper-raised hover:opacity-90 border border-danger',
    };

    return (
      <button
        ref={ref}
        type={type}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-sm transition-all duration-180 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember disabled:opacity-50 disabled:pointer-events-none active:translate-y-px ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {icon}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';
