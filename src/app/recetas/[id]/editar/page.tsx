import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { findVisibleDish, toDishDTO } from "@/lib/recetas/dishQuery";
import { splitSteps } from "@/lib/recetas/steps";
import RecetaForm from "@/components/recetas/RecetaForm";

export default async function EditarRecetaPage({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const dish = await findVisibleDish(params.id, user.id);
  if (!dish) notFound();

  const dto = toDishDTO(dish, user.id, null);
  if (!dto.isOwner) redirect(`/recetas/${params.id}`);

  return (
    <RecetaForm
      mode="editar"
      dishId={dto.id}
      initial={{
        name: dto.name,
        description: dto.description ?? "",
        mealType: dto.mealType,
        steps: splitSteps(dto.recipeMd),
        ingredients: dto.ingredients.map((i) => ({
          id: i.ingredientId,
          name: i.name,
          emoji: i.emoji,
          categoryId: i.categoryId,
          kcal100: i.kcal100,
          protein100: i.protein100,
          carbs100: i.carbs100,
          fat100: i.fat100,
          fiber100: i.fiber100,
          grams: i.grams,
        })),
        suggestions: dto.suggestions.map((s) => ({
          key: s.id,
          dietId: s.dietId ?? "",
          dietName: s.dietName ?? "",
          phaseId: s.phaseId,
          phaseName: s.phaseName,
          blockId: s.blockId,
          blockName: s.blockName,
          weekNumber: s.weekNumber,
          label: s.label,
        })),
        sourceUrl: dto.sourceUrl,
        rawText: dto.rawText,
        parsedJson: dto.parsedJson,
      }}
    />
  );
}
