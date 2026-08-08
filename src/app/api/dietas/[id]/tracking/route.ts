import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

// GET: notas recientes de seguimiento de la dieta.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const diet = await prisma.diet.findFirst({ where: { id: params.id, userId: user.id } });
  if (!diet) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

  const entries = await prisma.trackingEntry.findMany({
    where: { dietId: params.id },
    orderBy: { date: 'desc' },
    take: limit,
  });
  return NextResponse.json(entries);
}

// POST: nota rápida del día.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const diet = await prisma.diet.findFirst({ where: { id: params.id, userId: user.id } });
  if (!diet) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { date, noteMd } = body as Record<string, unknown>;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Fecha inválida (YYYY-MM-DD).' }, { status: 400 });
  }
  if (typeof noteMd !== 'string' || !noteMd.trim()) {
    return NextResponse.json({ error: 'La nota no puede estar vacía.' }, { status: 400 });
  }

  const entry = await prisma.trackingEntry.create({
    data: { dietId: params.id, date: new Date(`${date}T00:00:00.000Z`), noteMd: noteMd.trim() },
  });
  return NextResponse.json(entry, { status: 201 });
}
