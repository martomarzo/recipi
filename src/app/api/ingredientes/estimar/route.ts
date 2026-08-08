import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { slugify, uniqueIngredientKey } from "@/lib/ingredientKeys";
import { estimateIngredients } from "@/lib/recetas/macroEstimator";
import { normalizeText } from "@/lib/recetas/match";

// POST: crea de una vez los ingredientes que faltan en el catálogo, con
// macros estimados por IA (usado por el import de recetas para las líneas
// sin mapear). Si un nombre ya existe (normalizado), reusa el existente en
// vez de duplicar. Los creados quedan marcados en `notes` como estimados.
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Estimación con IA no disponible: falta ANTHROPIC_API_KEY en el servidor." },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  const rawNames = Array.isArray(body?.names) ? (body.names as unknown[]) : null;
  if (!rawNames) {
    return NextResponse.json({ error: "Formato inválido: se espera { names: [...] }." }, { status: 400 });
  }
  const names = Array.from(
    new Set(rawNames.map((n) => String(n ?? "").trim()).filter(Boolean))
  ).slice(0, 30);
  if (names.length === 0) {
    return NextResponse.json({ error: "No hay nombres para estimar." }, { status: 400 });
  }

  const categories = await prisma.ingredientCategory.findMany({ orderBy: { sort: "asc" } });
  if (categories.length === 0) {
    return NextResponse.json({ error: "No hay categorías en el catálogo." }, { status: 500 });
  }
  const byKey = new Map(categories.map((c) => [c.key, c]));
  const fallbackCategory = byKey.get("otros") ?? categories[categories.length - 1];

  let estimates;
  try {
    estimates = await estimateIngredients(names, categories.map((c) => c.key));
  } catch (err) {
    console.error("Error estimando macros con IA:", err);
    return NextResponse.json(
      { error: "No se pudo estimar con IA. Probá de nuevo en un rato." },
      { status: 502 }
    );
  }

  // Índice de existentes por nombre normalizado para no duplicar el catálogo.
  const existing = await prisma.ingredient.findMany({
    where: { archivedAt: null },
    include: { category: true },
  });
  const byNorm = new Map(existing.map((i) => [normalizeText(i.name), i]));

  const items = [];
  for (const est of estimates) {
    const already = byNorm.get(normalizeText(est.name)) ?? byNorm.get(normalizeText(est.input));
    if (already) {
      items.push({ input: est.input, created: false, ingredient: already });
      continue;
    }

    const category = byKey.get(est.categoryKey) ?? fallbackCategory;
    const key = await uniqueIngredientKey(slugify(est.name));
    const ingredient = await prisma.ingredient.create({
      data: {
        key,
        categoryId: category.id,
        name: est.name,
        emoji: est.emoji,
        notes: "Valores estimados con IA — revisar.",
        kcal100: est.kcal100,
        protein100: est.protein100,
        carbs100: est.carbs100,
        fat100: est.fat100,
      },
      include: { category: true },
    });
    byNorm.set(normalizeText(est.name), ingredient);
    items.push({ input: est.input, created: true, ingredient });
  }

  return NextResponse.json({ items });
}
