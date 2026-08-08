import { notFound } from 'next/navigation';
import RecipeForm from '@/components/RecipeForm';
import type { RecipeWithDetails } from '@/types/recipe';

async function getRecipe(id: string): Promise<RecipeWithDetails | null> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/recipes/${id}`, { cache: 'no-store' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  } catch {
    return null;
  }
}

export default async function EditRecipePage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  if (!recipe) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Edit Recipe</h1>
      <RecipeForm
        initialData={{
          id: recipe.id,
          name: recipe.name,
          description: recipe.description,
          rawText: recipe.rawText,
          imageUrl: recipe.imageUrl,
          ingredients: recipe.ingredients,
          steps: recipe.steps,
        }}
      />
    </div>
  );
}
