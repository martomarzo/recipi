import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadDiet } from '@/lib/planData';
import { macrosOf } from '@/lib/macros';
import TimelineClient, { BaseGroup, SuggestionItem, TrackingEntryDTO } from '@/components/dietas/TimelineClient';

export default async function DietaTimelinePage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const loaded = await loadDiet(params.id, user.id);
  if (!loaded) notFound();
  const { diet, plan, baseIds } = loaded;

  const [baseIngredients, evitarRules, suggestionRows, trackingRows, blockTips] = await Promise.all([
    prisma.ingredient.findMany({
      where: { id: { in: Array.from(baseIds) } },
      include: { category: true },
      orderBy: [{ category: { sort: 'asc' } }, { name: 'asc' }],
    }),
    prisma.phaseIngredientRule.findMany({
      where: {
        phaseId: { in: plan.phases.map((p) => p.id) },
        rule: 'evitar',
        ingredientId: null,
        categoryId: null,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.dishSuggestion.findMany({
      where: { dietId: params.id },
      include: { dish: { include: { ingredients: { include: { ingredient: true } } } } },
    }),
    prisma.trackingEntry.findMany({
      where: { dietId: params.id },
      orderBy: { date: 'desc' },
      take: 15,
    }),
    // tipsMd no viaja en ComputedBlock (computePlan no lo conserva): se pasa aparte.
    prisma.reintroBlock.findMany({
      where: { phase: { dietId: params.id } },
      select: { id: true, tipsMd: true },
    }),
  ]);

  const baseGroups: BaseGroup[] = [];
  for (const ing of baseIngredients) {
    let group = baseGroups.find((g) => g.categoryKey === ing.category.key);
    if (!group) {
      group = { categoryKey: ing.category.key, categoryName: ing.category.name, categoryEmoji: ing.category.emoji, items: [] };
      baseGroups.push(group);
    }
    group.items.push({ id: ing.id, name: ing.name, emoji: ing.emoji });
  }

  const evitarNotesByPhase: Record<string, string[]> = {};
  for (const r of evitarRules) {
    if (!r.note) continue;
    (evitarNotesByPhase[r.phaseId] ??= []).push(r.note);
  }

  const suggestions: SuggestionItem[] = suggestionRows.map((s) => ({
    id: s.id,
    dishId: s.dishId,
    name: s.dish.name,
    mealType: s.dish.mealType,
    kcal: macrosOf(s.dish.ingredients.map((di) => ({ grams: di.grams, ingredient: di.ingredient }))).kcal,
    phaseId: s.phaseId,
    blockId: s.blockId,
    weekNumber: s.weekNumber,
  }));

  const trackingEntries: TrackingEntryDTO[] = trackingRows.map((t) => ({
    id: t.id,
    date: t.date.toISOString().slice(0, 10),
    noteMd: t.noteMd,
  }));

  const tipsMdByBlock: Record<string, string | null> = {};
  for (const b of blockTips) tipsMdByBlock[b.id] = b.tipsMd;

  const dietDTO = {
    id: diet.id,
    name: diet.name,
    description: diet.description,
    startDate: diet.startDate,
    isActive: diet.isActive,
    archivedAt: diet.archivedAt ? diet.archivedAt.toISOString() : null,
  };

  return (
    <TimelineClient
      diet={dietDTO}
      plan={plan}
      baseGroups={baseGroups}
      evitarNotesByPhase={evitarNotesByPhase}
      suggestions={suggestions}
      trackingEntries={trackingEntries}
      tipsMdByBlock={tipsMdByBlock}
    />
  );
}
