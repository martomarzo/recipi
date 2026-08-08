'use client';

// Vista "Disponibilidad" (Gantt) de una dieta — tercera sub-vista, junto a
// Timeline y Vista general. Replica visualmente el Gantt del prototipo
// (prototype.html, renderGantt() ~línea 794): eje X = días del plan
// (columnas ~12px), cabecera de semanas coloreada por fase, columna de
// ingredientes fija (sticky) y barras de disponibilidad por fila.
//
// Cálculo de barras: en vez de recorrer cada día de cada fila (día×fila),
// se usa ingredientAvailability() para obtener, por fila, los 1-3 rangos
// (segmentos) que describen su disponibilidad — igual que hace el propio
// dominio para "qué puedo comer hoy". Cada fila se pinta con 1-3 <div>
// absolutamente posicionados en vez de una celda por día.

import { useEffect, useMemo, useState, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComputedPlan } from '@/lib/plan';
import { ingredientAvailability } from '@/lib/plan';
import { diffDays, fmtDdMm, rangoDdMm, todayISO } from '@/lib/dates';
import { phaseClasses } from './phaseColors';

export interface GanttRow {
  id: number;
  name: string;
  emoji: string | null;
}

export interface GanttGroup {
  key: string;
  label: string;
  emoji: string;
  rows: GanttRow[];
}

export interface GanttDietDTO {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  isActive: boolean;
  archivedAt: string | null;
}

// Colores literales del Gantt del prototipo (no son tokens de fase — son
// estados de disponibilidad, definidos tal cual en prototype.html).
const DISP = '#C9DCC4'; // disponible
const TEST = '#C68A4F'; // en prueba (== token terra)
const MAL = '#B85C48'; // con síntomas → retirado (== token mal)
const OFF_BORDER = '#E8E2D8'; // == token linea

const CW = 12; // ancho de columna (día), como el prototipo
const LABEL_W = 180; // ancho de la columna fija de ingredientes

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function estadoTexto(status: string): string {
  if (status === 'con_sintomas') return 'con síntomas → retirado';
  if (status === 'tolerado') return 'tolerado ✓';
  if (status === 'en_prueba') return 'en prueba';
  return 'pendiente';
}

interface Segment {
  from: number; // offset de día (inclusive)
  to: number; // offset de día (exclusivo)
  color: string;
}

/** Rangos de disponibilidad de una fila, en offsets de día desde plan.startDate. */
function segmentsFor(plan: ComputedPlan, baseIds: Set<number>, rowId: number, gridDays: number): Segment[] {
  const av = ingredientAvailability(plan, rowId, baseIds);
  if (av.kind === 'base') {
    return [{ from: 0, to: gridDays, color: DISP }];
  }
  if (av.kind === 'reintro' && av.block) {
    const clamp = (n: number) => Math.max(0, Math.min(gridDays, n));
    const isSick = av.block.status === 'con_sintomas';
    const testStart = clamp(diffDays(plan.startDate, av.block.start));
    const testEnd = clamp(diffDays(plan.startDate, av.block.end) + 1);
    const segs: Segment[] = [];
    if (testEnd > testStart) segs.push({ from: testStart, to: testEnd, color: isSick ? MAL : TEST });
    if (!isSick && gridDays > testEnd) segs.push({ from: testEnd, to: gridDays, color: DISP });
    return segs;
  }
  return [];
}

function tooltipFor(row: GanttRow, plan: ComputedPlan, baseIds: Set<number>): string {
  const av = ingredientAvailability(plan, row.id, baseIds);
  const label = `${row.emoji ? row.emoji + ' ' : ''}${row.name}`;
  if (av.kind === 'base') return `${label} — disponible todo el plan`;
  if (av.kind === 'reintro' && av.block) {
    const estado = estadoTexto(av.block.status);
    return `${label} — entra con «${av.block.name}»: prueba ${fmtDdMm(av.block.start)}–${fmtDdMm(av.block.end)} (${estado})`;
  }
  return `${label} — no disponible en este plan`;
}

