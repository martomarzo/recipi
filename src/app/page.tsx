import Link from 'next/link';
import RecipeCard from '@/components/RecipeCard';
import type { RecipeListItem } from '@/types/recipe';

async function getRecipes(): Promise<RecipeListItem[]> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  try {
    const res = await fetch(`${baseUrl}/api/recipes`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const recipes = await getRecipes();

  return (
    <div>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Recipes</h1>
          <p className="mt-1 text-gray-500">
            {recipes.length === 0
              ? 'No recipes yet — add your first one!'
              : `${recipes.length} recipe${recipes.length === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>

      {recipes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center">
          <div className="text-6xl mb-4">🍳</div>
          <h2 className="text-xl font-semibold text-gray-700">Start your recipe collection</h2>
          <p className="mt-2 text-gray-400 max-w-sm">
            Paste any recipe text and we&apos;ll parse it into structured ingredients and steps with
            interactive timers.
          </p>
          <Link
            href="/recipes/new"
            className="mt-6 rounded-lg bg-amber-600 px-6 py-2.5 font-medium text-white hover:bg-amber-700 transition-colors"
          >
            Add your first recipe
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  );
}
