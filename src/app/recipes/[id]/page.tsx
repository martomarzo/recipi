import { notFound } from 'next/navigation';
import Link from 'next/link';
import StepList from '@/components/StepList';
import StarRating from '@/components/StarRating';
import type { RecipeWithDetails } from '@/types/recipe';
import DeleteButton from './DeleteButton';

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

export default async function RecipePage({ params }: { params: { id: string } }) {
  const recipe = await getRecipe(params.id);
  if (!recipe) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="text-sm text-amber-600 hover:underline mb-2 inline-block">
            ← All recipes
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{recipe.name}</h1>
          {recipe.description && (
            <p className="mt-2 text-gray-500">{recipe.description}</p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
          <DeleteButton recipeId={recipe.id} />
        </div>
      </div>

      {/* Image */}
      {recipe.imageUrl && (
        <div className="mb-6 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={recipe.imageUrl} alt={recipe.name} className="w-full h-64 object-cover" />
        </div>
      )}

      {/* Rating */}
      <div className="mb-8 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
        <StarRating
          recipeId={recipe.id}
          avgRating={recipe.avgRating}
          ratingCount={recipe.ratingCount}
        />
      </div>

      {/* Ingredients */}
      {recipe.ingredients.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Ingredients</h2>
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm divide-y divide-gray-50">
            {recipe.ingredients.map((ing) => (
              <div key={ing.id} className="flex items-center gap-3 px-4 py-3">
                <span className="text-sm font-medium text-amber-700 w-24 shrink-0">
                  {[ing.quantity, ing.unit].filter(Boolean).join(' ') || '—'}
                </span>
                <span className="text-gray-800">{ing.name}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Steps */}
      {recipe.steps.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold text-gray-900">Instructions</h2>
          <StepList steps={recipe.steps} />
        </section>
      )}
    </div>
  );
}
