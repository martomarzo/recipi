'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { phaseClasses } from './phaseColors';
import BlockEditor, { BlockDTO } from './BlockEditor';

export interface IngredientOption {
  id: number;
  name: string;
  emoji: string | null;
  category: { key: string; name: string; emoji: string };
}

interface PhaseDTO {
  id: string;
  name: string;
  type: string;
  sort: number;
  durationDays: number | null;
  color: string;
  description: string | null;
  blocks: BlockDTO[];
}

interface DietDTO {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  isActive: boolean;
  archivedAt: string | null;
  phases: PhaseDTO[];
}

export default function EditorClient({ dietInicial }: { dietInicial: DietDTO }) {
  const router = useRouter();
  const diet = dietInicial;
  const [ingredientes, setIngredientes] = useState<IngredientOption[]>([]);
  const [cargandoIngredientes, setCargandoIngredientes] = useState(true);

  useEffect(() => {
    fetch('/api/ingredientes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setIngredientes)
      .catch(() => {})
      .finally(() => setCargandoIngredientes(false));
  }, []);

  function onChanged() {
    router.refresh();
  }

  return (
    <div>
      <Link
        href={`/dietas/${diet.id}`}
        className="mb-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-tinta-suave hover:text-tinta"
      >
        ← Volver al timeline
      </Link>
      <h1 className="font-display text-3xl font-semibold">Editar «{diet.name}»</h1>
      <p className="mt-1 text-sm text-tinta-suave">
        Datos del plan, fases y bloques de reintroducción. Las fechas se recalculan solas a partir de la duración de
        cada fase y bloque.
      </p>

      <DietFieldsForm diet={diet} onSaved={onChanged} />

      <div className="mt-8 space-y-6">
        {diet.phases.map((phase) => (
          <PhaseEditor
            key={phase.id}
            dietId={diet.id}
            phase={phase}
            ingredientes={ingredientes}
            cargandoIngredientes={cargandoIngredientes}
            onChanged={onChanged}
          />
        ))}
        {diet.phases.length === 0 && (
          <p className="text-sm text-tinta-suave">Esta dieta todavía no tiene fases cargadas.</p>
        )}
      </div>
    </div>
  );
}

function DietFieldsForm({ diet, onSaved }: { diet: DietDTO; onSaved: () => void }) {
  const [name, setName] = useState(diet.name);
  const [description, setDescription] = useState(diet.description ?? '');
  const [isActive, setIsActive] = useState(diet.isActive);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(diet.name);
    setDescription(diet.description ?? '');
    setIsActive(diet.isActive);
  }, [diet.name, diet.description, diet.isActive]);

  async function guardar() {
    setBusy(true);
    await fetch(`/api/dietas/${diet.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, isActive }),
    });
    setBusy(false);
    onSaved();
  }

  async function archivar(archive: boolean) {
    setBusy(true);
    await fetch(`/api/dietas/${diet.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archive }),
    });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="card mt-5 space-y-3.5 p-5">
      <label className="block text-sm font-semibold">
        Nombre del plan
        <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold">
        Descripción
        <textarea rows={3} className="input mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Dieta activa
      </label>
      <div className="flex flex-wrap items-center gap-2.5">
        <button type="button" disabled={busy} onClick={guardar} className="btn-primario disabled:opacity-60">
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {diet.archivedAt ? (
          <button type="button" disabled={busy} onClick={() => archivar(false)} className="btn disabled:opacity-60">
            Desarchivar
          </button>
        ) : (
          <button type="button" disabled={busy} onClick={() => archivar(true)} className="btn text-mal disabled:opacity-60">
            Archivar dieta
          </button>
        )}
      </div>
    </div>
  );
}

