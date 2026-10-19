import { BRAND_NAME, BRAND_TAGLINE, BRAND_DESCRIPTION, BRAND_URLS } from '@ballast/shared';
import { Shield, ExternalLink, Activity, Vault } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-between p-6 md:p-12 max-w-6xl mx-auto">
      {/* Top Header */}
      <header className="w-full flex items-center justify-between pb-8 border-b border-mezo-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Shield className="w-6 h-6 text-black" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-white">{BRAND_NAME}</span>
            <span className="block text-xs text-neutral-400 font-mono">Mezo Network</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={BRAND_URLS.mezoExplorer}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            Testnet Explorer <ExternalLink className="w-3 h-3" />
          </a>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm transition-all shadow-md shadow-orange-500/20"
          >
            Connect Wallet
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="my-auto py-16 text-center max-w-2xl flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-mono mb-6">
          <Activity className="w-3.5 h-3.5" />
          Automated MUSD Trove Defense
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
          {BRAND_TAGLINE}
        </h1>

        <p className="text-neutral-400 text-sm md:text-base leading-relaxed mb-8">
          {BRAND_DESCRIPTION}
        </p>

        {/* Real Live Status / Empty State */}
        <div className="w-full p-6 rounded-2xl border border-mezo-border bg-mezo-card text-left">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Vault className="w-4 h-4 text-orange-400" />
              Your Ballast Vault
            </div>
            <span className="text-xs text-neutral-500 font-mono">Status: Disconnected</span>
          </div>

          <div className="rounded-xl border border-dashed border-neutral-800 p-8 text-center bg-black/30">
            <p className="text-sm text-neutral-400 mb-2">No wallet connected</p>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Connect your Mezo Passport or Web3 wallet to inspect your active trove or deploy a
              personal defense vault.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full pt-8 border-t border-mezo-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500 font-mono">
        <div>
          &copy; {new Date().getFullYear()} {BRAND_NAME}. Built natively for Mezo.
        </div>
        <div className="flex items-center gap-6">
          <a
            href={BRAND_URLS.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-300 transition-colors"
          >
            GitHub
          </a>
          <a
            href={BRAND_URLS.mezoDocs}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-300 transition-colors"
          >
            Mezo Docs
          </a>
        </div>
      </footer>
    </main>
  );
}
