import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { editableDietsWhere } from '@/lib/dietAccess';
import { loadDiet } from '@/lib/planData';

// GET: plan completo calculado (dieta + timeline + disponibilidad base), serializado.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const loaded = await loadDiet(params.id, user.id);
  if (!loaded) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  return NextResponse.json({
    diet: loaded.diet,
    role: loaded.role,
    plan: loaded.plan,
    baseIds: Array.from(loaded.baseIds),
    reintroIds: Array.from(loaded.reintroIds),
  });
}

// PATCH: editar nombre/descripción/fecha de inicio/activa/archivar.
// Dueño o editor (share); activar/archivar queda solo en el dueño porque
// cambia estado global de la dieta (isActive además es por-usuario del dueño).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const existing = await prisma.diet.findFirst({
    where: { id: params.id, ...editableDietsWhere(user.id) },
  });
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { name, description, startDate, isActive, archive } = body as Record<string, unknown>;

  if ((isActive !== undefined || archive !== undefined) && existing.userId !== user.id) {
    return NextResponse.json(
      { error: 'Solo el dueño puede activar o archivar la dieta.' },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) data.name = name.trim();
  if (description === null || typeof description === 'string') data.description = description;
  if (typeof startDate === 'string') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return NextResponse.json({ error: 'Fecha de inicio inválida (YYYY-MM-DD).' }, { status: 400 });
    }
    data.startDate = new Date(`${startDate}T00:00:00.000Z`);
  }
  if (archive === true) data.archivedAt = new Date();
  if (archive === false) data.archivedAt = null;

  await prisma.$transaction(async (tx) => {
    if (isActive === true) {
      await tx.diet.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false } });
      data.isActive = true;
    } else if (isActive === false) {
      data.isActive = false;
    }
    await tx.diet.update({ where: { id: params.id }, data });
  });

  const updated = await prisma.diet.findUnique({ where: { id: params.id } });
  return NextResponse.json(updated);
}

// DELETE: archivar (soft-delete).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const existing = await prisma.diet.findFirst({ where: { id: params.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  await prisma.diet.update({ where: { id: params.id }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
