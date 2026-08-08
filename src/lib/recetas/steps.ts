// Dish.recipeMd es texto libre (markdown simple); cada línea no vacía es un
// paso. Se comparte entre el detalle (mostrar) y el constructor (editar).

export function splitSteps(recipeMd: string | null | undefined): string[] {
  if (!recipeMd) return [];
  return recipeMd
    .split("\n")
    .map((l) => l.replace(/^(\d+[.):]|[-•*])\s*/, "").trim())
    .filter(Boolean);
}

export function joinSteps(steps: string[]): string {
  return steps
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${s}`)
    .join("\n");
}
