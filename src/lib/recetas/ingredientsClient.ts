// Cliente liviano para el catálogo de ingredientes desde componentes de
// Recetas. GET /api/ingredientes lo construye otro equipo en paralelo — acá
// solo lo consumimos, con parseo defensivo por si la forma de la respuesta
// cambia (array plano vs. objeto envolvente).

export interface IngredientLite {
  id: number;
  key?: string;
  name: string;
  categoryId: number;
  emoji: string | null;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  fiber100?: number | null;
}

export interface IngredientCategoryLite {
  id: number;
  key: string;
  name: string;
  emoji: string;
}

function unwrapList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of ["ingredients", "items", "results", "data"]) {
      if (Array.isArray(obj[key])) return obj[key] as unknown[];
    }
  }
  return [];
}

function toIngredientLite(raw: unknown): IngredientLite | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "number" || typeof o.name !== "string") return null;
  return {
    id: o.id,
    key: typeof o.key === "string" ? o.key : undefined,
    name: o.name,
    categoryId: typeof o.categoryId === "number" ? o.categoryId : 0,
    emoji: typeof o.emoji === "string" ? o.emoji : null,
    kcal100: typeof o.kcal100 === "number" ? o.kcal100 : 0,
    protein100: typeof o.protein100 === "number" ? o.protein100 : 0,
    carbs100: typeof o.carbs100 === "number" ? o.carbs100 : 0,
    fat100: typeof o.fat100 === "number" ? o.fat100 : 0,
    fiber100: typeof o.fiber100 === "number" ? o.fiber100 : null,
  };
}

export async function fetchIngredients(q: string): Promise<IngredientLite[]> {
  const url = q ? `/api/ingredientes?q=${encodeURIComponent(q)}` : "/api/ingredientes";
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  return unwrapList(data)
    .map(toIngredientLite)
    .filter((i): i is IngredientLite => i !== null);
}

export interface NewIngredientPayload {
  name: string;
  categoryId: number;
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  fiber100?: number;
  notes?: string;
  emoji?: string;
}

export async function createIngredient(payload: NewIngredientPayload): Promise<IngredientLite> {
  const res = await fetch("/api/ingredientes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "No se pudo crear el ingrediente");
  }
  const data = await res.json();
  const ing = toIngredientLite(data) ?? toIngredientLite((data as Record<string, unknown>).ingredient);
  if (!ing) throw new Error("Respuesta inesperada al crear el ingrediente");
  return ing;
}

export async function fetchCategories(): Promise<IngredientCategoryLite[]> {
  const res = await fetch("/api/recetas/categorias");
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}
