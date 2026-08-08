export const MEAL_TYPES = ["desayuno", "comida", "cena", "snack"] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  comida: "Comida",
  cena: "Cena",
  snack: "Snack",
};

export function isMealType(v: unknown): v is MealType {
  return typeof v === "string" && (MEAL_TYPES as readonly string[]).includes(v);
}
