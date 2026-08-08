// Parser de respaldo por regex (sin IA): separa un texto de receta en
// nombre, descripción, líneas de ingredientes y pasos. Se usa cuando no hay
// ANTHROPIC_API_KEY o cuando el parseo con Claude falla.

import type { ParsedIngredientLine, ParsedRecipe } from "./types";

const SECTION_HEADERS =
  /^(ingredientes?|para\s+la?\s.+|elaboraci[oó]n|preparaci[oó]n|instrucciones|pasos|modo\s+de\s+preparaci[oó]n|procedimiento|notas?|ingredients?|directions?|steps?|instructions?|method|preparation|prep)[\s:]*$/i;

const QUANTITY_PATTERN =
  /^([\d¼½¾⅓⅔⅛⅜⅝⅞]+(?:[/.,\s][\d¼½¾⅓⅔⅛⅜⅝⅞]+)?)\s*(tazas?|cucharadas?|cdas?|cucharaditas?|cdtas?|gramos?|gr|g|kg|kilos?|ml|mililitros?|l|litros?|lb|libras?|dientes?|pizcas?|latas?|ramas?|ramitas?|rodajas?|piezas?|unidades?|uds?|paquetes?|cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|kilograms?|milliliters?|liters?|pounds?|cloves?|pinch|dash|cans?|bunches?|slices?|pieces?|sticks?|heads?|sprigs?)\.?\s+(.+)$/i;

export function parseIngredientLine(line: string): ParsedIngredientLine {
  const raw = line.trim();
  const cleaned = raw.replace(/^[-•*]\s*/, "").trim();
  const match = cleaned.match(QUANTITY_PATTERN);
  if (match) {
    return {
      raw,
      quantity: match[1].trim(),
      unit: match[2].trim(),
      name: match[3].trim(),
    };
  }

  // Solo cantidad, sin unidad explícita (ej. "2 huevos")
  const simpleMatch = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞]+(?:[/.,\s][\d¼½¾⅓⅔⅛⅜⅝⅞]+)?)\s+(.+)$/);
  if (simpleMatch) {
    return {
      raw,
      quantity: simpleMatch[1].trim(),
      unit: null,
      name: simpleMatch[2].trim(),
    };
  }

  return { raw, quantity: null, unit: null, name: cleaned };
}

type Section = "name" | "description" | "ingredients" | "steps" | "unknown";

export function parseRecipe(rawText: string): ParsedRecipe {
  const lines = rawText.split("\n").map((l) => l.trim());

  let name = "Receta sin título";
  let description = "";
  const ingredients: ParsedIngredientLine[] = [];
  const steps: string[] = [];

  let currentSection: Section = "name";
  let descLines: string[] = [];
  let nameFound = false;

  for (const line of lines) {
    if (!line) {
      if (currentSection === "description") {
        description = descLines.join(" ").trim();
        currentSection = "unknown";
      }
      continue;
    }

    if (SECTION_HEADERS.test(line) || (line.endsWith(":") && line.length < 50 && !/^\d/.test(line))) {
      const lower = line.toLowerCase().replace(":", "").trim();
      if (/^ingredientes?$|^ingredients?$/.test(lower)) {
        currentSection = "ingredients";
      } else if (
        /^(elaboraci[oó]n|preparaci[oó]n|instrucciones|pasos|modo de preparaci[oó]n|procedimiento|directions?|steps?|instructions?|method|preparation|prep)$/.test(
          lower
        )
      ) {
        currentSection = "steps";
      }
      continue;
    }

    if (!nameFound) {
      name = line;
      nameFound = true;
      currentSection = "description";
      continue;
    }

    if (currentSection === "description") {
      descLines.push(line);
      continue;
    }

    if (currentSection === "ingredients") {
      if (line.match(/^[-•*]/) || line.match(/^[\d¼½¾⅓⅔⅛⅜⅝⅞]/) || line.length > 3) {
        ingredients.push(parseIngredientLine(line));
      }
      continue;
    }

    if (currentSection === "steps") {
      const stripped = line.replace(/^(paso\s*)?\d+[.):\s]+/i, "").trim();
      if (stripped) steps.push(stripped);
      continue;
    }

    // sección desconocida: heurística — parece ingrediente o parece paso
    if (currentSection === "unknown") {
      const isIngredientLike =
        line.match(/^[-•*]/) || line.match(/^[\d¼½¾⅓⅔⅛⅜⅝⅞]/) || line.match(QUANTITY_PATTERN);

      if (isIngredientLike) {
        if (steps.length === 0) {
          ingredients.push(parseIngredientLine(line));
        } else {
          steps.push(line);
        }
      } else if (line.length > 25) {
        const stripped = line.replace(/^(paso\s*)?\d+[.):\s]+/i, "").trim();
        steps.push(stripped);
      } else if (line.length > 3 && ingredients.length > 0 && steps.length === 0) {
        ingredients.push(parseIngredientLine(line));
      }
    }
  }

  if (descLines.length > 0 && !description) {
    description = descLines.join(" ").trim();
  }

  return { name, description, ingredients, steps };
}
