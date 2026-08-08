'use client';

import { useState } from 'react';
import { createIngredient, IngredientCategoryLite, IngredientLite } from '@/lib/recetas/ingredientsClient';

export default function NuevoIngredienteForm({
  categories,
  initialName = '',
  onCreated,
  onCancel,
}: {
  categories: IngredientCategoryLite[];
  initialName?: string;
  onCreated: (ing: IngredientLite) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    name: initialName,
    categoryId: '',
    kcal100: '',
    protein100: '',
    carbs100: '',
    fat100: '',
    emoji: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    const kcal100 = Number(form.kcal100);
    const protein100 = Number(form.protein100);
    const carbs100 = Number(form.carbs100);
    const fat100 = Number(form.fat100);
    const categoryId = Number(form.categoryId);
    if (!form.name.trim() || !categoryId) {
      setError('Nombre y categoría son obligatorios.');
      return;
    }
    if ([kcal100, protein100, carbs100, fat100].some((v) => Number.isNaN(v) || v < 0)) {
      setError('Los valores nutricionales deben ser números ≥ 0.');
      return;
    }
    setBusy(true);
    try {
      const created = await createIngredient({
        name: form.name.trim(),
        categoryId,
        kcal100,
        protein100,
        carbs100,
        fat100,
        emoji: form.emoji.trim() || undefined,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el ingrediente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-2 p-4">
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Nombre"
          value={form.name}
          onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
          className="input col-span-2"
        />
        <select
          value={form.categoryId}
          onChange={(e) => setForm((v) => ({ ...v, categoryId: e.target.value }))}
          className="input col-span-2"
        >
          <option value="">Categoría…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
        <input
          placeholder="Emoji (opcional)"
          value={form.emoji}
          onChange={(e) => setForm((v) => ({ ...v, emoji: e.target.value }))}
          className="input col-span-2"
        />
        <input
          placeholder="kcal /100g"
          type="number"
          value={form.kcal100}
          onChange={(e) => setForm((v) => ({ ...v, kcal100: e.target.value }))}
          className="input"
        />
        <input
          placeholder="Proteína /100g"
          type="number"
          value={form.protein100}
          onChange={(e) => setForm((v) => ({ ...v, protein100: e.target.value }))}
          className="input"
        />
        <input
          placeholder="Hidratos /100g"
          type="number"
          value={form.carbs100}
          onChange={(e) => setForm((v) => ({ ...v, carbs100: e.target.value }))}
          className="input"
        />
        <input
          placeholder="Grasas /100g"
          type="number"
          value={form.fat100}
          onChange={(e) => setForm((v) => ({ ...v, fat100: e.target.value }))}
          className="input"
        />
      </div>
      {error && <p className="text-sm text-mal">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} disabled={busy} className="btn-primario disabled:opacity-50">
          Crear y usar
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn">
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
