import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { visibleDietsWhere } from '@/lib/dietAccess';
import { dbDateToISO } from '@/lib/dates';
import { computePlan, PhaseInput } from '@/lib/plan';
import DietasListClient, { DietaListItem, DietaOption } from '@/components/dietas/DietasListClient';

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

export default async function DietasPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  // Propias + compartidas conmigo (el share aporta rol y nombre del dueño).
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

  const dietas: DietaListItem[] = diets.map((d) => {
    const plan = computePlan(dbDateToISO(d.startDate), toPhaseInput(d.phases));
    const totalBlocks = plan.blocks.length;
    const tolerated = plan.blocks.filter((b) => b.status === 'tolerado').length;
    const propia = d.userId === user.id;
    return {
      id: d.id,
      name: d.name,
      startDate: dbDateToISO(d.startDate),
      endDate: plan.endDate,
      isActive: d.isActive,
      archivado: d.archivedAt != null,
      sharedRole: propia ? null : d.shares[0]?.role === 'editor' ? ('editor' as const) : ('viewer' as const),
      ownerName: propia ? null : d.user.name,
      weekColors: plan.weeks.map((w) => w.phase.color),
      totalBlocks,
      toleratedBlocks: tolerated,
    };
  });

  const paraDuplicar: DietaOption[] = diets.map((d) => ({
    id: d.id,
    name: d.name,
    archivado: d.archivedAt != null,
  }));

  return <DietasListClient dietas={dietas} paraDuplicar={paraDuplicar} />;
}
