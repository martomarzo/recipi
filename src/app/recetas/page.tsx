import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadActiveDiet } from "@/lib/planData";
import { DISH_INCLUDE, toDishDTO } from "@/lib/recetas/dishQuery";
import RecetasGrid from "@/components/recetas/RecetasGrid";

export default async function RecetasPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [dishes, activeDiet] = await Promise.all([
    prisma.dish.findMany({
      where: { archivedAt: null, OR: [{ userId: user.id }, { userId: null }] },
      include: DISH_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    loadActiveDiet(user.id),
  ]);

  const dtos = dishes.map((d) => toDishDTO(d, user.id, activeDiet));

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Recetas</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-tinta-suave">
          Catálogo de platos con macros aproximados por porción. Elegí ingredientes con gramos y la app suma todo.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Link href="/recetas/nueva" className="btn-primario">
            + Nueva receta
          </Link>
          <Link href="/recetas/importar" className="btn">
            Importar por link
          </Link>
        </div>
      </div>

      <RecetasGrid dishes={dtos} hasActiveDiet={activeDiet != null} />
    </div>
  );
}
