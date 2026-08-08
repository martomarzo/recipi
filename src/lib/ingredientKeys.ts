import { prisma } from "./prisma";

// Generación de `Ingredient.key` (slug único) — compartida entre el alta
// manual (/api/ingredientes) y el alta automática con IA (/api/ingredientes/estimar).

export function slugify(input: string): string {
  const base = input
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  return base || "ingrediente";
}

export async function uniqueIngredientKey(base: string): Promise<string> {
  let key = base;
  let n = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await prisma.ingredient.findUnique({ where: { key } })) {
    key = `${base}-${n}`;
    n++;
  }
  return key;
}
