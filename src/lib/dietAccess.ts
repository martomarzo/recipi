import { prisma } from "./prisma";

// Acceso a dietas con shares (DietShare): el dueño puede todo; un share da
// rol "editor" (todo menos borrar/compartir) o "viewer" (solo lectura).
// Sin acceso => tratar como inexistente (404), igual que antes de los shares.

export type DietRole = "owner" | "editor" | "viewer";

const LEVEL: Record<DietRole, number> = { viewer: 1, editor: 2, owner: 3 };

/** Rol del usuario sobre la dieta, o null si no existe / no tiene acceso. */
export async function getDietRole(dietId: string, userId: string): Promise<DietRole | null> {
  const diet = await prisma.diet.findUnique({
    where: { id: dietId },
    select: { userId: true, shares: { where: { userId }, select: { role: true } } },
  });
  if (!diet) return null;
  if (diet.userId === userId) return "owner";
  const role = diet.shares[0]?.role;
  return role === "editor" || role === "viewer" ? role : null;
}

export function roleAtLeast(role: DietRole | null, min: DietRole): boolean {
  return role != null && LEVEL[role] >= LEVEL[min];
}

/** Rol si alcanza el mínimo pedido; null si no (responder 404). */
export async function requireDietRole(
  dietId: string,
  userId: string,
  min: DietRole
): Promise<DietRole | null> {
  const role = await getDietRole(dietId, userId);
  return roleAtLeast(role, min) ? role : null;
}

/** Filtro Prisma para listar dietas visibles (propias o compartidas conmigo). */
export function visibleDietsWhere(userId: string) {
  return { OR: [{ userId }, { shares: { some: { userId } } }] };
}

/** Filtro Prisma para escrituras: dueño o share con rol editor. Un viewer
 *  queda fuera y recibe el mismo 404 que una dieta ajena. */
export function editableDietsWhere(userId: string) {
  return { OR: [{ userId }, { shares: { some: { userId, role: "editor" } } }] };
}
