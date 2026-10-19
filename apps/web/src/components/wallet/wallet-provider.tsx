'use client';

import React, { useState } from 'react';
import { WagmiProvider, State } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from '../../lib/wagmi';
import { mezoTestnet } from '../../lib/chains';
import { getBallastRainbowTheme } from '../../lib/theme-rainbow';
import { useTheme } from '../theme-provider';

export interface WalletProviderProps {
  children: React.ReactNode;
  initialState?: State;
}

export function WalletProvider({ children, initialState }: WalletProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 10_000,
          },
        },
      })
  );

  const { theme } = useTheme();
  const rainbowTheme = getBallastRainbowTheme(theme);

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={rainbowTheme}
          initialChain={mezoTestnet}
          modalSize="compact"
          appInfo={{
            appName: 'Ballast',
            learnMoreUrl: 'https://mezo.org/docs',
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
