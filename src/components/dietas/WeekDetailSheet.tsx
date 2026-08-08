'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ComputedBlock, ComputedPlan } from '@/lib/plan';
import { fmtLargo } from '@/lib/dates';
import { phaseClasses } from './phaseColors';
import { MiniMarkdown } from './markdown';
import type { BaseGroup, SuggestionItem } from './TimelineClient';

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-2.5 mt-5 flex items-center gap-2 text-[12.5px] font-extrabold uppercase tracking-[.14em] text-tinta-suave">
      <span>{children}</span>
      <span className="h-px flex-1 bg-linea" />
    </h4>
  );
}

function RecetaList({ items }: { items: SuggestionItem[] }) {
  return (
    <ul className="grid gap-1.5 rounded-xl border border-linea bg-white p-3.5 text-[13px]">
      {items.map((it) => (
        <li key={it.id} className="flex items-center justify-between gap-2.5">
          <Link href={`/recetas/${it.dishId}`} className="text-tinta hover:underline">
            {it.name}
          </Link>
          <span className="whitespace-nowrap font-bold">{it.kcal} kcal</span>
        </li>
      ))}
    </ul>
  );
}

function BlockCard({
  dietId,
  block,
  tipsMd,
  onChanged,
}: {
  dietId: string;
  block: ComputedBlock;
  tipsMd: string | null;
  onChanged: () => void;
}) {
  const [note, setNote] = useState(block.statusNote ?? '');
  const [askingSintomas, setAskingSintomas] = useState(false);
  const [busy, setBusy] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/dietas/${dietId}/bloques/${block.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setBusy(false);
    setAskingSintomas(false);
    onChanged();
  }

  function onTolerado() {
    patch({ status: block.status === 'tolerado' ? 'pendiente' : 'tolerado', statusNote: note || null });
  }
  function onConSintomas() {
    if (block.status === 'con_sintomas') {
      patch({ status: 'pendiente' });
      return;
    }
    setAskingSintomas(true);
  }

  return (
    <div className="rounded-xl border border-l-[5px] border-linea border-l-terra bg-white p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <b className="text-base">
          {block.emoji} {block.name}
        </b>
        <span className="whitespace-nowrap text-[13px] font-bold text-terra-osc">
          {fmtLargo(block.start)} → {fmtLargo(block.end)}
        </span>
      </div>
      {tipsMd && <p className="mt-1.5 text-[13.5px] text-tinta-suave">{tipsMd}</p>}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Nota (opcional)"
        rows={2}
        className="input mt-2.5 text-[13px]"
      />
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onTolerado}
          className={`min-h-[38px] rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold disabled:opacity-60 ${
            block.status === 'tolerado' ? 'border-ok bg-ok text-white' : 'border-linea bg-crema'
          }`}
        >
          ✓ Tolerado
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onConSintomas}
          className={`min-h-[38px] rounded-full border-[1.5px] px-3.5 text-[13px] font-semibold disabled:opacity-60 ${
            block.status === 'con_sintomas' ? 'border-mal bg-mal text-white' : 'border-linea bg-crema'
          }`}
        >
          ✕ Con síntomas
        </button>
      </div>
      {askingSintomas && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-terra-bg p-2.5 text-[13px]">
          <span className="w-full text-tinta-suave">¿Reintentar más adelante o seguir con el plan?</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: 'con_sintomas', statusNote: note || null, requeue: true })}
            className="btn"
          >
            ↻ Reencolar al final
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ status: 'con_sintomas', statusNote: note || null })}
            className="btn"
          >
            Marcar y seguir
          </button>
        </div>
      )}
    </div>
  );
}

