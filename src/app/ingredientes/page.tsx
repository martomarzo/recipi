import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import IngredientesClient from '@/components/ingredientes/IngredientesClient';

export default async function IngredientesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const [categorias, ingredientes] = await Promise.all([
    prisma.ingredientCategory.findMany({ orderBy: { sort: 'asc' } }),
    prisma.ingredient.findMany({
      where: { archivedAt: null },
      include: { category: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Serializamos explícitamente (Date -> string) para cruzar el límite server/client sin ambigüedad.
  const categoriasSerializadas = JSON.parse(JSON.stringify(categorias));
  const ingredientesSerializados = JSON.parse(JSON.stringify(ingredientes));

  return (
    <IngredientesClient
      categoriasIniciales={categoriasSerializadas}
      ingredientesIniciales={ingredientesSerializados}
    />
  );
}
