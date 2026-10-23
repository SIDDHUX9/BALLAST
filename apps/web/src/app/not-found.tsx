import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-4xl font-serif font-bold mb-2">404 — Page Not Found</h2>
      <p className="text-sm font-mono text-ink-muted mb-6">
        The requested resource does not exist on Ballast.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 rounded-full bg-ink text-paper font-sans text-sm font-semibold hover:bg-ember transition-colors"
      >
        Return Home
      </Link>
    </div>
  );
}
