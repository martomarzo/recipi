import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword } from "@/lib/auth";

// POST: alta directa de un usuario desde la plataforma (§7: sin roles, todos
// iguales — cualquier usuario logueado puede crear otro, igual que podría
// generar una invitación). No inicia sesión como el usuario nuevo.
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { name, email, password } = await request.json().catch(() => ({}));
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nombre, email y contraseña son obligatorios." }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  const cleanEmail = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email." }, { status: 409 });
  }

  const created = await prisma.user.create({
    data: { name: String(name).trim(), email: cleanEmail, passwordHash: await hashPassword(String(password)) },
    select: { id: true },
  });
  return NextResponse.json({ id: created.id }, { status: 201 });
}
