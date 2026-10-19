'use client';

import React from 'react';
import { Header } from '../../components/layout/header';
import { Footer } from '../../components/layout/footer';
import { TooltipProvider } from '../../components/ui/tooltip';

export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
        <Header />
        <main className="max-w-container mx-auto px-4 md:px-6 py-8 grow w-full">{children}</main>
        <Footer />
      </div>
    </TooltipProvider>
  );
}
