// Serialización compartida de Dish → DTO para las rutas de la API y las
// páginas server de Recetas. Único lugar donde se calculan macros y
// disponibilidad para no repetir la lógica en cada endpoint.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { macrosOf, Macros } from "@/lib/macros";
import { ingredientAvailability, ingredientStateOn } from "@/lib/plan";
import type { LoadedDiet } from "@/lib/planData";
import { describeAvailability, AvailabilityText } from "./availability";
import { todayISO } from "@/lib/dates";

export const DISH_INCLUDE = {
  ingredients: {
    orderBy: { sort: "asc" as const },
    include: { ingredient: { include: { category: true } } },
  },
  suggestions: {
    include: { diet: true, phase: true, block: true },
  },
} satisfies Prisma.DishInclude;

export type DishWithRelations = Prisma.DishGetPayload<{ include: typeof DISH_INCLUDE }>;

export interface DishIngredientDTO {
  ingredientId: number;
  name: string;
  emoji: string | null;
  grams: number;
  categoryId: number;
  categoryName: string;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  fiber100: number | null;
  availability?: AvailabilityText | null;
}

export interface SuggestionDTO {
  id: string;
  dietId: string | null;
  dietName: string | null;
  phaseId: string | null;
  phaseName: string | null;
  phaseColor: string | null;
  blockId: string | null;
  blockName: string | null;
  blockEmoji: string | null;
  weekNumber: number | null;
  label: string;
}

export interface DishDTO {
  id: string;
  name: string;
  description: string | null;
  mealType: string;
  recipeMd: string | null;
  sourceUrl: string | null;
  rawText: string | null;
  parsedJson: string | null;
  createdAt: string;
  isGlobal: boolean;
  isOwner: boolean;
  ingredients: DishIngredientDTO[];
  macros: Macros;
  suggestions: SuggestionDTO[];
  allAvailableToday: boolean | null; // null = sin dieta activa, no aplica
}

function suggestionLabel(s: DishWithRelations["suggestions"][number]): string {
  if (s.weekNumber != null) return `S${s.weekNumber}`;
  if (s.block) return `${s.block.emoji ?? "🔄"} ${s.block.name}`;
  if (s.phase) return s.phase.name;
  if (s.diet) return s.diet.name;
  return "Sugerida";
}

export function toDishDTO(dish: DishWithRelations, userId: string, activeDiet: LoadedDiet | null): DishDTO {
  const macros = macrosOf(dish.ingredients.map((di) => ({ grams: di.grams, ingredient: di.ingredient })));
  const today = todayISO();

  let allAvailableToday: boolean | null = null;
  const ingredients: DishIngredientDTO[] = dish.ingredients.map((di) => {
    let availability: AvailabilityText | null = null;
    if (activeDiet) {
      const av = ingredientAvailability(activeDiet.plan, di.ingredientId, activeDiet.baseIds);
      availability = describeAvailability(av, today);
    }
    return {
      ingredientId: di.ingredientId,
      name: di.ingredient.name,
      emoji: di.ingredient.emoji,
      grams: di.grams,
      categoryId: di.ingredient.categoryId,
      categoryName: di.ingredient.category.name,
      kcal100: di.ingredient.kcal100,
      protein100: di.ingredient.protein100,
      carbs100: di.ingredient.carbs100,
      fat100: di.ingredient.fat100,
      fiber100: di.ingredient.fiber100,
      availability,
    };
  });

  if (activeDiet) {
    allAvailableToday = dish.ingredients.every(
      (di) => ingredientStateOn(activeDiet.plan, di.ingredientId, activeDiet.baseIds, today) === "disponible"
    );
  }

  const suggestions: SuggestionDTO[] = dish.suggestions.map((s) => ({
    id: s.id,
    dietId: s.dietId,
    dietName: s.diet?.name ?? null,
    phaseId: s.phaseId,
    phaseName: s.phase?.name ?? null,
    phaseColor: s.phase?.color ?? null,
    blockId: s.blockId,
    blockName: s.block?.name ?? null,
    blockEmoji: s.block?.emoji ?? null,
    weekNumber: s.weekNumber,
    label: suggestionLabel(s),
  }));

  return {
    id: dish.id,
    name: dish.name,
    description: dish.description,
    mealType: dish.mealType,
    recipeMd: dish.recipeMd,
    sourceUrl: dish.sourceUrl,
    rawText: dish.rawText,
    parsedJson: dish.parsedJson,
    createdAt: dish.createdAt.toISOString(),
    isGlobal: dish.userId === null,
    isOwner: dish.userId === userId,
    ingredients,
    macros,
    suggestions,
    allAvailableToday,
  };
}

/** Visible si es del usuario o global (userId null) y no está archivada. */
export function visibilityWhere(userId: string): Prisma.DishWhereInput {
  return { archivedAt: null, OR: [{ userId }, { userId: null }] };
}

export async function findVisibleDish(id: string, userId: string) {
  return prisma.dish.findFirst({
    where: { id, ...visibilityWhere(userId) },
    include: DISH_INCLUDE,
  });
}
