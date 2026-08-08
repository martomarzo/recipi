import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { loadActiveDiet } from "@/lib/planData";
import { DISH_INCLUDE, findVisibleDish, toDishDTO } from "@/lib/recetas/dishQuery";
import { parseDishInput } from "@/lib/recetas/dishInput";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const dish = await findVisibleDish(params.id, user.id);
  if (!dish) return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });

  const activeDiet = await loadActiveDiet(user.id);
  return NextResponse.json({ dish: toDishDTO(dish, user.id, activeDiet) });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await prisma.dish.findUnique({ where: { id: params.id } });
  if (!existing || existing.archivedAt) {
    return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json(
      { error: "Esta receta es global o de otro usuario. Duplicala para editarla." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = await parseDishInput(body, user.id);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data } = parsed;

  await prisma.$transaction([
    prisma.dish.update({
      where: { id: params.id },
      data: {
        name: data.name,
        description: data.description,
        mealType: data.mealType,
        recipeMd: data.recipeMd,
        sourceUrl: data.sourceUrl,
        rawText: data.rawText,
        parsedJson: data.parsedJson,
      },
    }),
    prisma.dishIngredient.deleteMany({ where: { dishId: params.id } }),
    prisma.dishIngredient.createMany({
      data: data.ingredients.map((i, idx) => ({
        dishId: params.id,
        ingredientId: i.ingredientId,
        grams: i.grams,
        sort: idx,
      })),
    }),
    prisma.dishSuggestion.deleteMany({ where: { dishId: params.id } }),
    prisma.dishSuggestion.createMany({
      data: data.suggestions.map((s) => ({
        dishId: params.id,
        dietId: s.dietId,
        phaseId: s.phaseId ?? null,
        blockId: s.blockId ?? null,
        weekNumber: s.weekNumber ?? null,
      })),
    }),
  ]);

  const dish = await prisma.dish.findUniqueOrThrow({ where: { id: params.id }, include: DISH_INCLUDE });
  const activeDiet = await loadActiveDiet(user.id);
  return NextResponse.json({ dish: toDishDTO(dish, user.id, activeDiet) });
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const existing = await prisma.dish.findUnique({ where: { id: params.id } });
  if (!existing || existing.archivedAt) {
    return NextResponse.json({ error: "Receta no encontrada" }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: "No podés archivar esta receta." }, { status: 403 });
  }

  await prisma.dish.update({ where: { id: params.id }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
