import type { Metadata } from 'next';
import './globals.css';
import { BRAND_NAME, BRAND_TAGLINE, BRAND_DESCRIPTION } from '@ballast/shared';

export const metadata: Metadata = {
  title: `${BRAND_NAME} | ${BRAND_TAGLINE}`,
  description: BRAND_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-mezo-accent selection:text-black">{children}</body>
    </html>
  );
}
