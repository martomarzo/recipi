import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { requireDietRole } from "@/lib/dietAccess";

// Gestión de shares de una dieta — solo el dueño. PUT es reemplazo completo
// (misma semántica que PATCH /api/recetas/[id]): manda la lista final de
// { userId, role } y se borra lo que no esté.

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const role = await requireDietRole(params.id, user.id, "owner");
  if (role !== "owner") return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const shares = await prisma.dietShare.findMany({
    where: { dietId: params.id },
    select: { userId: true, role: true, user: { select: { name: true, email: true } } },
  });
  return NextResponse.json(shares);
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const role = await requireDietRole(params.id, user.id, "owner");
  if (role !== "owner") return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const entries = Array.isArray(body?.shares) ? body.shares : null;
  if (!entries) {
    return NextResponse.json({ error: "Formato inválido: se espera { shares: [{ userId, role }] }." }, { status: 400 });
  }

  const clean: { userId: string; role: string }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const userId = String(e?.userId ?? "");
    const shareRole = String(e?.role ?? "");
    if (!userId || seen.has(userId)) continue;
    if (userId === user.id) {
      return NextResponse.json({ error: "No podés compartir una dieta con vos misma." }, { status: 400 });
    }
    if (shareRole !== "viewer" && shareRole !== "editor") {
      return NextResponse.json({ error: "Rol inválido: usar viewer o editor." }, { status: 400 });
    }
    seen.add(userId);
    clean.push({ userId, role: shareRole });
  }

  if (clean.length > 0) {
    const existing = await prisma.user.count({ where: { id: { in: clean.map((e) => e.userId) } } });
    if (existing !== clean.length) {
      return NextResponse.json({ error: "Algún usuario no existe." }, { status: 400 });
    }
  }

  await prisma.$transaction([
    prisma.dietShare.deleteMany({ where: { dietId: params.id } }),
    prisma.dietShare.createMany({
      data: clean.map((e) => ({ dietId: params.id, userId: e.userId, role: e.role })),
    }),
  ]);

  return NextResponse.json({ ok: true });
}
