import { redirect, notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import EditorClient from '@/components/dietas/EditorClient';

export default async function EditarDietaPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const diet = await prisma.diet.findFirst({
    where: { id: params.id, userId: user.id },
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

  return <EditorClient dietInicial={dietSerializada} />;
}
