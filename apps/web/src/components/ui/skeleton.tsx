'use client';

import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rect' | 'circle';
}

export function Skeleton({ variant = 'rect', className = '', ...props }: SkeletonProps) {
  const variantStyles = {
    text: 'h-4 w-full rounded-sm',
    rect: 'h-10 w-full rounded-sm',
    circle: 'w-8 h-8 rounded-full',
  };

  return (
    <div
      className={`bg-hairline/30 animate-pulse ${variantStyles[variant]} ${className}`}
      aria-hidden="true"
      {...props}
    />
  );
}
