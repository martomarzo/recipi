// Núcleo del dominio: cálculo del timeline de un plan.
// Todo se deriva de diets.startDate + duraciones — cambiar la fecha de inicio,
// reordenar un bloque o cambiar su duración recalcula todo (nada de fechas
// persistidas por fase/bloque). Replica la lógica de recalc() del prototipo:
// exclusión (21d) → probióticos (7d) → bloques de reintroducción secuenciales
// (4d c/u) → mantenimiento (abierto).

import { ISODate, addDays, diffDays } from "./dates";

export type BlockStatus = "pendiente" | "en_prueba" | "tolerado" | "con_sintomas";
export type PhaseType = "exclusion" | "probioticos" | "reintroduccion" | "mantenimiento" | "custom";

export interface BlockInput {
  id: string;
  sort: number;
  name: string;
  emoji: string | null;
  durationDays: number;
  status: BlockStatus;
  statusNote: string | null;
  ingredientIds: number[];
}

export interface PhaseInput {
  id: string;
  name: string;
  type: PhaseType;
  sort: number;
  durationDays: number | null; // null = abierta (mantenimiento)
  color: string;
  description: string | null;
  dailyRulesMd: string | null;
  blocks: BlockInput[];
}

export interface ComputedBlock extends BlockInput {
  phaseId: string;
  start: ISODate;
  end: ISODate; // inclusivo
}

export interface ComputedPhase extends Omit<PhaseInput, "blocks"> {
  start: ISODate;
  end: ISODate | null; // null = abierta
  blocks: ComputedBlock[];
}

export interface WeekBlock {
  block: ComputedBlock;
  overlapStart: ISODate;
  overlapEnd: ISODate;
}

export interface Week {
  num: number; // 1-based
  start: ISODate;
  end: ISODate;
  phase: ComputedPhase; // fase vigente al inicio de la semana
  blocks: WeekBlock[]; // bloques en prueba durante la semana
  prevTolerated: ComputedBlock[]; // ya reintroducidos (terminados antes de la semana, tolerados)
}

export interface ComputedPlan {
  startDate: ISODate;
  totalDays: number; // días de fases finitas
  endDate: ISODate; // último día de la última fase finita
  phases: ComputedPhase[];
  blocks: ComputedBlock[]; // todos, en orden cronológico
  weeks: Week[];
}

export function computePlan(startDate: ISODate, phasesIn: PhaseInput[]): ComputedPlan {
  const phases: ComputedPhase[] = [];
  const allBlocks: ComputedBlock[] = [];
  let cursor = 0; // offset en días desde el inicio

  for (const p of [...phasesIn].sort((a, b) => a.sort - b.sort)) {
    const sortedBlocks = [...p.blocks].sort((a, b) => a.sort - b.sort);
    // La fase de reintroducción dura lo que suman sus bloques (reencolar o
    // cambiar duraciones empuja el mantenimiento automáticamente).
    const effective =
      p.type === "reintroduccion" && sortedBlocks.length > 0
        ? sortedBlocks.reduce((s, b) => s + b.durationDays, 0)
        : p.durationDays;

    const start = addDays(startDate, cursor);
    const end = effective != null ? addDays(startDate, cursor + effective - 1) : null;

    let blockCursor = cursor;
    const blocks: ComputedBlock[] = sortedBlocks.map((b) => {
      const bStart = addDays(startDate, blockCursor);
      const bEnd = addDays(startDate, blockCursor + b.durationDays - 1);
      blockCursor += b.durationDays;
      return { ...b, phaseId: p.id, start: bStart, end: bEnd };
    });

    phases.push({ ...p, blocks, start, end });
    allBlocks.push(...blocks);
    if (effective != null) cursor += effective;
  }

  const totalDays = cursor;
  const endDate = addDays(startDate, totalDays - 1);
  const numWeeks = Math.max(1, Math.ceil(totalDays / 7));

  const weeks: Week[] = [];
  for (let i = 0; i < numWeeks; i++) {
    const wStart = addDays(startDate, i * 7);
    const wEnd = addDays(startDate, i * 7 + 6);
    const phase = phaseOn(phases, wStart) ?? phases[phases.length - 1];
    const blocks: WeekBlock[] = allBlocks
      .filter((b) => b.start <= wEnd && b.end >= wStart)
      .map((b) => ({
        block: b,
        overlapStart: b.start > wStart ? b.start : wStart,
        overlapEnd: b.end < wEnd ? b.end : wEnd,
      }));
    const prevTolerated = allBlocks.filter((b) => b.end < wStart && b.status === "tolerado");
    weeks.push({ num: i + 1, start: wStart, end: wEnd, phase, blocks, prevTolerated });
  }

  return { startDate, totalDays, endDate, phases, blocks: allBlocks, weeks };
}