export default function GanttClient({
  diet,
  plan,
  baseIds,
  groups,
}: {
  diet: GanttDietDTO;
  plan: ComputedPlan;
  baseIds: number[];
  groups: GanttGroup[];
}) {
  const router = useRouter();
  const [today, setToday] = useState<string | null>(null);
  const [savingDate, setSavingDate] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setToday(todayISO());
  }, []);

  const baseIdsSet = useMemo(() => new Set(baseIds), [baseIds]);

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

  const filteredGroups = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, rows: g.rows.filter((r) => normalize(r.name).includes(q)) }))
      .filter((g) => g.rows.length > 0);
  }, [groups, search]);

  // Igual que en Timeline: la grilla cubre semanas completas (weeks.length*7),
  // no solo plan.totalDays — la disponibilidad de "base"/"tolerado" es
  // indefinida hacia adelante (fase de mantenimiento abierta).
  const gridDays = plan.weeks.length * 7;

  const hoyOffset = today ? diffDays(plan.startDate, today) : null;
  const hoyVisible = hoyOffset != null && hoyOffset >= 0 && hoyOffset < gridDays;
  const hoyLeftPx = LABEL_W + (hoyOffset ?? 0) * CW + CW / 2;

  const gridLinesBg =
    `repeating-linear-gradient(to right, rgba(46,51,46,.06) 0px, rgba(46,51,46,.06) 1px, transparent 1px, transparent ${CW}px)`;

  return (
    <div>
      <Link
        href="/dietas"
        className="mb-2 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-tinta-suave hover:text-tinta"
      >
        ← Todas las dietas
      </Link>

      <div className="text-center">
        <h1 className="font-display text-3xl font-medium sm:text-4xl">{diet.name}</h1>
        {diet.description && <p className="mx-auto mt-1 max-w-xl text-sm text-tinta-suave">{diet.description}</p>}
        <div className="mt-2.5 inline-flex items-center gap-2 rounded-full border border-linea bg-white px-4 py-1.5 text-[13.5px]">
          <label htmlFor="fechaInicioGantt" className="font-bold">
            Inicio del plan:
          </label>
          <input
            id="fechaInicioGantt"
            type="date"
            className="cursor-pointer border-none bg-transparent font-bold text-terra-osc outline-none disabled:opacity-60"
            value={diet.startDate}
            disabled={savingDate}
            onChange={(e) => onChangeStartDate(e.target.value)}
          />
        </div>
      </div>

      <div className="my-4 flex flex-wrap justify-center gap-3.5">
        <Link
          href={`/dietas/${diet.id}`}
          className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
        >
          Timeline
        </Link>
        <Link
          href={`/dietas/${diet.id}/disponibilidad`}
          className="min-h-[42px] rounded-full border border-salvia-osc bg-salvia-osc px-4 py-2 text-[13.5px] font-semibold text-crema"
        >
          Disponibilidad
        </Link>
        <Link
          href={`/dietas/${diet.id}/resumen`}
          className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
        >
          Vista general
        </Link>
        <Link
          href={`/dietas/${diet.id}/editar`}
          className="flex min-h-[42px] items-center rounded-full border border-linea bg-white px-4 py-2 text-[13.5px] font-semibold text-tinta hover:border-tinta-suave"
        >
          ✎ Editar fases y bloques
        </Link>
      </div>

      <div className="mb-1 text-center">
        <h2 className="font-display text-xl font-semibold">Disponibilidad de ingredientes</h2>
        <p className="mt-1 text-[13px] text-tinta-suave">
          Un día por columna · {rangoDdMm(plan.startDate, plan.endDate)} · en el eje Y, cuándo entra cada ingrediente
        </p>
      </div>

      <div className="mx-auto mb-3.5 max-w-md">
        <input
          type="search"
          className="input"
          placeholder="Filtrar ingredientes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="mb-3.5 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-[12.5px] text-tinta-suave">
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-sm" style={{ background: DISP }} />
          Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-sm" style={{ background: TEST }} />
          En prueba (4 días)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-sm" style={{ background: MAL }} />
          Con síntomas → retirado
        </span>
        <span className="flex items-center gap-1.5">
          <i className="inline-block h-3 w-3 rounded-sm border" style={{ background: '#F6F3ED', borderColor: OFF_BORDER }} />
          Todavía no
        </span>
      </div>

      {plan.weeks.length === 0 ? (
        <div className="card p-6 text-center text-sm text-tinta-suave">
          Este plan todavía no tiene fases configuradas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-linea bg-white pb-2">
          <div className="relative" style={{ minWidth: 'fit-content' }}>
            {/* líneas de grilla (una vez, no por fila) */}
            <div
              className="pointer-events-none absolute inset-y-0"
              style={{ left: LABEL_W, width: gridDays * CW, backgroundImage: gridLinesBg }}
            />
            {plan.weeks.slice(1).map((w) => (
              <div
                key={`wl-${w.num}`}
                className="pointer-events-none absolute inset-y-0 border-r-[1.5px]"
                style={{ left: LABEL_W + (w.num - 1) * 7 * CW, borderColor: OFF_BORDER }}
              />
            ))}
            {hoyVisible && (
              <div className="pointer-events-none absolute inset-y-0 z-20 w-0.5 bg-tinta" style={{ left: hoyLeftPx }}>
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-tinta px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-crema">
                  HOY
                </span>
              </div>
            )}

            {/* cabecera: semanas coloreadas por fase */}
            <div className="flex h-[26px]">
              <div className="sticky left-0 z-30 flex w-[180px] flex-none items-center overflow-hidden whitespace-nowrap border-r border-linea bg-white px-2.5 text-[10.5px] font-extrabold uppercase tracking-wide text-tinta-suave">
                Ingrediente / Semana
              </div>
              <div className="flex">
                {plan.weeks.map((w) => {
                  const pc = phaseClasses(w.phase.color);
                  return (
                    <div
                      key={w.num}
                      title={`Semana ${w.num} · ${rangoDdMm(w.start, w.end)} · ${w.phase.name}`}
                      className={`flex flex-none items-center justify-center border-r-2 border-white text-[10px] font-bold text-white ${pc.bg}`}
                      style={{ width: 7 * CW }}
                    >
                      S{w.num}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* cabecera opcional: fecha de inicio de cada semana */}
            <div className="mb-0.5 flex h-[16px]">
              <div className="sticky left-0 z-30 w-[180px] flex-none border-r border-linea bg-white" />
              <div className="flex">
                {plan.weeks.map((w) => (
                  <div
                    key={`d-${w.num}`}
                    className="flex-none whitespace-nowrap px-1 text-[10px] text-tinta-suave"
                    style={{ width: 7 * CW }}
                  >
                    {fmtDdMm(w.start)}
                  </div>
                ))}
              </div>
            </div>

            {filteredGroups.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-tinta-suave">
                No se encontraron ingredientes para «{search}».
              </div>
            )}

            {filteredGroups.map((group) => (
              <Fragment key={group.key}>
                <div className="flex h-[30px] items-center bg-crema">
                  <div className="sticky left-0 z-10 flex h-full w-[180px] flex-none items-center gap-1.5 overflow-hidden whitespace-nowrap border-r border-linea bg-crema px-2.5 text-[10.5px] font-extrabold uppercase tracking-wide text-tinta-suave">
                    {group.emoji} {group.label}
                  </div>
                  <div style={{ width: gridDays * CW }} />
                </div>
                {group.rows.map((row) => {
                  const segs = segmentsFor(plan, baseIdsSet, row.id, gridDays);
                  const title = tooltipFor(row, plan, baseIdsSet);
                  return (
                    <div key={row.id} title={title} className="group flex h-[26px] items-stretch">
                      <div className="sticky left-0 z-10 flex w-[180px] flex-none items-center gap-1.5 overflow-hidden whitespace-nowrap border-r border-linea bg-white px-2.5 text-[12px] text-tinta group-hover:text-terra-osc">
                        <span>{row.emoji}</span>
                        <span className="overflow-hidden text-ellipsis">{row.name}</span>
                      </div>
                      <div className="relative flex-none" style={{ width: gridDays * CW }}>
                        {segs.map((seg, i) => (
                          <div
                            key={i}
                            className="absolute inset-y-0"
                            style={{ left: seg.from * CW, width: (seg.to - seg.from) * CW, background: seg.color }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      <p className="mx-auto mt-4 max-w-[680px] text-center text-[12.5px] text-tinta-suave">
        Cada columna es un día. Los ingredientes de reintroducción aparecen cuando arranca su bloque de prueba; si un
        bloque queda marcado "con síntomas" en el timeline, acá se ve el corte. Pasá el mouse (o mantené presionado) sobre
        una fila para ver el detalle.
      </p>
    </div>
  );
}
