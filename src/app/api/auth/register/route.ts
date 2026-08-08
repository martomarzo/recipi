import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword, registrationOpen } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { name, email, password, inviteToken } = await request.json().catch(() => ({}));
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Nombre, email y contraseña son obligatorios." }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }

  let invitation = null;
  if (!registrationOpen()) {
    invitation = inviteToken
      ? await prisma.invitation.findUnique({ where: { token: String(inviteToken) } })
      : null;
    if (!invitation || invitation.usedAt || invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "El registro es solo por invitación. Pedile un link a un usuario existente." },
        { status: 403 }
      );
    }
  }

  const cleanEmail = String(email).toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    return NextResponse.json({ error: "Ya existe un usuario con ese email." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { name: String(name).trim(), email: cleanEmail, passwordHash: await hashPassword(password) },
  });
  if (invitation) {
    await prisma.invitation.update({ where: { id: invitation.id }, data: { usedAt: new Date() } });
  }

  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
