import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { loadActiveDiet } from "@/lib/planData";
import { DISH_INCLUDE, toDishDTO, visibilityWhere } from "@/lib/recetas/dishQuery";
import { parseDishInput } from "@/lib/recetas/dishInput";
import { normalizeText } from "@/lib/recetas/match";
import { isMealType } from "@/lib/recetas/constants";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  const mealType = params.get("mealType");
  const dietId = params.get("dietId");
  const phaseId = params.get("phaseId");
  const blockId = params.get("blockId");
  const weekNumberRaw = params.get("weekNumber");
  const weekNumber = weekNumberRaw ? Number(weekNumberRaw) : null;

  const where: Prisma.DishWhereInput = visibilityWhere(user.id);
  if (isMealType(mealType)) where.mealType = mealType;

  if (dietId || phaseId || blockId || weekNumber != null) {
    where.suggestions = {
      some: {
        ...(dietId ? { dietId } : {}),
        ...(phaseId ? { phaseId } : {}),
        ...(blockId ? { blockId } : {}),
        ...(weekNumber != null ? { weekNumber } : {}),
      },
    };
  }

  const dishes = await prisma.dish.findMany({
    where,
    include: DISH_INCLUDE,
    orderBy: { createdAt: "desc" },
  });

  const activeDiet = await loadActiveDiet(user.id);
  let dtos = dishes.map((d) => toDishDTO(d, user.id, activeDiet));

  if (q) {
    const needle = normalizeText(q);
    dtos = dtos.filter(
      (d) =>
        normalizeText(d.name).includes(needle) ||
        d.ingredients.some((i) => normalizeText(i.name).includes(needle))
    );
  }

  return NextResponse.json({ dishes: dtos, hasActiveDiet: activeDiet != null });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = await parseDishInput(body, user.id);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data } = parsed;

  const dish = await prisma.dish.create({
    data: {
      userId: user.id,
      name: data.name,
      description: data.description,
      mealType: data.mealType,
      recipeMd: data.recipeMd,
      sourceUrl: data.sourceUrl,
      rawText: data.rawText,
      parsedJson: data.parsedJson,
      ingredients: {
        create: data.ingredients.map((i, idx) => ({ ingredientId: i.ingredientId, grams: i.grams, sort: idx })),
      },
      suggestions: {
        create: data.suggestions.map((s) => ({
          dietId: s.dietId,
          phaseId: s.phaseId ?? null,
          blockId: s.blockId ?? null,
          weekNumber: s.weekNumber ?? null,
        })),
      },
    },
    include: DISH_INCLUDE,
  });

  const activeDiet = await loadActiveDiet(user.id);
  return NextResponse.json({ dish: toDishDTO(dish, user.id, activeDiet) }, { status: 201 });
}
