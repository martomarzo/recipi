import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { editableDietsWhere } from '@/lib/dietAccess';

// PATCH: editar nombre/duración de una fase (usado desde el editor de fases y
// bloques). Dueño o editor (share).
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; phaseId: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const phase = await prisma.phase.findFirst({
    where: { id: params.phaseId, dietId: params.id, diet: editableDietsWhere(user.id) },
  });
  if (!phase) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }
  const { name, durationDays, description, dailyRulesMd } = body as Record<string, unknown>;

  const data: Record<string, unknown> = {};
  if (typeof name === 'string' && name.trim()) data.name = name.trim();
  if (durationDays === null || typeof durationDays === 'number') {
    data.durationDays = durationDays === null ? null : Math.max(1, Math.round(durationDays));
  }
  if (description === null || typeof description === 'string') data.description = description;
  if (dailyRulesMd === null || typeof dailyRulesMd === 'string') data.dailyRulesMd = dailyRulesMd;

  const updated = await prisma.phase.update({ where: { id: phase.id }, data });
  return NextResponse.json(updated);
}
