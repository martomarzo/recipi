import type { Metadata, Viewport } from 'next';
import { getSessionUser } from '@/lib/auth';
import Logo from '@/components/Logo';
import NavMenu from '@/components/NavMenu';
import PWA from '@/components/PWA';
import './globals.css';

export const metadata: Metadata = {
  title: 'Recipi',
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
            <a href="/" className="flex items-center gap-2.5">
              <Logo size={30} className="shrink-0" />
              <span className="font-display text-lg font-semibold">Recipi</span>
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
