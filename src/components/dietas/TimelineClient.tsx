'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComputedPlan, Week } from '@/lib/plan';
import { diffDays, fmtDdMmYyyy, fmtLargo, rangoDdMm, todayISO } from '@/lib/dates';
import { phaseClasses } from './phaseColors';
import WeekDetailSheet from './WeekDetailSheet';
import RegistroDiario from './RegistroDiario';

export interface BaseGroup {
  categoryKey: string;
  categoryName: string;
  categoryEmoji: string;
  items: Array<{ id: number; name: string; emoji: string | null }>;
}

export interface SuggestionItem {
  id: string;
  dishId: string;
  name: string;
  mealType: string;
  kcal: number;
  phaseId: string | null;
  blockId: string | null;
  weekNumber: number | null;
}

export interface TrackingEntryDTO {
  id: string;
  date: string;
  noteMd: string;
}

export interface DietDTO {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  isActive: boolean;
  archivedAt: string | null;
}

function statusIcon(status: string): string {
  if (status === 'tolerado') return '✅';
  if (status === 'con_sintomas') return '⚠️';
  return '';
}

function weekLines(week: Week): ReactNode[] {
  if (week.blocks.length > 0) {
    return week.blocks.map((wb) => (
      <li key={wb.block.id} className="flex items-start gap-1.5">
        <span>{wb.block.emoji}</span>
        <span>
          <b>{wb.block.name}</b>{' '}
          <span className="text-xs text-tinta-suave">{rangoDdMm(wb.block.start, wb.block.end)}</span>{' '}
          {statusIcon(wb.block.status)}
        </span>
      </li>
    ));
  }
  return [
    <li key="desc" className="text-tinta-suave">
      {week.phase.description ?? week.phase.name}
    </li>,
  ];
}