/** Fase vigente en un día dado (las abiertas cubren desde su inicio en adelante). */
export function phaseOn(phases: ComputedPhase[], day: ISODate): ComputedPhase | null {
  let current: ComputedPhase | null = null;
  for (const p of phases) {
    if (p.start <= day && (p.end == null || day <= p.end)) current = p;
  }
  return current;
}

export function weekOf(plan: ComputedPlan, day: ISODate): Week | null {
  if (day < plan.startDate) return null;
  const idx = Math.floor(diffDays(plan.startDate, day) / 7);
  return plan.weeks[idx] ?? plan.weeks[plan.weeks.length - 1] ?? null;
}

// ── Disponibilidad de ingredientes ──────────────────────────────────────
// baseIds: set resuelto de ingredientes "base segura" (reglas `permitido`
// expandidas por categoría). Un ingrediente ligado a un bloque de
// reintroducción sigue el ciclo del bloque; si no es base ni de bloque,
// está en "a evitar" todo el plan.

export type AvailabilityKind = "base" | "reintro" | "no_disponible";

export interface Availability {
  kind: AvailabilityKind;
  block?: ComputedBlock;
  /** Día en que el ingrediente pasa a estar en prueba (inicio del bloque). */
  testStart?: ISODate;
  testEnd?: ISODate;
  /** Disponible definitivo desde (fin de prueba + 1) — salvo con_sintomas. */
  availableFrom?: ISODate | null;
  /** Semana (1-based) en que entra en prueba. */
  week?: number;
}

export function ingredientAvailability(
  plan: ComputedPlan,
  ingredientId: number,
  baseIds: Set<number>
): Availability {
  const block = plan.blocks.find((b) => b.ingredientIds.includes(ingredientId));
  if (block) {
    return {
      kind: "reintro",
      block,
      testStart: block.start,
      testEnd: block.end,
      availableFrom: block.status === "con_sintomas" ? null : addDays(block.end, 1),
      week: weekOf(plan, block.start)?.num,
    };
  }
  if (baseIds.has(ingredientId)) return { kind: "base" };
  return { kind: "no_disponible" };
}

export type DayState = "disponible" | "en_prueba" | "no";

/** Estado de un ingrediente en un día concreto (para el Gantt y "qué puedo comer hoy"). */
export function ingredientStateOn(
  plan: ComputedPlan,
  ingredientId: number,
  baseIds: Set<number>,
  day: ISODate
): DayState {
  const av = ingredientAvailability(plan, ingredientId, baseIds);
  if (av.kind === "base") return "disponible";
  if (av.kind === "no_disponible") return "no";
  const b = av.block!;
  if (day < b.start) return "no";
  if (day <= b.end) return b.status === "con_sintomas" ? "no" : "en_prueba";
  return b.status === "con_sintomas" ? "no" : "disponible";
}

// ── Reencolar un bloque ─────────────────────────────────────────────────
// Devuelve la nueva lista de sorts: el bloque pasa al final y los siguientes
// suben una posición. Las fechas se recalculan solas al derivarse del orden.

export function requeueSorts(blocks: Array<{ id: string; sort: number }>, blockId: string) {
  const sorted = [...blocks].sort((a, b) => a.sort - b.sort);
  const idx = sorted.findIndex((b) => b.id === blockId);
  if (idx === -1) return [];
  const [moved] = sorted.splice(idx, 1);
  sorted.push(moved);
  return sorted.map((b, i) => ({ id: b.id, sort: i + 1 }));
}
