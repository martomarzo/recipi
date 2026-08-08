// Cálculo nutricional derivado: nunca se persiste.
// Valores por 100 g × gramos / 100, redondeados. Etiquetar "aprox." en la UI.

export interface NutriPer100 {
  kcal100: number;
  protein100: number;
  carbs100: number;
  fat100: number;
  fiber100?: number | null;
}

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function macrosOf(items: Array<{ grams: number; ingredient: NutriPer100 }>): Macros {
  let kcal = 0, protein = 0, carbs = 0, fat = 0;
  for (const { grams, ingredient } of items) {
    const f = grams / 100;
    kcal += ingredient.kcal100 * f;
    protein += ingredient.protein100 * f;
    carbs += ingredient.carbs100 * f;
    fat += ingredient.fat100 * f;
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
  };
}
