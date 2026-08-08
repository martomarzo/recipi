import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { dbDateToISO } from "@/lib/dates";
import { computePlan, PhaseInput, PhaseType, BlockStatus } from "@/lib/plan";

/** Dietas del usuario con sus fases y bloques — para el selector de
 * sugerencia (fase / bloque / semana) del constructor de recetas. No toca
 * src/app/api/dietas/**, que arma otro flujo en paralelo. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const diets = await prisma.diet.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      phases: {
        orderBy: { sort: "asc" },
        include: { blocks: { orderBy: { sort: "asc" } } },
      },
    },
  });

  const result = diets.map((diet) => {
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
        ingredientIds: [],
      })),
    }));
    const plan = computePlan(dbDateToISO(diet.startDate), phasesIn);

    return {
      id: diet.id,
      name: diet.name,
      isActive: diet.isActive,
      startDate: dbDateToISO(diet.startDate),
      totalWeeks: plan.weeks.length,
      phases: diet.phases.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        color: p.color,
        blocks: p.blocks.map((b) => ({ id: b.id, name: b.name, emoji: b.emoji })),
      })),
    };
  });

  return NextResponse.json(result);
}
