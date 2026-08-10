'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Dietas', match: (p: string) => p === '/' || p.startsWith('/dietas') },
  { href: '/recetas', label: 'Recetas', match: (p: string) => p.startsWith('/recetas') },
  { href: '/ingredientes', label: 'Ingredientes', match: (p: string) => p.startsWith('/ingredientes') },
  { href: '/usuarios', label: 'Usuarios', match: (p: string) => p.startsWith('/usuarios') },
];

export default function NavMenu({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="flex flex-wrap items-center justify-end gap-2">
      {ITEMS.map((item) => {
        const activo = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              activo
                ? 'border-tinta bg-tinta text-crema'
                : 'border-linea bg-white text-tinta hover:border-tinta-suave'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <button
        onClick={logout}
        title={`Cerrar sesión (${userName})`}
        className="min-h-[44px] rounded-full border border-linea bg-white px-3 py-2 text-sm text-tinta-suave hover:border-tinta-suave"
      >
        Salir
      </button>
    </nav>
  );
}
