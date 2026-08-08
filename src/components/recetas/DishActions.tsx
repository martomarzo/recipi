'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface DishActionsProps {
  id: string;
  isOwner: boolean;
  isGlobal: boolean;
  duplicatePayload: {
    name: string;
    description: string | null;
    mealType: string;
    recipeMd: string | null;
    ingredients: { ingredientId: number; grams: number }[];
  };
}

export default function DishActions({ id, isOwner, isGlobal, duplicatePayload }: DishActionsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function archivar() {
    if (!confirm('¿Archivar esta receta? Dejará de verse en el catálogo.')) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/recetas/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo archivar.');
      router.push('/recetas');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo archivar.');
      setBusy(false);
    }
  }

  async function duplicar() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...duplicatePayload, name: `${duplicatePayload.name} (copia)` }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo duplicar.');
      router.push(`/recetas/${data.dish.id}/editar`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo duplicar.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {isOwner && (
          <>
            <a href={`/recetas/${id}/editar`} className="btn">
              Editar
            </a>
            <button onClick={archivar} disabled={busy} className="btn disabled:opacity-50">
              Archivar
            </button>
          </>
        )}
        {isGlobal && (
          <button onClick={duplicar} disabled={busy} className="btn-primario disabled:opacity-50">
            Duplicar y editar
          </button>
        )}
      </div>
      {error && <p className="text-sm text-mal">{error}</p>}
    </div>
  );
}
