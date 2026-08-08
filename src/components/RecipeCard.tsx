import Link from 'next/link';
import type { RecipeListItem } from '@/types/recipe';

interface RecipeCardProps {
  recipe: RecipeListItem;
}

export default function RecipeCard({ recipe }: RecipeCardProps) {
  const stars = recipe.avgRating ?? 0;

  return (
    <Link href={`/recipes/${recipe.id}`} className="group block">
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
        <div className="relative h-44 bg-amber-50">
          {recipe.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-amber-200">
              <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm0 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
              </svg>
            </div>
          )}
        </div>
        <div className="p-4">
          <h2 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-amber-700 transition-colors">
            {recipe.name}
          </h2>
          {recipe.description && (
            <p className="mt-1 text-sm text-gray-500 line-clamp-2">{recipe.description}</p>
          )}
          <div className="mt-2 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <span key={s} className={`text-sm ${s <= Math.round(stars) ? 'text-amber-400' : 'text-gray-200'}`}>
                ★
              </span>
            ))}
            {recipe.ratingCount > 0 && (
              <span className="ml-1 text-xs text-gray-400">
                {stars.toFixed(1)} ({recipe.ratingCount})
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
