import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { editableDietsWhere } from '@/lib/dietAccess';
import EditorClient from '@/components/dietas/EditorClient';

// Editor: dueño o editor (share). Un viewer recibe 404, igual que una ajena.
export default async function EditarDietaPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const diet = await prisma.diet.findFirst({
    where: { id: params.id, ...editableDietsWhere(user.id) },
    include: {
      phases: {
        orderBy: { sort: 'asc' },
        include: {
          blocks: { orderBy: { sort: 'asc' }, include: { ingredients: true } },
        },
      },
    },
  });
  if (!diet) notFound();

  const dietSerializada = JSON.parse(JSON.stringify(diet));
  const esDueno = diet.userId === user.id;

  // Datos para la sección "Compartir" (solo el dueño la ve).
  const usuarios = esDueno
    ? await prisma.user.findMany({
        where: { id: { not: user.id } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true },
      })
    : [];
  const shares = esDueno
    ? await prisma.dietShare.findMany({
        where: { dietId: diet.id },
        select: { userId: true, role: true },
      })
    : [];

  return (
    <EditorClient
      dietInicial={dietSerializada}
      esDueno={esDueno}
      usuarios={usuarios}
      sharesIniciales={shares.map((s) => ({
        userId: s.userId,
        role: s.role === 'editor' ? ('editor' as const) : ('viewer' as const),
      }))}
    />
  );
}
