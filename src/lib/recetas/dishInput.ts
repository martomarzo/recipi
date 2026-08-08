// Validación y normalización del body de POST/PATCH /api/recetas.

import { prisma } from "@/lib/prisma";
import { editableDietsWhere } from "@/lib/dietAccess";
import { isMealType } from "./constants";

export interface DishIngredientInput {
  ingredientId: number;
  grams: number;
}

export interface DishSuggestionInput {
  dietId: string;
  phaseId?: string | null;
  blockId?: string | null;
  weekNumber?: number | null;
}

export interface ValidDishInput {
  name: string;
  description: string | null;
  mealType: string;
  recipeMd: string | null;
  sourceUrl: string | null;
  rawText: string | null;
  parsedJson: string | null;
  ingredients: DishIngredientInput[];
  suggestions: DishSuggestionInput[];
}

export async function parseDishInput(
  body: unknown,
  userId: string
): Promise<{ data: ValidDishInput } | { error: string }> {
  if (!body || typeof body !== "object") return { error: "Cuerpo inválido." };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return { error: "El nombre es obligatorio." };
  if (!isMealType(b.mealType)) {
    return { error: "El tipo de comida debe ser desayuno, comida, cena o snack." };
  }

  const rawIngredients = Array.isArray(b.ingredients) ? b.ingredients : [];
  const ingredients: DishIngredientInput[] = [];
  for (const raw of rawIngredients) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const ingredientId = Number(r.ingredientId);
    const grams = Number(r.grams);
    if (!Number.isInteger(ingredientId) || ingredientId <= 0) continue;
    if (!Number.isFinite(grams) || grams <= 0) continue;
    ingredients.push({ ingredientId, grams });
  }
  if (ingredients.length === 0) {
    return { error: "Agregá al menos un ingrediente con gramos." };
  }

  const existing = await prisma.ingredient.findMany({
    where: { id: { in: ingredients.map((i) => i.ingredientId) } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((i) => i.id));
  const filteredIngredients = ingredients.filter((i) => existingIds.has(i.ingredientId));
  if (filteredIngredients.length === 0) {
    return { error: "Ninguno de los ingredientes existe en el catálogo." };
  }

  const rawSuggestions = Array.isArray(b.suggestions) ? b.suggestions : [];
  const suggestionInputs: DishSuggestionInput[] = [];
  for (const raw of rawSuggestions) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.dietId !== "string" || !r.dietId) continue;
    suggestionInputs.push({
      dietId: r.dietId,
      phaseId: typeof r.phaseId === "string" ? r.phaseId : null,
      blockId: typeof r.blockId === "string" ? r.blockId : null,
      weekNumber: typeof r.weekNumber === "number" ? r.weekNumber : null,
    });
  }

  let suggestions: DishSuggestionInput[] = [];
  if (suggestionInputs.length > 0) {
    const dietIds = Array.from(new Set(suggestionInputs.map((s) => s.dietId)));
    // Sugerencias solo hacia dietas donde el usuario escribe (dueño o editor).
    const ownedDiets = await prisma.diet.findMany({
      where: { id: { in: dietIds }, ...editableDietsWhere(userId) },
      select: { id: true },
    });
    const ownedIds = new Set(ownedDiets.map((d) => d.id));
    suggestions = suggestionInputs.filter((s) => ownedIds.has(s.dietId));
  }

  return {
    data: {
      name,
      description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
      mealType: b.mealType,
      recipeMd: typeof b.recipeMd === "string" && b.recipeMd.trim() ? b.recipeMd : null,
      sourceUrl: typeof b.sourceUrl === "string" && b.sourceUrl.trim() ? b.sourceUrl.trim() : null,
      rawText: typeof b.rawText === "string" && b.rawText.trim() ? b.rawText : null,
      parsedJson: typeof b.parsedJson === "string" && b.parsedJson.trim() ? b.parsedJson : null,
      ingredients: filteredIngredients,
      suggestions,
    },
  };
}
