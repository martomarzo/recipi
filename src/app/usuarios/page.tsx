import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import UsuariosClient from '@/components/usuarios/UsuariosClient';

export default async function UsuariosPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const usuarios = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { diets: true } },
    },
  });

  // Serializamos explícitamente (Date -> string) para cruzar el límite server/client sin ambigüedad.
  return (
    <UsuariosClient
      usuariosIniciales={JSON.parse(JSON.stringify(usuarios))}
      currentUserId={user.id}
    />
  );
}
