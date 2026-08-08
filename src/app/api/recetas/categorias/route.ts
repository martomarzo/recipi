import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

/** Categorías de ingredientes (catálogo global, solo lectura) — para el
 * selector del alta rápida de ingrediente desde el constructor de recetas. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const categories = await prisma.ingredientCategory.findMany({ orderBy: { sort: "asc" } });
  return NextResponse.json(
    categories.map((c) => ({ id: c.id, key: c.key, name: c.name, emoji: c.emoji }))
  );
}
