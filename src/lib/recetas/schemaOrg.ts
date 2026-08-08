// Extrae datos de receta desde JSON-LD schema.org/Recipe embebido en la
// página (<script type="application/ld+json">…</script>). Es la fuente
// preferida cuando está disponible: más confiable que parsear texto libre.

import { extractJsonLdBlocks } from "./html";
import { parseIngredientLine } from "./parser";
import type { ParsedRecipe } from "./types";

function typeIncludesRecipe(t: unknown): boolean {
  if (!t) return false;
  if (typeof t === "string") return t.toLowerCase() === "recipe";
  if (Array.isArray(t)) return t.some(typeIncludesRecipe);
  return false;
}

function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (node == null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    if (typeIncludesRecipe(obj["@type"])) return obj;
    if (obj["@graph"]) {
      const found = findRecipeNode(obj["@graph"]);
      if (found) return found;
    }
    for (const key of ["mainEntity", "mainEntityOfPage"]) {
      if (obj[key]) {
        const found = findRecipeNode(obj[key]);
        if (found) return found;
      }
    }
  }
  return null;
}

function flattenInstructions(instr: unknown): string[] {
  if (!instr) return [];
  if (typeof instr === "string") {
    return instr
      .split(/\n+/)
      .map((s) => s.replace(/^(paso\s*)?\d+[.):\s]+/i, "").trim())
      .filter(Boolean);
  }
  if (Array.isArray(instr)) {
    const out: string[] = [];
    for (const item of instr) {
      if (typeof item === "string") {
        out.push(item.trim());
      } else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (o["@type"] === "HowToSection" && Array.isArray(o.itemListElement)) {
          out.push(...flattenInstructions(o.itemListElement));
        } else if (typeof o.text === "string") {
          out.push(o.text.trim());
        } else if (typeof o.name === "string") {
          out.push(o.name.trim());
        }
      }
    }
    return out.filter(Boolean);
  }
  return [];
}

function textOf(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim();
  return "";
}

/** Devuelve la receta parseada desde JSON-LD, o null si no hay ningún bloque schema.org/Recipe. */
export function extractSchemaOrgRecipe(html: string): ParsedRecipe | null {
  const blocks = extractJsonLdBlocks(html);
  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block);
    } catch {
      continue;
    }
    const node = findRecipeNode(data);
    if (!node) continue;

    const rawIngredients = (node.recipeIngredient ?? node.ingredients ?? []) as unknown;
    const ingredients = Array.isArray(rawIngredients)
      ? rawIngredients.filter((i): i is string => typeof i === "string").map((i) => parseIngredientLine(i))
      : [];

    const steps = flattenInstructions(node.recipeInstructions);

    return {
      name: textOf(node.name) || "Receta sin título",
      description: textOf(node.description),
      ingredients,
      steps,
    };
  }
  return null;
}
