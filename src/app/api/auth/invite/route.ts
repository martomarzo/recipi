import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const token = randomBytes(24).toString("hex");
  await prisma.invitation.create({
    data: {
      token,
      createdBy: user.id,
      expiresAt: new Date(Date.now() + 7 * 86400000),
    },
  });

  const origin = request.nextUrl.origin;
  return NextResponse.json({ ok: true, url: `${origin}/registro?token=${token}` });
}