export default function TimelineClient({
  diet,
  plan,
  baseGroups,
  evitarNotesByPhase,
  suggestions,
  trackingEntries,
  tipsMdByBlock,
  readOnly = false,
}: {
  diet: DietDTO;
  plan: ComputedPlan;
  baseGroups: BaseGroup[];
  evitarNotesByPhase: Record<string, string[]>;
  suggestions: SuggestionItem[];
  trackingEntries: TrackingEntryDTO[];
  tipsMdByBlock: Record<string, string | null>;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [today, setToday] = useState<string | null>(null);
  const [openWeek, setOpenWeek] = useState<number | null>(null);
  const [savingDate, setSavingDate] = useState(false);

  useEffect(() => {
    setToday(todayISO());
  }, []);

  async function onChangeStartDate(value: string) {
    if (!value) return;
    setSavingDate(true);
    await fetch(`/api/dietas/${diet.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate: value }),
    });
    setSavingDate(false);
    router.refresh();
  }

  const totalWeekDays = plan.weeks.length * 7;
  const weekToday = today ? plan.weeks.find((w) => today >= w.start && today <= w.end) ?? null : null;
  const beforeStart = today != null && today < plan.startDate;
  const afterEnd = today != null && !weekToday && !beforeStart;
  const hoyOffset = today ? diffDays(plan.startDate, today) : null;
  const hoyLeftPct =
    hoyOffset != null && hoyOffset >= 0 && hoyOffset < totalWeekDays ? (hoyOffset / totalWeekDays) * 100 : null;

  return (
    <div>
      <Link href="/dietas" className="mb-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-tinta-suave hover:text-tinta">
        ← Todas las dietas
      </Link>

      <div className="text-center">
        <h1 className="font-display text-3xl font-medium sm:text-4xl">{diet.name}</h1>
        {diet.description && <p className="mx-auto mt-1 max-w-xl text-sm text-tinta-suave">{diet.description}</p>}
        <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-linea bg-white px-4 py-1.5 text-[13.5px]">
          <label htmlFor="fechaInicio" className="font-bold">
            Inicio del plan:
          </label>
          {readOnly ? (
            <span className="font-bold text-terra-osc">{fmtDdMmYyyy(diet.startDate)}</span>
          ) : (
            <input
              id="fechaInicio"
              type="date"
              className="cursor-pointer border-none bg-transparent font-bold text-terra-osc outline-none disabled:opacity-60"
              value={diet.startDate}
              disabled={savingDate}
              onChange={(e) => onChangeStartDate(e.target.value)}
            />
          )}
        </div>

        {today && (
          <HoyBanner
            weekToday={weekToday}
            beforeStart={beforeStart}
            afterEnd={afterEnd}
            plan={plan}
            today={today}
            onAbrir={(n) => setOpenWeek(n)}
          />
        )}
      </div>

      <div className="my-4 flex flex-wrap justify-center gap-3.5">
        <Link
          href={`/dietas/${diet.id}`}
          className="min-h-[42px] rounded-full border border-salvia-osc bg-salvia-osc px-4 py-2 text-[13.5px] font-semibold text-crema"
        >
          Timeline
        </Link>
        <Link
          href={`/dietas/${diet.id}/disponibilidad`}
          className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
        >
          Disponibilidad
        </Link>
        <Link
          href={`/dietas/${diet.id}/resumen`}
          className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
        >
          Vista general
        </Link>
        {!readOnly && (
          <Link
            href={`/dietas/${diet.id}/editar`}
            className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
          >
            ✎ Editar fases y bloques
          </Link>
        )}
      </div>

      <div className="mb-3.5 flex flex-wrap justify-center gap-3.5 text-[13px] text-tinta-suave">
        {plan.phases.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <i className={`inline-block h-3 w-3 rounded ${phaseClasses(p.color).bg}`} />
            {p.name}
          </span>
        ))}
      </div>

      <div className="relative mx-1 mb-8">
        <div className="flex h-[38px] gap-[3px]">
          {plan.weeks.map((w) => (
            <button
              key={w.num}
              type="button"
              onClick={() => setOpenWeek(w.num)}
              title={`Semana ${w.num} · ${rangoDdMm(w.start, w.end)}`}
              className={`relative flex-1 rounded-lg opacity-90 transition-all hover:-translate-y-0.5 hover:opacity-100 ${phaseClasses(w.phase.color).bg}`}
            >
              <small className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[11px] text-tinta-suave">
                S{w.num}
              </small>
            </button>
          ))}
        </div>
        {hoyLeftPct != null && (
          <div className="pointer-events-none absolute -top-3 bottom-[-6px] w-0.5 bg-tinta" style={{ left: `${hoyLeftPct}%` }}>
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-tinta px-2 py-0.5 text-[10px] font-bold tracking-wide text-crema">
              HOY
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))]">
        {plan.weeks.map((w) => {
          const pc = phaseClasses(w.phase.color);
          const actual = weekToday?.num === w.num;
          return (
            <button
              key={w.num}
              type="button"
              onClick={() => setOpenWeek(w.num)}
              className={`card relative overflow-hidden p-4 text-left transition-shadow hover:shadow-md ${
                actual ? 'outline outline-2 outline-offset-2 outline-tinta' : ''
              }`}
            >
              <span className={`absolute inset-y-0 left-0 w-[5px] ${pc.bg}`} />
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-xl font-semibold">Semana {w.num}</h3>
                <span className="whitespace-nowrap text-[13px] text-tinta-suave">{rangoDdMm(w.start, w.end)}</span>
              </div>
              <span className={`my-2 inline-block rounded-full px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-wide text-white ${pc.bg}`}>
                {w.phase.name}
              </span>
              <ul className="grid gap-1.5 text-[13.5px]">{weekLines(w)}</ul>
            </button>
          );
        })}
      </div>

      <div className="mt-8">
        <RegistroDiario dietId={diet.id} entries={trackingEntries} today={today} readOnly={readOnly} />
      </div>

      {openWeek != null && (
        <WeekDetailSheet
          weekNum={openWeek}
          plan={plan}
          dietId={diet.id}
          baseGroups={baseGroups}
          evitarNotesByPhase={evitarNotesByPhase}
          suggestions={suggestions}
          tipsMdByBlock={tipsMdByBlock}
          onClose={() => setOpenWeek(null)}
          onChanged={() => router.refresh()}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}

function HoyBanner({
  weekToday,
  beforeStart,
  afterEnd,
  plan,
  today,
  onAbrir,
}: {
  weekToday: Week | null;
  beforeStart: boolean;
  afterEnd: boolean;
  plan: ComputedPlan;
  today: string;
  onAbrir: (n: number) => void;
}) {
  if (beforeStart) {
    return (
      <div className="mx-auto mt-3.5 max-w-[680px] rounded-card border border-linea bg-white px-[18px] py-3 text-[14px]">
        El plan empieza el <b>{fmtLargo(plan.startDate)}</b>
      </div>
    );
  }
  if (afterEnd) {
    return (
      <div className="mx-auto mt-3.5 max-w-[680px] rounded-card border border-linea bg-white px-[18px] py-3 text-[14px]">
        Reintroducción completada 🎉 — <b>mantenimiento</b> con todo lo tolerado
      </div>
    );
  }
  if (!weekToday) return null;
  const pc = phaseClasses(weekToday.phase.color);
  const enPrueba = weekToday.blocks.filter((wb) => today >= wb.block.start && today <= wb.block.end);
  return (
    <button
      type="button"
      onClick={() => onAbrir(weekToday.num)}
      className="mx-auto mt-3.5 flex max-w-[680px] flex-wrap items-center justify-center gap-3 rounded-card border border-linea bg-white px-[18px] py-3 text-[14px] transition-shadow hover:shadow-md"
    >
      <span className={`h-2.5 w-2.5 flex-none rounded-full ${pc.bg}`} />
      <span>
        Hoy · <b>Semana {weekToday.num}</b> · <b className={pc.text}>{weekToday.phase.name}</b>
        {enPrueba.length > 0 && (
          <>
            {' '}
            · en prueba: <b>{enPrueba.map((b) => `${b.block.emoji} ${b.block.name}`).join(', ')}</b>
          </>
        )}
      </span>
      <span className="text-[13px] font-semibold text-terra-osc">Ver detalle →</span>
    </button>
  );
}
