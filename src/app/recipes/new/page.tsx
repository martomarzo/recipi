import RecipeForm from '@/components/RecipeForm';

export default function NewRecipePage() {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Add New Recipe</h1>
      <RecipeForm />
    </div>
  );
}
