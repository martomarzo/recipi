'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';
import type { ParsedIngredient, ParsedStep } from '@/types/recipe';

interface RecipeFormProps {
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    rawText: string;
    imageUrl: string | null;
    ingredients: { quantity: string | null; unit: string | null; name: string }[];
    steps: { text: string }[];
  };
}

export default function RecipeForm({ initialData }: RecipeFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [rawText, setRawText] = useState(initialData?.rawText ?? '');
  const [name, setName] = useState(initialData?.name ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initialData?.imageUrl ?? '');
  const [ingredients, setIngredients] = useState<ParsedIngredient[]>(
    initialData?.ingredients ?? []
  );
  const [steps, setSteps] = useState<ParsedStep[]>(
    (initialData?.steps ?? []).map((s, i) => ({ position: i + 1, text: s.text }))
  );
  const [parsing, setParsing] = useState(false);
  const [aiParsed, setAiParsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPasteArea, setShowPasteArea] = useState(!isEdit);
  const [error, setError] = useState('');

  async function handleParse() {
    if (!rawText.trim()) return;
    setParsing(true);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText }),
      });
      const data = await res.json();
      setName(data.name || '');
      setDescription(data.description || '');
      setIngredients(data.ingredients || []);
      setSteps(data.steps || []);
      setAiParsed(!!data.aiParsed);
      setShowPasteArea(false);
    } catch {
      setError('Failed to parse recipe. Please try again.');
    } finally {
      setParsing(false);
    }
  }

  function updateIngredient(index: number, field: keyof ParsedIngredient, value: string) {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? { ...ing, [field]: value } : ing)));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, { quantity: '', unit: '', name: '' }]);
  }

  function removeIngredient(index: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  function updateStep(index: number, text: string) {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, text } : step))
    );
  }

  function addStep() {
    setSteps((prev) => [...prev, { position: prev.length + 1, text: '' }]);
  }

  function removeStep(index: number) {
    setSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, position: i + 1 }))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Recipe name is required.'); return; }
    if (steps.length === 0) { setError('Add at least one step.'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = { name, description, rawText, imageUrl: imageUrl || null, ingredients, steps };
      const url = isEdit ? `/api/recipes/${initialData!.id}` : '/api/recipes';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Save failed');

      if (isEdit) {
        router.push(`/recipes/${initialData!.id}`);
      } else {
        const data = await res.json();
        router.push(`/recipes/${data.id}`);
      }
      router.refresh();
    } catch {
      setError('Failed to save recipe. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Paste area */}
      {showPasteArea ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Paste Recipe Text</h2>
          <p className="mb-3 text-sm text-gray-500">
            Paste any recipe text — we&apos;ll parse it into structured fields automatically.
          </p>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={`Chocolate Chip Cookies\n\nIngredients:\n2 cups flour\n1 tsp salt\n...\n\nInstructions:\n1. Preheat oven to 375°F for 10 minutes.\n2. Mix dry ingredients...`}
            className="h-64 w-full rounded-lg border border-gray-200 p-3 font-mono text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleParse}
              disabled={!rawText.trim() || parsing}
              className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
            >
              {parsing ? 'Parsing...' : 'Parse Recipe'}
            </button>
            {aiParsed && (
              <span className="flex items-center gap-1 text-xs text-violet-600 font-medium">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Parsed with Claude AI
              </span>
            )}
            {isEdit && (
              <button
                type="button"
                onClick={() => setShowPasteArea(false)}
                className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowPasteArea(true)}
            className="text-sm text-amber-600 hover:underline"
          >
            Re-parse from text
          </button>
        </div>
      )}

      {/* Photo */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">Photo</h2>
        <ImageUpload currentUrl={imageUrl || null} onUploaded={setImageUrl} />
      </div>

      {/* Basic info */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="Recipe name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            placeholder="A short description..."
          />
        </div>
      </div>

      {/* Ingredients */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Ingredients</h2>
          <button
            type="button"
            onClick={addIngredient}
            className="text-sm text-amber-600 hover:underline"
          >
            + Add ingredient
          </button>
        </div>
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                value={ing.quantity ?? ''}
                onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                placeholder="Qty"
                className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
              <input
                type="text"
                value={ing.unit ?? ''}
                onChange={(e) => updateIngredient(i, 'unit', e.target.value)}
                placeholder="Unit"
                className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                placeholder="Ingredient"
                className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-amber-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeIngredient(i)}
                className="mt-1 text-gray-300 hover:text-red-400 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
          {ingredients.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No ingredients yet</p>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Steps</h2>
          <button
            type="button"
            onClick={addStep}
            className="text-sm text-amber-600 hover:underline"
          >
            + Add step
          </button>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 mt-2">
                {i + 1}
              </span>
              <textarea
                value={step.text}
                onChange={(e) => updateStep(i, e.target.value)}
                rows={2}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="Describe this step..."
              />
              <button
                type="button"
                onClick={() => removeStep(i)}
                className="mt-2 text-gray-300 hover:text-red-400 transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
          {steps.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">No steps yet</p>
          )}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-amber-600 px-6 py-2.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Recipe'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-gray-200 px-6 py-2.5 font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
