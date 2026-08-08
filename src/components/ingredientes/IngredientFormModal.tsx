'use client';

import { useEffect, useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import type { Categoria, Ingrediente } from './types';

interface IngredientFormModalProps {
  open: boolean;
  categorias: Categoria[];
  ingrediente: Ingrediente | null; // null = alta, definido = edición
  onClose: () => void;
  onSaved: (ingrediente: Ingrediente) => void;
}

type FormState = {
  name: string;
  categoryId: string;
  kcal100: string;
  protein100: string;
  carbs100: string;
  fat100: string;
  fiber100: string;
  notes: string;
  emoji: string;
  imagePath: string;
};

function emptyForm(categorias: Categoria[]): FormState {
  return {
    name: '',
    categoryId: categorias[0] ? String(categorias[0].id) : '',
    kcal100: '',
    protein100: '',
    carbs100: '',
    fat100: '',
    fiber100: '',
    notes: '',
    emoji: '',
    imagePath: '',
  };
}

function formFromIngrediente(ing: Ingrediente): FormState {
  return {
    name: ing.name,
    categoryId: String(ing.categoryId),
    kcal100: String(ing.kcal100),
    protein100: String(ing.protein100),
    carbs100: String(ing.carbs100),
    fat100: String(ing.fat100),
    fiber100: ing.fiber100 === null ? '' : String(ing.fiber100),
    notes: ing.notes || '',
    emoji: ing.emoji || '',
    imagePath: ing.imagePath || '',
  };
}

export default function IngredientFormModal({
  open,
  categorias,
  ingrediente,
  onClose,
  onSaved,
}: IngredientFormModalProps) {
  const [form, setForm] = useState<FormState>(() =>
    ingrediente ? formFromIngrediente(ingrediente) : emptyForm(categorias)
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(ingrediente ? formFromIngrediente(ingrediente) : emptyForm(categorias));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ingrediente]);

  if (!open) return null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }
    if (!form.categoryId) {
      setError('Elegí una categoría.');
      return;
    }
    const kcal = Number(form.kcal100);
    const protein = Number(form.protein100);
    const carbs = Number(form.carbs100);
    const fat = Number(form.fat100);
    if ([kcal, protein, carbs, fat].some((v) => Number.isNaN(v) || v < 0) || form.kcal100 === '') {
      setError('Completá kcal, proteína, carbohidratos y grasa por 100 g con números válidos.');
      return;
    }

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      categoryId: Number(form.categoryId),
      kcal100: kcal,
      protein100: protein,
      carbs100: carbs,
      fat100: fat,
      fiber100: form.fiber100 === '' ? null : Number(form.fiber100),
      notes: form.notes.trim() || null,
      emoji: form.emoji.trim() || null,
      imagePath: form.imagePath || null,
    };

    setSaving(true);
    try {
      const res = await fetch(
        ingrediente ? `/api/ingredientes/${ingrediente.id}` : '/api/ingredientes',
        {
          method: ingrediente ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'No se pudo guardar el ingrediente.');
        setSaving(false);
        return;
      }
      const saved: Ingrediente = await res.json();
      onSaved(saved);
    } catch {
      setError('No se pudo guardar el ingrediente.');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-tinta/45 p-0 sm:items-center sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[22px] bg-crema p-6 pb-10 sm:rounded-card">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">
            {ingrediente ? 'Editar ingrediente' : 'Nuevo ingrediente'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-linea bg-white text-lg"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {error && <p className="rounded-xl bg-mal/10 px-4 py-2 text-sm text-mal">{error}</p>}

          <div>
            <label className="mb-1 block text-sm font-semibold">Foto</label>
            <ImageUpload currentUrl={form.imagePath || null} onUploaded={(url) => update('imagePath', url)} />
          </div>

          <label className="block text-sm font-semibold">
            Nombre
            <input
              required
              className="input mt-1"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Categoría
              <select
                required
                className="input mt-1"
                value={form.categoryId}
                onChange={(e) => update('categoryId', e.target.value)}
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Emoji (opcional)
              <input
                className="input mt-1"
                placeholder="🥦"
                maxLength={8}
                value={form.emoji}
                onChange={(e) => update('emoji', e.target.value)}
              />
            </label>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">
            Valores aprox. por 100 g
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">
              Kcal
              <input
                required
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="input mt-1"
                value={form.kcal100}
                onChange={(e) => update('kcal100', e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Fibra g (opcional)
              <input
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="input mt-1"
                value={form.fiber100}
                onChange={(e) => update('fiber100', e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Proteína g
              <input
                required
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="input mt-1"
                value={form.protein100}
                onChange={(e) => update('protein100', e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Carbohidratos g
              <input
                required
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="input mt-1"
                value={form.carbs100}
                onChange={(e) => update('carbs100', e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Grasa g
              <input
                required
                type="number"
                min={0}
                step="any"
                inputMode="decimal"
                className="input mt-1"
                value={form.fat100}
                onChange={(e) => update('fat100', e.target.value)}
              />
            </label>
          </div>

          <label className="block text-sm font-semibold">
            Notas (opcional)
            <textarea
              className="input mt-1 min-h-[80px]"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </label>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-primario flex-1 disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
