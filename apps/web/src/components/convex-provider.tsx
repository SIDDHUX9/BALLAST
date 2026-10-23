'use client';

import React, { useMemo } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL || 'https://hearty-pigeon-436.convex.cloud';

export function BallastConvexProvider({ children }: { children: React.ReactNode }) {
  const client = useMemo(() => new ConvexReactClient(convexUrl), []);

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
