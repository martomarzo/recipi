import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { visibleDietsWhere } from '@/lib/dietAccess';
import { dbDateToISO } from '@/lib/dates';
import { computePlan, PhaseInput } from '@/lib/plan';

function toPhaseInput(phases: Array<{
  id: string; name: string; type: string; sort: number; durationDays: number | null;
  color: string; description: string | null; dailyRulesMd: string | null;
  blocks: Array<{ id: string; sort: number; name: string; emoji: string | null; durationDays: number; status: string; statusNote: string | null }>;
}>): PhaseInput[] {
  return phases.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as PhaseInput['type'],
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
      status: b.status as PhaseInput['blocks'][number]['status'],
      statusNote: b.statusNote,
      ingredientIds: [],
    })),
  }));
}

// GET: lista de dietas visibles (propias + compartidas conmigo), con
// fases/bloques para mini-banda y progreso.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const diets = await prisma.diet.findMany({
    where: visibleDietsWhere(user.id),
    include: {
      user: { select: { name: true } },
      shares: { where: { userId: user.id }, select: { role: true } },
      phases: {
        orderBy: { sort: 'asc' },
        include: { blocks: { orderBy: { sort: 'asc' } } },
      },
    },
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });

  const result = diets.map((d) => {
    const plan = computePlan(dbDateToISO(d.startDate), toPhaseInput(d.phases));
    const totalBlocks = plan.blocks.length;
    const tolerated = plan.blocks.filter((b) => b.status === 'tolerado').length;
    const propia = d.userId === user.id;
    return {
      id: d.id,
      name: d.name,
      description: d.description,
      startDate: dbDateToISO(d.startDate),
      isActive: d.isActive,
      archivedAt: d.archivedAt,
      // null = propia; si es compartida, rol del share y nombre del dueño.
      sharedRole: propia ? null : d.shares[0]?.role ?? 'viewer',
      ownerName: propia ? null : d.user.name,
      weeks: plan.weeks.map((w) => ({ num: w.num, color: w.phase.color, phaseName: w.phase.name })),
      endDate: plan.endDate,
      totalBlocks,
      toleratedBlocks: tolerated,
    };
  });

  return NextResponse.json(result);
}

// POST: crea una dieta nueva, opcionalmente duplicando otra visible para el
// usuario (propia o compartida — la copia queda siempre a nombre de quien duplica).
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { name, startDate, duplicateFromId, isActive } = body as Record<string, unknown>;

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
  }
  if (typeof startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return NextResponse.json({ error: 'La fecha de inicio es obligatoria (YYYY-MM-DD).' }, { status: 400 });
  }
  const wantsActive = isActive === true;

  let source = null as Awaited<ReturnType<typeof loadSource>> | null;
  if (typeof duplicateFromId === 'string' && duplicateFromId) {
    source = await loadSource(duplicateFromId, user.id);
    if (!source) return NextResponse.json({ error: 'Dieta a duplicar no encontrada.' }, { status: 404 });
  }

  const created = await prisma.$transaction(async (tx) => {
    if (wantsActive) {
      await tx.diet.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false } });
    }

    const diet = await tx.diet.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: source?.description ?? null,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        isActive: wantsActive,
      },
    });

    if (source) {
      const phaseIdMap = new Map<string, string>();
      const blockIdMap = new Map<string, string>();

      for (const p of source.phases) {
        const newPhase = await tx.phase.create({
          data: {
            dietId: diet.id,
            name: p.name,
            type: p.type,
            sort: p.sort,
            startOffsetDays: p.startOffsetDays,
            durationDays: p.durationDays,
            color: p.color,
            description: p.description,
            dailyRulesMd: p.dailyRulesMd,
          },
        });
        phaseIdMap.set(p.id, newPhase.id);

        for (const b of p.blocks) {
          const newBlock = await tx.reintroBlock.create({
            data: {
              phaseId: newPhase.id,
              sort: b.sort,
              name: b.name,
              emoji: b.emoji,
              durationDays: b.durationDays,
              tipsMd: b.tipsMd,
              status: 'pendiente',
              statusNote: null,
            },
          });
          blockIdMap.set(b.id, newBlock.id);
          for (const bi of b.ingredients) {
            await tx.reintroBlockIngredient.create({
              data: { blockId: newBlock.id, ingredientId: bi.ingredientId },
            });
          }
        }

        for (const r of p.rules) {
          await tx.phaseIngredientRule.create({
            data: {
              phaseId: newPhase.id,
              ingredientId: r.ingredientId,
              categoryId: r.categoryId,
              rule: r.rule,
              note: r.note,
            },
          });
        }
      }

      for (const s of source.suggestions) {
        await tx.dishSuggestion.create({
          data: {
            dishId: s.dishId,
            dietId: diet.id,
            phaseId: s.phaseId ? phaseIdMap.get(s.phaseId) ?? null : null,
            blockId: s.blockId ? blockIdMap.get(s.blockId) ?? null : null,
            weekNumber: s.weekNumber,
          },
        });
      }
    } else {
      // computePlan() (lib/plan.ts) asume al menos una fase: sin ninguna,
      // `phases[phases.length-1]` resuelve a `undefined` y rompe cualquier
      // vista que dependa del plan calculado. Una dieta "desde cero" arranca
      // con una fase editable en vez de quedar en un estado inválido.
      await tx.phase.create({
        data: {
          dietId: diet.id,
          name: 'Fase 1',
          type: 'custom',
          sort: 1,
          startOffsetDays: 0,
          durationDays: 7,
          color: 'neutro',
          description: null,
        },
      });
    }

    return diet;
  });

  return NextResponse.json({ id: created.id }, { status: 201 });
}

function loadSource(id: string, userId: string) {
  return prisma.diet.findFirst({
    where: { id, ...visibleDietsWhere(userId) },
    include: {
      phases: {
        orderBy: { sort: 'asc' },
        include: {
          blocks: { orderBy: { sort: 'asc' }, include: { ingredients: true } },
          rules: true,
        },
      },
      suggestions: true,
    },
  });
}
