import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 });

  const ingredient = await prisma.ingredient.findUnique({ where: { id }, include: { category: true } });
  if (!ingredient) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });

  return NextResponse.json(ingredient);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 });

  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};

  if (b.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
    }
    data.name = b.name.trim();
  }

  if (b.categoryId !== undefined) {
    const catId = Number(b.categoryId);
    if (!catId || Number.isNaN(catId)) {
      return NextResponse.json({ error: 'Categoría inválida.' }, { status: 400 });
    }
    const category = await prisma.ingredientCategory.findUnique({ where: { id: catId } });
    if (!category) return NextResponse.json({ error: 'Categoría inválida.' }, { status: 400 });
    data.categoryId = catId;
  }

  for (const field of ['kcal100', 'protein100', 'carbs100', 'fat100'] as const) {
    if (b[field] !== undefined) {
      const v = Number(b[field]);
      if (Number.isNaN(v) || v < 0) {
        return NextResponse.json({ error: `Valor inválido para ${field}.` }, { status: 400 });
      }
      data[field] = v;
    }
  }

  if (b.fiber100 !== undefined) {
    if (b.fiber100 === null || b.fiber100 === '') {
      data.fiber100 = null;
    } else {
      const v = Number(b.fiber100);
      if (Number.isNaN(v) || v < 0) {
        return NextResponse.json({ error: 'Valor inválido para fibra.' }, { status: 400 });
      }
      data.fiber100 = v;
    }
  }

  if (b.notes !== undefined) {
    data.notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null;
  }
  if (b.emoji !== undefined) {
    data.emoji = typeof b.emoji === 'string' && b.emoji.trim() ? b.emoji.trim() : null;
  }
  if (b.imagePath !== undefined) {
    data.imagePath = typeof b.imagePath === 'string' && b.imagePath.trim() ? b.imagePath.trim() : null;
  }
  // Solo se permite desarchivar explícitamente vía PATCH (archivar tiene su propia lógica en DELETE).
  if (b.archivedAt === null) {
    data.archivedAt = null;
  }

  const updated = await prisma.ingredient.update({ where: { id }, data, include: { category: true } });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const id = parseId(params.id);
  if (id === null) return NextResponse.json({ error: 'Id inválido.' }, { status: 400 });

  const existing = await prisma.ingredient.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'No encontrado.' }, { status: 404 });

  const [dishUses, rules, blocks] = await Promise.all([
    prisma.dishIngredient.count({ where: { ingredientId: id } }),
    prisma.phaseIngredientRule.count({ where: { ingredientId: id } }),
    prisma.reintroBlockIngredient.count({ where: { ingredientId: id } }),
  ]);

  if (dishUses + rules + blocks > 0) {
    const archived = await prisma.ingredient.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: { category: true },
    });
    return NextResponse.json({ archived: true, ingredient: archived });
  }

  await prisma.ingredient.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