export default function WeekDetailSheet({
  weekNum,
  plan,
  dietId,
  baseGroups,
  evitarNotesByPhase,
  suggestions,
  tipsMdByBlock,
  onClose,
  onChanged,
}: {
  weekNum: number;
  plan: ComputedPlan;
  dietId: string;
  baseGroups: BaseGroup[];
  evitarNotesByPhase: Record<string, string[]>;
  suggestions: SuggestionItem[];
  tipsMdByBlock: Record<string, string | null>;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const week = plan.weeks.find((w) => w.num === weekNum);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => setVisible(true));
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
    };
  }, [onClose]);

  if (!week) return null;
  const pc = phaseClasses(week.phase.color);

  const weekBlockIds = new Set(week.blocks.map((wb) => wb.block.id));
  const prevToleratedIds = new Set(week.prevTolerated.map((b) => b.id));
  const notYetTolerated = plan.blocks.filter((b) => !prevToleratedIds.has(b.id));

  const bucket1 = suggestions.filter((s) => s.weekNumber === week.num);
  const usedIds = new Set(bucket1.map((s) => s.id));
  const bucket2 = suggestions.filter((s) => !usedIds.has(s.id) && s.blockId && weekBlockIds.has(s.blockId));
  bucket2.forEach((s) => usedIds.add(s.id));
  const bucket3 = suggestions.filter((s) => !usedIds.has(s.id) && s.phaseId === week.phase.id);
  bucket3.forEach((s) => usedIds.add(s.id));
  const bucket4 = suggestions.filter((s) => !usedIds.has(s.id) && !s.phaseId && !s.blockId && s.weekNumber == null);
  const otras = [...bucket2, ...bucket3, ...bucket4];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-tinta/45 sm:items-center sm:p-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-t-[22px] bg-crema p-5 pb-10 transition-all duration-200 sm:max-h-[88vh] sm:rounded-[22px] ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-70'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="sticky top-0 float-right z-10 grid h-10 w-10 place-items-center rounded-full border border-linea bg-white text-base"
          aria-label="Cerrar"
        >
          ✕
        </button>
        <h2 className="font-display text-[28px] font-semibold">Semana {week.num}</h2>
        <div className="mb-3.5 text-sm text-tinta-suave">
          {fmtLargo(week.start)} → {fmtLargo(week.end)} · <span className={`font-bold ${pc.text}`}>{week.phase.name}</span>
        </div>
        {week.phase.description && <p className="text-[14px] text-tinta-suave">{week.phase.description}</p>}

        {week.blocks.length > 0 && (
          <>
            <SectionTitle>En prueba esta semana</SectionTitle>
            <div className="space-y-2.5">
              {week.blocks.map((wb) => (
                <BlockCard
                  key={wb.block.id}
                  dietId={dietId}
                  block={wb.block}
                  tipsMd={tipsMdByBlock[wb.block.id] ?? null}
                  onChanged={onChanged}
                />
              ))}
            </div>
          </>
        )}

        {week.prevTolerated.length > 0 && (
          <>
            <SectionTitle>Ya reintroducidos</SectionTitle>
            <div className="mb-1 flex flex-wrap gap-1.5">
              {week.prevTolerated.map((b) => (
                <span
                  key={b.id}
                  className="rounded-full border border-salvia bg-salvia-bg px-3 py-1 text-[13px] font-semibold text-salvia-osc"
                >
                  {b.emoji} {b.name}
                </span>
              ))}
            </div>
          </>
        )}

        <SectionTitle>Permitidos — base segura</SectionTitle>
        <div className="space-y-3">
          {baseGroups.length === 0 && <p className="text-[13.5px] text-tinta-suave">Sin reglas de base cargadas.</p>}
          {baseGroups.map((g) => (
            <div key={g.categoryKey}>
              <div className="mb-1.5 text-[13.5px] font-bold">
                {g.categoryEmoji} {g.categoryName}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((it) => (
                  <span key={it.id} className="rounded-full border border-linea bg-white px-3 py-1 text-[13px]">
                    {it.emoji ?? ''} {it.name.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <details className="mt-3.5 rounded-xl border border-linea bg-neutro-bg p-4">
          <summary className="cursor-pointer text-sm font-bold">
            🚫 A evitar{week.phase.type === 'reintroduccion' ? ' (lo que aún no reintrodujiste)' : ''}
          </summary>
          <div className="mt-2.5 space-y-2.5 text-[13.5px] text-tinta-suave">
            {(evitarNotesByPhase[week.phase.id] ?? []).map((note, i) => (
              <MiniMarkdown key={i} text={note} className="space-y-1" />
            ))}
            {notYetTolerated.length > 0 && (
              <div>
                <b className="text-tinta">Todavía no reintroducidos:</b>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {notYetTolerated.map((b) => (
                    <span key={b.id} className="rounded-full border border-linea bg-white px-3 py-1 text-[13px]">
                      {b.emoji} {b.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>

        {bucket1.length > 0 && (
          <>
            <SectionTitle>Recetas de esta semana</SectionTitle>
            <RecetaList items={bucket1} />
          </>
        )}
        {otras.length > 0 && (
          <>
            <SectionTitle>Más sugerencias para esta fase</SectionTitle>
            <RecetaList items={otras.slice(0, 8)} />
          </>
        )}

        {week.phase.dailyRulesMd && (
          <>
            <SectionTitle>Reglas de la fase</SectionTitle>
            <div className="rounded-xl border border-linea bg-salvia-bg p-4">
              <MiniMarkdown text={week.phase.dailyRulesMd} className="space-y-1.5 text-[13.5px]" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
