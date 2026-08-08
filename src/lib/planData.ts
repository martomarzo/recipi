// Carga de una dieta desde la DB + cálculo del plan (server-only).
// Único punto de entrada para timeline, detalle de semana, Gantt, resumen
// y disponibilidad en Recetas — así todos derivan fechas y disponibilidad
// exactamente igual.

import { prisma } from "./prisma";
import { dbDateToISO } from "./dates";
import { computePlan, ComputedPlan, PhaseInput, BlockStatus, PhaseType } from "./plan";

export interface LoadedDiet {
  diet: {
    id: string;
    userId: string;
    name: string;
    description: string | null;
    startDate: string; // ISODate
    isActive: boolean;
    archivedAt: Date | null;
  };
  plan: ComputedPlan;
  /** Ingredientes "base segura": reglas permitido expandidas por categoría. */
  baseIds: Set<number>;
  /** Ids de ingredientes ligados a algún bloque de reintroducción. */
  reintroIds: Set<number>;
}

type DietWithPhases = NonNullable<Awaited<ReturnType<typeof fetchDiet>>>;

function fetchDiet(dietId: string, userId: string) {
  return prisma.diet.findFirst({
    where: { id: dietId, userId },
    include: {
      phases: {
        orderBy: { sort: "asc" },
        include: {
          blocks: { orderBy: { sort: "asc" }, include: { ingredients: true } },
          rules: true,
        },
      },
    },
  });
}

export async function loadDiet(dietId: string, userId: string): Promise<LoadedDiet | null> {
  const diet = await fetchDiet(dietId, userId);
  if (!diet) return null;
  return buildLoadedDiet(diet);
}

/** Dieta activa del usuario (para disponibilidad en Recetas); null si no hay. */
export async function loadActiveDiet(userId: string): Promise<LoadedDiet | null> {
  const active = await prisma.diet.findFirst({
    where: { userId, isActive: true, archivedAt: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!active) return null;
  return loadDiet(active.id, userId);
}

async function buildLoadedDiet(diet: DietWithPhases): Promise<LoadedDiet> {
  const phasesIn: PhaseInput[] = diet.phases.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as PhaseType,
    sort: p.sort,
    durationDays: p.durationDays,
    color: p.color,
    description: p.description,
    dailyRulesMd: p.dailyRulesMd,
    blocks: p.blocks.map((b) => ({
      id: b.id,
      sort: b.sort,
      name: b.name,
      emoji: b.emoji,
      durationDays: b.durationDays,
      status: b.status as BlockStatus,
      statusNote: b.statusNote,
      ingredientIds: b.ingredients.map((i) => i.ingredientId),
    })),
  }));

  const plan = computePlan(dbDateToISO(diet.startDate), phasesIn);

  const reintroIds = new Set<number>();
  for (const b of plan.blocks) for (const id of b.ingredientIds) reintroIds.add(id);

  // Base segura: reglas `permitido` (directas o por categoría), excluyendo
  // los ingredientes que entran por reintroducción.
  const allRules = diet.phases.flatMap((p) => p.rules);
  const permittedCategoryIds = allRules
    .filter((r) => r.rule === "permitido" && r.categoryId != null)
    .map((r) => r.categoryId as number);
  const directIds = allRules
    .filter((r) => r.rule === "permitido" && r.ingredientId != null)
    .map((r) => r.ingredientId as number);

  const byCategory = permittedCategoryIds.length
    ? await prisma.ingredient.findMany({
        where: { categoryId: { in: permittedCategoryIds }, archivedAt: null },
        select: { id: true },
      })
    : [];

  const baseIds = new Set<number>();
  for (const id of directIds) baseIds.add(id);
  for (const { id } of byCategory) baseIds.add(id);
  for (const id of Array.from(reintroIds)) baseIds.delete(id);

  return {
    diet: {
      id: diet.id,
      userId: diet.userId,
      name: diet.name,
      description: diet.description,
      startDate: dbDateToISO(diet.startDate),
      isActive: diet.isActive,
      archivedAt: diet.archivedAt,
    },
    plan,
    baseIds,
    reintroIds,
  };
}
