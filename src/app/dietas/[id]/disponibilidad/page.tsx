import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadDiet } from '@/lib/planData';
import GanttClient, { GanttGroup, GanttDietDTO } from '@/components/dietas/GanttClient';

export default async function DietaDisponibilidadPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const loaded = await loadDiet(params.id, user.id);
  if (!loaded) notFound();
  const { diet, plan, baseIds, reintroIds } = loaded;

  const [baseIngredients, reintroIngredients] = await Promise.all([
    prisma.ingredient.findMany({
      where: { id: { in: Array.from(baseIds) } },
      include: { category: true },
      orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
    }),
    prisma.ingredient.findMany({
      where: { id: { in: Array.from(reintroIds) } },
      select: { id: true, name: true, emoji: true },
    }),
  ]);

  // Grupo por categoría (base segura), en el orden de la categoría.
  const groups: GanttGroup[] = [];
  for (const ing of baseIngredients) {
    let group = groups.find((g) => g.key === `cat:${ing.category.key}`);
    if (!group) {
      group = {
        key: `cat:${ing.category.key}`,
        label: ing.category.name,
        emoji: ing.category.emoji,
        rows: [],
      };
      groups.push(group);
    }
    group.rows.push({ id: ing.id, name: ing.name, emoji: ing.emoji });
  }

  // Grupo final "Reintroducción", ordenado por el orden cronológico de bloques
  // (plan.blocks ya viene ordenado así — ver computePlan en src/lib/plan.ts).
  const reintroById = new Map(reintroIngredients.map((i) => [i.id, i]));
  const reintroGroup: GanttGroup = { key: 'reintro', label: 'Reintroducción', emoji: '🔄', rows: [] };
  for (const block of plan.blocks) {
    for (const ingredientId of block.ingredientIds) {
      const ing = reintroById.get(ingredientId);
      if (!ing) continue;
      reintroGroup.rows.push({ id: ing.id, name: ing.name, emoji: ing.emoji });
    }
  }
  if (reintroGroup.rows.length > 0) groups.push(reintroGroup);

  const dietDTO: GanttDietDTO = {
    id: diet.id,
    name: diet.name,
    description: diet.description,
    startDate: diet.startDate,
    isActive: diet.isActive,
    archivedAt: diet.archivedAt ? diet.archivedAt.toISOString() : null,
  };

  return (
    <GanttClient diet={dietDTO} plan={plan} baseIds={Array.from(baseIds)} groups={groups} />
  );
}
