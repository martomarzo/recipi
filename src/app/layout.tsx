import type { Metadata, Viewport } from 'next';
import { getSessionUser } from '@/lib/auth';
import NavMenu from '@/components/NavMenu';
import PWA from '@/components/PWA';
import './globals.css';

export const metadata: Metadata = {
  title: 'Protocolo',
  description: 'Planes de alimentación por fases',
  manifest: '/manifest.webmanifest',
  icons: { apple: '/iconos/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  themeColor: '#FAF7F2',
  width: 'device-width',
  initialScale: 1,
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="es">
      <body className="min-h-screen">
        <header className="no-print sticky top-0 z-50 border-b border-linea bg-crema/95 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
            <a href="/" className="leading-tight">
              <span className="font-display text-lg font-semibold">Protocolo</span>
              <small className="brand-spaced block text-[10.5px] font-bold text-salvia-osc">
                plan por fases
              </small>
            </a>
            {user && <NavMenu userName={user.name} />}
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-20 pt-6">{children}</main>
        <PWA />
      </body>
    </html>
  );
}
