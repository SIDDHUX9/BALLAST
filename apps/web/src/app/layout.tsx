import type { Metadata } from 'next';
import { Fraunces, Instrument_Sans, JetBrains_Mono, Caveat } from 'next/font/google';
import './globals.css';
import { BRAND_DESCRIPTION, BRAND_URLS } from '@ballast/shared';
import { ThemeProvider } from '../components/theme-provider';
import { NotificationsProvider } from '../components/notifications/notifications-provider';
import { BallastConvexProvider } from '../components/convex-provider';
import { WalletProvider } from '../components/wallet/wallet-provider';
import { NetworkBanner } from '../components/wallet/network-banner';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  axes: ['opsz'],
});

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-handwritten',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_URLS.appUrl),
  title: 'Ballast | Liquidation protection for MUSD on Mezo',
  description: BRAND_DESCRIPTION,
  openGraph: {
    title: 'Ballast | Liquidation protection for MUSD on Mezo',
    description: BRAND_DESCRIPTION,
    type: 'website',
    images: [
      {
        url: '/assets/landing/hero-david.webp',
        width: 1200,
        height: 630,
        alt: 'Ballast Liquidation Protection for MUSD on Mezo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ballast | Liquidation protection for MUSD on Mezo',
    description: BRAND_DESCRIPTION,
    images: ['/assets/landing/hero-david.webp'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${instrumentSans.variable} ${jetbrainsMono.variable} ${caveat.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('ballast-theme');
                  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen bg-paper text-ink font-sans selection:bg-ember selection:text-paper-raised">
        <ThemeProvider>
          <NotificationsProvider>
            <BallastConvexProvider>
              <WalletProvider>
                <NetworkBanner />
                {children}
              </WalletProvider>
            </BallastConvexProvider>
          </NotificationsProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
