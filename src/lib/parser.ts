import type { ParsedIngredient, ParsedRecipe, ParsedStep } from '@/types/recipe';

const SECTION_HEADERS = /^(ingredients?|directions?|steps?|instructions?|method|preparation|prep|for the|notes?)[\s:]*$/i;

const QUANTITY_PATTERN =
  /^([\d¼½¾⅓⅔⅛⅜⅝⅞]+(?:[\/\.\s][\d¼½¾⅓⅔⅛⅜⅝⅞]+)?)\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|g|grams?|kg|kilograms?|ml|milliliters?|l|liters?|lb|lbs|pounds?|cloves?|pinch|dash|cans?|bunches?|slices?|pieces?|pounds?|sticks?|heads?|sprigs?)\.?\s+(.+)$/i;

function parseIngredient(line: string): ParsedIngredient {
  const cleaned = line.replace(/^[-•*]\s*/, '').trim();
  const match = cleaned.match(QUANTITY_PATTERN);
  if (match) {
    return {
      quantity: match[1].trim(),
      unit: match[2].trim(),
      name: match[3].trim(),
    };
  }

  // Try quantity-only (e.g., "2 eggs")
  const simpleMatch = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞]+(?:[\/\.\s][\d¼½¾⅓⅔⅛⅜⅝⅞]+)?)\s+(.+)$/);
  if (simpleMatch) {
    return {
      quantity: simpleMatch[1].trim(),
      unit: null,
      name: simpleMatch[2].trim(),
    };
  }

  return { quantity: null, unit: null, name: cleaned };
}

type Section = 'name' | 'description' | 'ingredients' | 'steps' | 'unknown';

export function parseRecipe(rawText: string): ParsedRecipe {
  const lines = rawText.split('\n').map((l) => l.trim());

  let name = 'Untitled Recipe';
  let description = '';
  const ingredients: ParsedIngredient[] = [];
  const steps: ParsedStep[] = [];

  let currentSection: Section = 'name';
  let stepCounter = 1;
  let descLines: string[] = [];
  let nameFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line) {
      // Blank line — if we were in description, transition to unknown
      if (currentSection === 'description') {
        description = descLines.join(' ').trim();
        currentSection = 'unknown';
      }
      continue;
    }

    // Check for section headers
    if (SECTION_HEADERS.test(line) || (line.endsWith(':') && line.length < 50 && !/^\d/.test(line))) {
      const lower = line.toLowerCase().replace(':', '').trim();
      if (/^(ingredients?)$/.test(lower)) {
        currentSection = 'ingredients';
      } else if (/^(directions?|steps?|instructions?|method|preparation|prep)$/.test(lower)) {
        currentSection = 'steps';
      }
      // other headers (notes, for the sauce, etc.) — treat as unknown section
      continue;
    }

    // Name detection
    if (!nameFound) {
      name = line;
      nameFound = true;
      currentSection = 'description';
      continue;
    }

    if (currentSection === 'description') {
      descLines.push(line);
      continue;
    }

    if (currentSection === 'ingredients') {
      if (line.match(/^[-•*]/) || line.match(/^[\d¼½¾⅓⅔⅛⅜⅝⅞]/)) {
        ingredients.push(parseIngredient(line));
      } else if (line.length > 3) {
        ingredients.push(parseIngredient(line));
      }
      continue;
    }

    if (currentSection === 'steps') {
      // Strip leading step numbers like "1." "1)" "Step 1:"
      const stripped = line.replace(/^(step\s*)?\d+[.):\s]+/i, '').trim();
      if (stripped) {
        steps.push({ position: stepCounter++, text: stripped });
      }
      continue;
    }

    // unknown section — heuristic: if it looks like an ingredient, add it; else treat as step
    if (currentSection === 'unknown') {
      const isIngredientLike =
        line.match(/^[-•*]/) ||
        line.match(/^[\d¼½¾⅓⅔⅛⅜⅝⅞]/) ||
        line.match(QUANTITY_PATTERN);

      if (isIngredientLike) {
        if (steps.length === 0) {
          // No steps yet — probably still ingredients
          ingredients.push(parseIngredient(line));
        } else {
          steps.push({ position: stepCounter++, text: line });
        }
      } else if (line.length > 25) {
        // Long lines are likely steps
        const stripped = line.replace(/^(step\s*)?\d+[.):\s]+/i, '').trim();
        steps.push({ position: stepCounter++, text: stripped });
      } else if (line.length > 3 && ingredients.length > 0 && steps.length === 0) {
        // Short lines after already-found ingredients are likely more ingredients
        ingredients.push(parseIngredient(line));
      }
    }
  }

  // Flush pending description
  if (descLines.length > 0 && !description) {
    description = descLines.join(' ').trim();
  }

  return { name, description, ingredients, steps };
}
