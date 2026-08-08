'use client';

import { useEffect, useState } from 'react';

// Registra el service worker y muestra un indicador sutil sin conexión.
export default function PWA() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="no-print fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-linea bg-white/95 px-4 py-2 text-xs font-semibold text-tinta-suave shadow-sm">
      Sin conexión — mostrando última versión
    </div>
  );
}
