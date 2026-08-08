'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fmtDdMm, todayISO } from '@/lib/dates';
import { phaseClasses } from './phaseColors';

export interface DietaListItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  archivado: boolean;
  weekColors: string[];
  totalBlocks: number;
  toleratedBlocks: number;
}

export interface DietaOption {
  id: string;
  name: string;
  archivado: boolean;
}

export default function DietasListClient({
  dietas,
  paraDuplicar,
}: {
  dietas: DietaListItem[];
  paraDuplicar: DietaOption[];
}) {
  const [mostrarArchivadas, setMostrarArchivadas] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const hayArchivadas = dietas.some((d) => d.archivado);
  const visibles = mostrarArchivadas ? dietas : dietas.filter((d) => !d.archivado);

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl font-semibold">Mis dietas</h1>
        <p className="mx-auto mt-1 max-w-lg text-sm text-tinta-suave">
          Planes armados con los ingredientes y recetas del catálogo. Abrí uno para ver su timeline.
        </p>
      </div>

      {hayArchivadas && (
        <div className="mb-4 flex justify-center">
          <label className="flex items-center gap-2 text-sm text-tinta-suave">
            <input
              type="checkbox"
              checked={mostrarArchivadas}
              onChange={(e) => setMostrarArchivadas(e.target.checked)}
              className="h-4 w-4"
            />
            Mostrar dietas archivadas
          </label>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map((d) => (
          <DietaCard key={d.id} d={d} />
        ))}

        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-card border border-dashed border-linea p-5 text-center text-tinta-suave transition-colors hover:border-tinta-suave"
        >
          <span className="text-4xl leading-none text-salvia">+</span>
          <b className="text-tinta">Nueva dieta</b>
          <p className="max-w-[230px] text-xs">
            Creá un plan desde cero o duplicá uno existente con otra fecha de inicio, reutilizando ingredientes y
            recetas.
          </p>
        </button>
      </div>

      {showForm && <NuevaDietaModal opciones={paraDuplicar} onClose={() => setShowForm(false)} />}
    </div>
  );
}

function DietaCard({ d }: { d: DietaListItem }) {
  return (
    <Link
      href={`/dietas/${d.id}`}
      className={`card relative overflow-hidden p-5 transition-shadow hover:shadow-md ${
        d.archivado ? 'opacity-60' : ''
      }`}
    >
      {d.isActive && (
        <span className="mb-2 inline-block rounded-full border border-salvia bg-salvia-bg px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-salvia-osc">
          Activa
        </span>
      )}
      {d.archivado && (
        <span className="mb-2 ml-2 inline-block rounded-full border border-linea bg-neutro-bg px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-tinta-suave">
          Archivada
        </span>
      )}
      <h3 className="font-display text-xl font-semibold">{d.name}</h3>
      <div className="mb-3 mt-0.5 text-[13px] text-tinta-suave">
        {fmtDdMm(d.startDate)} – {fmtDdMm(d.endDate)}
      </div>
      <div className="mb-1.5 mt-2.5 flex h-2.5 gap-0.5 overflow-hidden rounded-md">
        {d.weekColors.map((c, i) => (
          <i key={i} className={`flex-1 ${phaseClasses(c).bg}`} />
        ))}
      </div>
      <div className="mb-3 text-[13px] text-tinta-suave">
        {d.totalBlocks > 0
          ? `${d.toleratedBlocks}/${d.totalBlocks} reintroducciones toleradas`
          : 'Sin bloques de reintroducción todavía'}
      </div>
      <span className="text-[13.5px] font-bold text-terra-osc">Abrir timeline →</span>
    </Link>
  );
}

function NuevaDietaModal({ opciones, onClose }: { opciones: DietaOption[]; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [duplicateFromId, setDuplicateFromId] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const opcionesOrdenadas = useMemo(
    () => [...opciones].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [opciones]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !startDate) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/dietas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        startDate,
        duplicateFromId: duplicateFromId || undefined,
        isActive,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      router.refresh();
      router.push(duplicateFromId ? `/dietas/${created.id}` : `/dietas/${created.id}/editar`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo crear la dieta.');
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-tinta/45 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card bg-crema p-6">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-display text-2xl font-semibold">Nueva dieta</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full border border-linea bg-white text-base"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <p className="rounded-xl bg-mal/10 px-4 py-2 text-sm text-mal">{error}</p>}
          <label className="block text-sm font-semibold">
            Nombre del plan
            <input
              className="input mt-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ej. Protocolo Intestinal — segunda ronda"
            />
          </label>
          <label className="block text-sm font-semibold">
            Fecha de inicio
            <input
              type="date"
              className="input mt-1"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm font-semibold">
            Duplicar de
            <select
              className="input mt-1"
              value={duplicateFromId}
              onChange={(e) => setDuplicateFromId(e.target.value)}
            >
              <option value="">— Desde cero —</option>
              {opcionesOrdenadas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.archivado ? ' (archivada)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Marcar como dieta activa
          </label>
          <button type="submit" disabled={busy} className="btn-primario w-full disabled:opacity-60">
            {busy ? 'Creando…' : 'Crear dieta'}
          </button>
        </form>
      </div>
    </div>
  );
}
