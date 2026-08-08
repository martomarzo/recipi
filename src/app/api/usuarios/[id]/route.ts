import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getSessionToken, hashPassword } from "@/lib/auth";

// PATCH: edita nombre/email/contraseña de un usuario (§7: sin roles — cualquier
// usuario logueado puede editar a cualquiera, igual que puede crearlos).
// Si cambia la contraseña se cierran las sesiones de ese usuario, conservando
// la sesión actual cuando uno se edita a sí mismo.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  const { name, email, password } = await request.json().catch(() => ({}));
  const data: { name?: string; email?: string; passwordHash?: string } = {};

  if (name !== undefined) {
    const cleanName = String(name).trim();
    if (!cleanName) return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
    data.name = cleanName;
  }

  if (email !== undefined) {
    const cleanEmail = String(email).toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      return NextResponse.json({ error: "Email inválido." }, { status: 400 });
    }
    if (cleanEmail !== target.email) {
      const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
      if (existing) return NextResponse.json({ error: "Ya existe un usuario con ese email." }, { status: 409 });
    }
    data.email = cleanEmail;
  }

  // Contraseña vacía = no cambiarla (el form la manda opcional).
  if (password !== undefined && String(password) !== "") {
    if (String(password).length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }
    data.passwordHash = await hashPassword(String(password));
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nada para actualizar." }, { status: 400 });
  }

  await prisma.user.update({ where: { id: params.id }, data });

  if (data.passwordHash) {
    const current = getSessionToken();
    await prisma.session.deleteMany({
      where: {
        userId: target.id,
        ...(target.id === user.id && current ? { NOT: { id: current } } : {}),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

// DELETE: elimina un usuario. Sus dietas (con fases/bloques/shares/tracking)
// se borran en cascada; sus recetas quedan en el catálogo global (userId null).
// No permite borrarse a uno mismo — así siempre queda al menos un usuario con
// acceso (el registro es por invitación).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (params.id === user.id) {
    return NextResponse.json({ error: "No podés eliminar tu propio usuario." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id } });
  if (!target) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });

  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
