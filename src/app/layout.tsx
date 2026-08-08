import type { Metadata } from 'next';
import Link from 'next/link';
import Logo from '@/components/Logo';
import './globals.css';

export const metadata: Metadata = {
  title: 'Recipi',
  description: 'Your personal recipe collection',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-amber-100 bg-white/90 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Logo size={32} />
              <span className="text-xl font-bold text-amber-700 tracking-tight">Recipi</span>
            </Link>
            <Link
              href="/recipes/new"
              className="rounded-lg bg-amber-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
            >
              + New Recipe
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
