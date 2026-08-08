import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { visibleDietsWhere } from '@/lib/dietAccess';
import { findChromiumExecutable, renderUrlToPdf, ChromiumNotFoundError } from '@/lib/pdf';

const NO_CHROMIUM_MESSAGE = 'Export a PDF no disponible en este servidor — usá Imprimir';

// GET: renderiza /dietas/:id/resumen a PDF server-side (§6 SPECS.md) y lo
// devuelve como descarga. Requiere sesión + acceso a la dieta (dueño o share,
// incluso viewer: el PDF es lectura); el render reenvía la cookie del caller.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const diet = await prisma.diet.findFirst({
    where: { id: params.id, ...visibleDietsWhere(user.id) },
    select: { id: true },
  });
  if (!diet) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // Chequeo temprano: evita levantar el browser si no hay Chromium instalado
  // en el host (p. ej. imagen Docker sin el paquete).
  if (!findChromiumExecutable()) {
    return NextResponse.json({ error: NO_CHROMIUM_MESSAGE }, { status: 501 });
  }

  const port = process.env.PORT ?? '3000';
  const url = `http://127.0.0.1:${port}/dietas/${params.id}/resumen`;
  const cookieHeader = req.headers.get('cookie');

  try {
    const pdf = await renderUrlToPdf(url, cookieHeader);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="recipi-resumen.pdf"',
        'Content-Length': String(pdf.length),
      },
    });
  } catch (err) {
    if (err instanceof ChromiumNotFoundError) {
      return NextResponse.json({ error: NO_CHROMIUM_MESSAGE }, { status: 501 });
    }
    console.error('Error generando PDF de resumen:', err);
    return NextResponse.json({ error: 'No se pudo generar el PDF.' }, { status: 500 });
  }
}
