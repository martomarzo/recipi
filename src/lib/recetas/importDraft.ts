import type { ImportDraft, ParsedRecipe } from "./types";

function guessMealType(name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase();
  if (/desayuno|breakfast/.test(text)) return "desayuno";
  if (/cena|dinner/.test(text)) return "cena";
  if (/snack|merienda|picoteo/.test(text)) return "snack";
  return "comida";
}

export function buildDraft(
  parsed: ParsedRecipe,
  opts: { sourceUrl?: string; rawText: string; parsedWith: ImportDraft["parsedWith"] }
): ImportDraft {
  return {
    name: parsed.name,
    description: parsed.description,
    mealType: guessMealType(parsed.name, parsed.description),
    ingredientLines: parsed.ingredients,
    steps: parsed.steps,
    sourceUrl: opts.sourceUrl,
    rawText: opts.rawText,
    parsedWith: opts.parsedWith,
  };
}
