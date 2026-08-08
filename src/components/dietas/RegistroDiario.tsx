'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fmtDdMmYyyy } from '@/lib/dates';
import type { TrackingEntryDTO } from './TimelineClient';

export default function RegistroDiario({
  dietId,
  entries,
  today,
}: {
  dietId: string;
  entries: TrackingEntryDTO[];
  today: string | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  async function guardar() {
    if (!today || !note.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/dietas/${dietId}/tracking`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: today, noteMd: note.trim() }),
    });
    if (res.ok) {
      setNote('');
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo guardar la nota.');
    }
    setBusy(false);
  }

  return (
    <div className="card p-4">
      <h3 className="mb-2 font-display text-lg font-semibold">Registro de hoy</h3>
      {error && <p className="mb-2 rounded-xl bg-mal/10 px-3 py-1.5 text-sm text-mal">{error}</p>}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Síntomas, observaciones, cómo te sentiste hoy…"
        rows={3}
        className="input"
        disabled={!today}
      />
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={guardar}
          disabled={busy || !today || !note.trim()}
          className="btn-primario disabled:opacity-60"
        >
          {busy ? 'Guardando…' : 'Guardar nota'}
        </button>
      </div>

      {entries.length > 0 && (
        <details className="mt-3" open={showList} onToggle={(e) => setShowList((e.target as HTMLDetailsElement).open)}>
          <summary className="cursor-pointer text-[13.5px] font-semibold text-tinta-suave">
            Notas recientes ({entries.length})
          </summary>
          <ul className="mt-2 space-y-2 text-[13.5px]">
            {entries.map((e) => (
              <li key={e.id} className="rounded-lg border border-linea bg-white p-2.5">
                <div className="mb-0.5 text-xs font-bold text-tinta-suave">{fmtDdMmYyyy(e.date)}</div>
                <div className="whitespace-pre-wrap">{e.noteMd}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
