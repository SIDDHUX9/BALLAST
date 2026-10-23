import type { Metadata } from 'next';
import { Fraunces, Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { BRAND_NAME, BRAND_TAGLINE, BRAND_DESCRIPTION } from '@ballast/shared';
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

export const metadata: Metadata = {
  title: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
  description: BRAND_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fraunces.variable} ${instrumentSans.variable} ${jetbrainsMono.variable}`}
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
