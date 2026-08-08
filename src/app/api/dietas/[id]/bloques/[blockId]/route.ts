import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { requeueSorts } from '@/lib/plan';

async function ownedBlock(dietId: string, blockId: string, userId: string) {
  const block = await prisma.reintroBlock.findFirst({
    where: { id: blockId, phase: { dietId, diet: { userId } } },
    include: { phase: true },
  });
  return block;
}

// PATCH: estado/nota/reencolar/orden/edición de un bloque de reintroducción.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; blockId: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const block = await ownedBlock(params.id, params.blockId, user.id);
  if (!block) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const {
    status, statusNote, requeue, name, emoji, durationDays, tipsMd, sortDirection, ingredientIds,
  } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof status === 'string') data.status = status;
  if (statusNote === null || typeof statusNote === 'string') data.statusNote = statusNote;
  if (typeof name === 'string' && name.trim()) data.name = name.trim();
  if (emoji === null || typeof emoji === 'string') data.emoji = emoji;
  if (typeof durationDays === 'number' && durationDays > 0) data.durationDays = Math.round(durationDays);
  if (tipsMd === null || typeof tipsMd === 'string') data.tipsMd = tipsMd;

  await prisma.$transaction(async (tx) => {
    if (Array.isArray(ingredientIds)) {
      const ids = ingredientIds.filter((x): x is number => typeof x === 'number');
      await tx.reintroBlockIngredient.deleteMany({ where: { blockId: block.id } });
      if (ids.length) {
        await tx.reintroBlockIngredient.createMany({
          data: ids.map((ingredientId) => ({ blockId: block.id, ingredientId })),
        });
      }
    }

    if (sortDirection === 'up' || sortDirection === 'down') {
      const siblings = await tx.reintroBlock.findMany({
        where: { phaseId: block.phaseId },
        orderBy: { sort: 'asc' },
      });
      const idx = siblings.findIndex((b) => b.id === block.id);
      const swapIdx = sortDirection === 'up' ? idx - 1 : idx + 1;
      if (idx !== -1 && swapIdx >= 0 && swapIdx < siblings.length) {
        const other = siblings[swapIdx];
        await tx.reintroBlock.update({ where: { id: block.id }, data: { sort: other.sort } });
        await tx.reintroBlock.update({ where: { id: other.id }, data: { sort: block.sort } });
      }
    }

    if (requeue === true) {
      const siblings = await tx.reintroBlock.findMany({
        where: { phaseId: block.phaseId },
        select: { id: true, sort: true },
      });
      const reordered = requeueSorts(siblings, block.id);
      for (const r of reordered) {
        await tx.reintroBlock.update({ where: { id: r.id }, data: { sort: r.sort } });
      }
      // Reencolar = reintentar más adelante: vuelve a "pendiente" para un intento futuro,
      // conservando la nota como historial de por qué se pospuso.
      data.status = 'pendiente';
    }

    if (Object.keys(data).length) {
      await tx.reintroBlock.update({ where: { id: block.id }, data });
    }
  });

  const updated = await prisma.reintroBlock.findUnique({
    where: { id: block.id },
    include: { ingredients: true },
  });
  return NextResponse.json(updated);
}

// DELETE: quita un bloque de reintroducción de la dieta.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; blockId: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const block = await ownedBlock(params.id, params.blockId, user.id);
  if (!block) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  await prisma.reintroBlock.delete({ where: { id: block.id } });
  return NextResponse.json({ ok: true });
}