function PhaseEditor({
  dietId,
  phase,
  ingredientes,
  cargandoIngredientes,
  onChanged,
}: {
  dietId: string;
  phase: PhaseDTO;
  ingredientes: IngredientOption[];
  cargandoIngredientes: boolean;
  onChanged: () => void;
}) {
  const [name, setName] = useState(phase.name);
  const [abierta, setAbierta] = useState(phase.durationDays == null);
  const [durationDays, setDurationDays] = useState(phase.durationDays ?? 7);
  const [busy, setBusy] = useState(false);
  const pc = phaseClasses(phase.color);

  useEffect(() => {
    setName(phase.name);
    setAbierta(phase.durationDays == null);
    setDurationDays(phase.durationDays ?? 7);
  }, [phase.name, phase.durationDays]);

  async function guardarFase() {
    setBusy(true);
    await fetch(`/api/dietas/${dietId}/fases/${phase.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() || phase.name, durationDays: abierta ? null : Number(durationDays) }),
    });
    setBusy(false);
    onChanged();
  }

  return (
    <div className="card overflow-hidden p-5">
      <div className="flex items-center gap-2">
        <span className={`h-3 w-3 rounded ${pc.bg}`} />
        <span className="text-[11px] font-bold uppercase tracking-wide text-tinta-suave">{phase.type}</span>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-[1fr,160px,auto]">
        <label className="block text-[12.5px] font-semibold">
          Nombre de la fase
          <input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-[12.5px] font-semibold">
          Duración (días)
          <input
            type="number"
            min={1}
            className="input mt-1 disabled:opacity-50"
            value={durationDays}
            disabled={abierta}
            onChange={(e) => setDurationDays(Number(e.target.value))}
          />
          <span className="mt-1 flex items-center gap-1.5 text-[12px] font-normal text-tinta-suave">
            <input type="checkbox" checked={abierta} onChange={(e) => setAbierta(e.target.checked)} />
            Fase abierta (sin duración fija)
          </span>
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={guardarFase}
          className="btn-primario mt-1 self-end disabled:opacity-60 sm:mt-6"
        >
          {busy ? 'Guardando…' : 'Guardar fase'}
        </button>
      </div>

      {phase.type === 'reintroduccion' && (
        <div className="mt-5 border-t border-linea pt-4">
          <h4 className="mb-2.5 text-[12.5px] font-extrabold uppercase tracking-[.1em] text-tinta-suave">
            Bloques de reintroducción
          </h4>
          <div className="space-y-2.5">
            {phase.blocks.map((b, i) => (
              <BlockEditor
                key={b.id}
                dietId={dietId}
                block={b}
                isFirst={i === 0}
                isLast={i === phase.blocks.length - 1}
                ingredientes={ingredientes}
                cargandoIngredientes={cargandoIngredientes}
                onChanged={onChanged}
              />
            ))}
          </div>
          <AddBlockForm dietId={dietId} phaseId={phase.id} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

function AddBlockForm({ dietId, phaseId, onChanged }: { dietId: string; phaseId: string; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('');
  const [durationDays, setDurationDays] = useState(4);
  const [busy, setBusy] = useState(false);

  async function crear() {
    if (!name.trim()) return;
    setBusy(true);
    await fetch(`/api/dietas/${dietId}/bloques`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phaseId, name: name.trim(), emoji: emoji.trim() || null, durationDays }),
    });
    setBusy(false);
    setName('');
    setEmoji('');
    setDurationDays(4);
    setOpen(false);
    onChanged();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn mt-3">
        + Agregar bloque
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2.5 rounded-xl border border-dashed border-linea p-3.5">
      <div className="grid grid-cols-[1fr,80px,100px] gap-2">
        <label className="block text-[12.5px] font-semibold">
          Nombre
          <input className="input mt-1 text-[13px]" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-[12.5px] font-semibold">
          Emoji
          <input className="input mt-1 text-[13px]" value={emoji} onChange={(e) => setEmoji(e.target.value)} />
        </label>
        <label className="block text-[12.5px] font-semibold">
          Días
          <input
            type="number"
            min={1}
            className="input mt-1 text-[13px]"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value))}
          />
        </label>
      </div>
      <p className="text-[12px] text-tinta-suave">Podés vincular ingredientes y agregar tips después, editando el bloque.</p>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={crear} className="btn-primario disabled:opacity-60">
          {busy ? 'Creando…' : 'Crear bloque'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn">
          Cancelar
        </button>
      </div>
    </div>
  );
}
