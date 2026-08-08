// Tipos compartidos del flujo de importación / parseo de recetas.

export interface ParsedIngredientLine {
  /** Línea tal cual venía en el texto/HTML original. */
  raw: string;
  quantity: string | null;
  unit: string | null;
  /** Nombre del ingrediente sin cantidad/unidad — usado para matchear contra el catálogo. */
  name: string;
}

export interface ParsedRecipe {
  name: string;
  description: string;
  ingredients: ParsedIngredientLine[];
  steps: string[];
}

/** Borrador devuelto por /api/recetas/importar, editable antes de guardar. */
export interface ImportDraft {
  name: string;
  description: string;
  mealType: string; // guess por defecto "comida"; el usuario lo confirma
  ingredientLines: ParsedIngredientLine[];
  steps: string[];
  sourceUrl?: string;
  rawText: string;
  parsedWith: "jsonld" | "claude" | "regex";
}
