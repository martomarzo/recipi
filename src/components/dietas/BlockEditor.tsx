'use client';

import { useState } from 'react';
import IngredientMultiSelect from './IngredientMultiSelect';
import type { IngredientOption } from './EditorClient';

export interface BlockDTO {
  id: string;
  sort: number;
  name: string;
  emoji: string | null;
  durationDays: number;
  tipsMd: string | null;
  status: string;
  statusNote: string | null;
  ingredients: Array<{ ingredientId: number }>;
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'tolerado':
      return { label: '✅ Tolerado', cls: 'bg-ok/10 text-ok' };
    case 'con_sintomas':
      return { label: '⚠️ Con síntomas', cls: 'bg-mal/10 text-mal' };
    case 'en_prueba':
      return { label: 'En prueba', cls: 'bg-terra-bg text-terra-osc' };
    default:
      return { label: 'Pendiente', cls: 'bg-neutro-bg text-tinta-suave' };
  }
}

export default function BlockEditor({
  dietId,
  block,
  isFirst,
  isLast,
  ingredientes,
  cargandoIngredientes,
  onChanged,
}: {
  dietId: string;
  block: BlockDTO;
  isFirst: boolean;
  isLast: boolean;
  ingredientes: IngredientOption[];
  cargandoIngredientes: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(block.name);
  const [emoji, setEmoji] = useState(block.emoji ?? '');
  const [durationDays, setDurationDays] = useState(block.durationDays);
  const [tipsMd, setTipsMd] = useState(block.tipsMd ?? '');
  const [ingredientIds, setIngredientIds] = useState<number[]>(block.ingredients.map((i) => i.ingredientId));
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/dietas/${dietId}/bloques/${block.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    onChanged();
  }

  async function guardar() {
    await patch({
      name: name.trim() || block.name,
      emoji: emoji.trim() || null,
      durationDays: Number(durationDays) || block.durationDays,
      tipsMd: tipsMd.trim() || null,
      ingredientIds,
    });
    setEditing(false);
  }

  async function eliminar() {
    if (!confirm(`¿Quitar el bloque "${block.name}" de la dieta?`)) return;
    setBusy(true);
    await fetch(`/api/dietas/${dietId}/bloques/${block.id}`, { method: 'DELETE' });
    setBusy(false);
    onChanged();
  }

  const badge = statusBadge(block.status);

  return (
    <div className="rounded-xl border border-linea bg-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <button
              type="button"
              disabled={isFirst || busy}
              onClick={() => patch({ sortDirection: 'up' })}
              className="grid h-5 w-6 place-items-center text-xs text-tinta-suave disabled:opacity-30"
              aria-label="Subir"
            >
              ▲
            </button>
            <button
              type="button"
              disabled={isLast || busy}
              onClick={() => patch({ sortDirection: 'down' })}
              className="grid h-5 w-6 place-items-center text-xs text-tinta-suave disabled:opacity-30"
              aria-label="Bajar"
            >
              ▼
            </button>
          </div>
          <b>
            {block.emoji} {block.name}
          </b>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.cls}`}>{badge.label}</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setEditing((v) => !v)} className="btn min-h-[34px] px-3 text-[12.5px]">
            {editing ? 'Cerrar' : 'Editar'}
          </button>
          <button
            type="button"
            onClick={eliminar}
            disabled={busy}
            className="btn min-h-[34px] border-mal px-3 text-[12.5px] text-mal disabled:opacity-60"
          >
            Quitar
          </button>
        </div>
      </div>
      <p className="mt-1.5 text-[12.5px] text-tinta-suave">
        {block.durationDays} días · {block.ingredients.length} ingrediente(s) vinculado(s)
      </p>

      {editing && (
        <div className="mt-3 space-y-2.5 border-t border-linea pt-3">
          <div className="grid grid-cols-[1fr,80px] gap-2">
            <label className="block text-[12.5px] font-semibold">
              Nombre
              <input className="input mt-1 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-[12.5px] font-semibold">
              Emoji
              <input className="input mt-1 text-[13px]" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
            </label>
          </div>
          <label className="block text-[12.5px] font-semibold">
            Duración (días)
            <input
              type="number"
              min={1}
              className="input mt-1 text-[13px]"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
            />
          </label>
          <label className="block text-[12.5px] font-semibold">
            Tips
            <textarea rows={2} className="input mt-1 text-[13px]" value={tipsMd} onChange={(e) => setTipsMd(e.target.value)} />
          </label>
          <div>
            <span className="block text-[12.5px] font-semibold">Ingredientes vinculados</span>
            <IngredientMultiSelect
              opciones={ingredientes}
              cargando={cargandoIngredientes}
              selected={ingredientIds}
              onChange={setIngredientIds}
            />
          </div>
          <button type="button" disabled={busy} onClick={guardar} className="btn-primario disabled:opacity-60">
            {busy ? 'Guardando…' : 'Guardar bloque'}
          </button>
        </div>
      )}
    </div>
  );
}
