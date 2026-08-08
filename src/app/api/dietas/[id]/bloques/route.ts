import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// POST: agrega un bloque de reintroducción a una fase de la dieta.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const diet = await prisma.diet.findFirst({ where: { id: params.id, userId: user.id } });
  if (!diet) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { phaseId, name, emoji, durationDays, tipsMd, ingredientIds } = body as Record<string, unknown>;

  if (typeof phaseId !== 'string' || !phaseId) {
    return NextResponse.json({ error: 'phaseId es obligatorio.' }, { status: 400 });
  }
  const phase = await prisma.phase.findFirst({ where: { id: phaseId, dietId: params.id } });
  if (!phase) return NextResponse.json({ error: 'Fase no encontrada en esta dieta.' }, { status: 404 });

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 });
  }

  const maxSort = await prisma.reintroBlock.aggregate({
    where: { phaseId },
    _max: { sort: true },
  });
  const nextSort = (maxSort._max.sort ?? 0) + 1;

  const ids = Array.isArray(ingredientIds) ? ingredientIds.filter((x): x is number => typeof x === 'number') : [];

  const block = await prisma.reintroBlock.create({
    data: {
      phaseId,
      sort: nextSort,
      name: name.trim(),
      emoji: typeof emoji === 'string' && emoji.trim() ? emoji.trim() : null,
      durationDays: typeof durationDays === 'number' && durationDays > 0 ? Math.round(durationDays) : 4,
      tipsMd: typeof tipsMd === 'string' && tipsMd.trim() ? tipsMd.trim() : null,
      status: 'pendiente',
      ingredients: { create: ids.map((ingredientId) => ({ ingredientId })) },
    },
    include: { ingredients: true },
  });

  return NextResponse.json(block, { status: 201 });
}
