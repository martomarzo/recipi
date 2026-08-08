'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { macrosOf } from '@/lib/macros';
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '@/lib/recetas/constants';
import { joinSteps } from '@/lib/recetas/steps';
import {
  fetchIngredients,
  fetchCategories,
  IngredientLite,
  IngredientCategoryLite,
} from '@/lib/recetas/ingredientsClient';
import NuevoIngredienteForm from './NuevoIngredienteForm';

interface SelectedIngredient extends IngredientLite {
  grams: number;
}

interface DietBlockOption {
  id: string;
  name: string;
  emoji: string | null;
}
interface DietPhaseOption {
  id: string;
  name: string;
  type: string;
  color: string;
  blocks: DietBlockOption[];
}
interface DietOption {
  id: string;
  name: string;
  isActive: boolean;
  totalWeeks: number;
  phases: DietPhaseOption[];
}

interface SuggestionTag {
  key: string;
  dietId: string;
  dietName: string;
  phaseId: string | null;
  phaseName: string | null;
  blockId: string | null;
  blockName: string | null;
  weekNumber: number | null;
  label: string;
}

export interface RecetaFormInitial {
  name: string;
  description: string;
  mealType: string;
  steps: string[];
  ingredients: SelectedIngredient[];
  suggestions: SuggestionTag[];
  sourceUrl?: string | null;
  rawText?: string | null;
  parsedJson?: string | null;
}

export default function RecetaForm({
  mode,
  dishId,
  initial,
}: {
  mode: 'crear' | 'editar';
  dishId?: string;
  initial?: RecetaFormInitial;
}) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [mealType, setMealType] = useState(initial?.mealType ?? 'comida');
  const [stepsText, setStepsText] = useState((initial?.steps ?? []).join('\n'));
  const [selected, setSelected] = useState<SelectedIngredient[]>(initial?.ingredients ?? []);

  const [ingQuery, setIngQuery] = useState('');
  const [ingResults, setIngResults] = useState<IngredientLite[]>([]);
  const [searching, setSearching] = useState(false);

  const [categories, setCategories] = useState<IngredientCategoryLite[]>([]);
  const [showNewIng, setShowNewIng] = useState(false);

  const [diets, setDiets] = useState<DietOption[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionTag[]>(initial?.suggestions ?? []);
  const [sugDietId, setSugDietId] = useState('');
  const [sugMode, setSugMode] = useState<'fase' | 'bloque' | 'semana'>('fase');
  const [sugPhaseId, setSugPhaseId] = useState('');
  const [sugBlockId, setSugBlockId] = useState('');
  const [sugWeek, setSugWeek] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories);
    fetch('/api/recetas/dietas')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => Array.isArray(data) && setDiets(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ingQuery.trim().length < 2) {
      setIngResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      fetchIngredients(ingQuery.trim())
        .then(setIngResults)
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [ingQuery]);

  const macros = useMemo(
    () => macrosOf(selected.map((s) => ({ grams: s.grams, ingredient: s }))),
    [selected]
  );

  function addIngredient(ing: IngredientLite) {
    if (selected.some((s) => s.id === ing.id)) return;
    setSelected((prev) => [...prev, { ...ing, grams: 100 }]);
    setIngQuery('');
    setIngResults([]);
  }

  function removeIngredient(id: number) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
  }

  function setGrams(id: number, grams: number) {
    setSelected((prev) => prev.map((s) => (s.id === id ? { ...s, grams } : s)));
  }

  function agregarSugerencia() {
    const diet = diets.find((d) => d.id === sugDietId);
    if (!diet) return;

    if (sugMode === 'semana') {
      const week = Number(sugWeek);
      if (!Number.isInteger(week) || week < 1) return;
      const tag: SuggestionTag = {
        key: `${diet.id}-week-${week}`,
        dietId: diet.id,
        dietName: diet.name,
        phaseId: null,
        phaseName: null,
        blockId: null,
        blockName: null,
        weekNumber: week,
        label: `S${week} · ${diet.name}`,
      };
      setSuggestions((prev) => (prev.some((s) => s.key === tag.key) ? prev : [...prev, tag]));
      setSugWeek('');
      return;
    }

    const phase = diet.phases.find((p) => p.id === sugPhaseId);
    if (!phase) return;

    if (sugMode === 'fase') {
      const tag: SuggestionTag = {
        key: `${diet.id}-phase-${phase.id}`,
        dietId: diet.id,
        dietName: diet.name,
        phaseId: phase.id,
        phaseName: phase.name,
        blockId: null,
        blockName: null,
        weekNumber: null,
        label: `${phase.name} · ${diet.name}`,
      };
      setSuggestions((prev) => (prev.some((s) => s.key === tag.key) ? prev : [...prev, tag]));
      return;
    }

    const block = phase.blocks.find((b) => b.id === sugBlockId);
    if (!block) return;
    const tag: SuggestionTag = {
      key: `${diet.id}-block-${block.id}`,
      dietId: diet.id,
      dietName: diet.name,
      phaseId: phase.id,
      phaseName: phase.name,
      blockId: block.id,
      blockName: block.name,
      weekNumber: null,
      label: `${block.emoji ?? '🔄'} ${block.name} · ${diet.name}`,
    };
    setSuggestions((prev) => (prev.some((s) => s.key === tag.key) ? prev : [...prev, tag]));
  }

  function quitarSugerencia(key: string) {
    setSuggestions((prev) => prev.filter((s) => s.key !== key));
  }

  const selectedDiet = diets.find((d) => d.id === sugDietId);
  const selectedPhase = selectedDiet?.phases.find((p) => p.id === sugPhaseId);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError('El nombre es obligatorio.');
    if (selected.length === 0) return setError('Agregá al menos un ingrediente con gramos.');
    if (selected.some((s) => !s.grams || s.grams <= 0)) return setError('Todos los ingredientes necesitan gramos > 0.');

    const stepsList = stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name: name.trim(),
      description: description.trim() || undefined,
      mealType,
      recipeMd: stepsList.length ? joinSteps(stepsList) : undefined,
      sourceUrl: initial?.sourceUrl ?? undefined,
      rawText: initial?.rawText ?? undefined,
      parsedJson: initial?.parsedJson ?? undefined,
      ingredients: selected.map((s) => ({ ingredientId: s.id, grams: s.grams })),
      suggestions: suggestions.map((s) => ({
        dietId: s.dietId,
        phaseId: s.phaseId,
        blockId: s.blockId,
        weekNumber: s.weekNumber,
      })),
    };

    setSubmitting(true);
    try {
      const url = mode === 'crear' ? '/api/recetas' : `/api/recetas/${dishId}`;
      const method = mode === 'crear' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la receta.');
      router.push(`/recetas/${data.dish.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la receta.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">
          {mode === 'crear' ? 'Nueva receta' : 'Editar receta'}
        </h1>
      </div>

      <section className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-tinta">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-tinta">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-tinta">Tipo de comida</label>
          <div className="flex flex-wrap gap-2">
            {MEAL_TYPES.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMealType(m)}
                className={`min-h-[40px] rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  mealType === m
                    ? 'border-terra bg-terra text-white'
                    : 'border-linea bg-white text-tinta hover:border-tinta-suave'
                }`}
              >
                {MEAL_TYPE_LABELS[m]}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">Ingredientes</h2>

        {selected.length > 0 && (
          <ul className="card mb-3 divide-y divide-linea">
            {selected.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex-1 text-sm">
                  {s.emoji ? `${s.emoji} ` : ''}
                  {s.name}
                </span>
                <input
                  type="number"
                  min={1}
                  value={s.grams}
                  onChange={(e) => setGrams(s.id, Number(e.target.value))}
                  className="input !min-h-[36px] w-24 py-1 text-right"
                />
                <span className="text-xs text-tinta-suave">g</span>
                <button
                  type="button"
                  onClick={() => removeIngredient(s.id)}
                  className="min-h-[36px] min-w-[36px] rounded-full text-tinta-suave hover:bg-neutro-bg"
                  aria-label={`Quitar ${s.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="relative">
          <input
            value={ingQuery}
            onChange={(e) => setIngQuery(e.target.value)}
            placeholder="Buscar ingrediente del catálogo…"
            className="input"
          />
          {ingQuery.trim().length >= 2 && (
            <div className="card absolute z-10 mt-1 max-h-64 w-full overflow-y-auto">
              {searching && <p className="px-4 py-2 text-sm text-tinta-suave">Buscando…</p>}
              {!searching && ingResults.length === 0 && (
                <p className="px-4 py-2 text-sm text-tinta-suave">Sin resultados.</p>
              )}
              {ingResults.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  onClick={() => addIngredient(r)}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-crema"
                >
                  <span>
                    {r.emoji ? `${r.emoji} ` : ''}
                    {r.name}
                  </span>
                  <span className="text-xs text-tinta-suave">{Math.round(r.kcal100)} kcal/100g</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowNewIng((v) => !v)}
          className="mt-2 text-sm font-semibold text-terra-osc hover:underline"
        >
          {showNewIng ? 'Cancelar' : '+ Crear ingrediente nuevo'}
        </button>

        {showNewIng && (
          <div className="mt-2">
            <NuevoIngredienteForm
              categories={categories}
              onCreated={(ing) => {
                addIngredient(ing);
                setShowNewIng(false);
              }}
              onCancel={() => setShowNewIng(false)}
            />
          </div>
        )}

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wide text-tinta-suave/70">aprox. por porción</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-tinta bg-tinta px-3 py-1 text-sm font-bold text-crema">
              {macros.kcal} kcal
            </span>
            <span className="rounded-full border border-linea bg-crema px-3 py-1 text-sm font-bold text-tinta">
              P {macros.protein} g
            </span>
            <span className="rounded-full border border-linea bg-crema px-3 py-1 text-sm font-bold text-tinta">
              H {macros.carbs} g
            </span>
            <span className="rounded-full border border-linea bg-crema px-3 py-1 text-sm font-bold text-tinta">
              G {macros.fat} g
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">Preparación</h2>
        <textarea
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          rows={6}
          placeholder="Un paso por línea…"
          className="input"
        />
        <p className="mt-1 text-xs text-tinta-suave">Un paso por línea. Los tiempos (ej. "20 minutos") se detectan solos.</p>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">
          Sugerir en (opcional)
        </h2>

        {suggestions.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <span
                key={s.key}
                className="flex items-center gap-1.5 rounded-full border border-linea bg-neutro-bg px-2.5 py-1 text-[12px] font-semibold text-tinta-suave"
              >
                {s.label}
                <button type="button" onClick={() => quitarSugerencia(s.key)} aria-label="Quitar">
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {diets.length === 0 ? (
          <p className="text-sm text-tinta-suave">No tenés dietas creadas todavía.</p>
        ) : (
          <div className="card space-y-2 p-4">
            <select value={sugDietId} onChange={(e) => setSugDietId(e.target.value)} className="input">
              <option value="">Elegí una dieta…</option>
              {diets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.isActive ? ' (activa)' : ''}
                </option>
              ))}
            </select>

            {selectedDiet && (
              <>
                <div className="flex gap-2">
                  {(['fase', 'bloque', 'semana'] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setSugMode(m)}
                      className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-semibold ${
                        sugMode === m ? 'border-tinta bg-tinta text-crema' : 'border-linea bg-white text-tinta'
                      }`}
                    >
                      {m === 'fase' ? 'Fase' : m === 'bloque' ? 'Bloque' : 'Semana'}
                    </button>
                  ))}
                </div>

                {sugMode !== 'semana' && (
                  <select value={sugPhaseId} onChange={(e) => setSugPhaseId(e.target.value)} className="input">
                    <option value="">Elegí una fase…</option>
                    {selectedDiet.phases.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                )}

                {sugMode === 'bloque' && selectedPhase && (
                  <select value={sugBlockId} onChange={(e) => setSugBlockId(e.target.value)} className="input">
                    <option value="">Elegí un bloque…</option>
                    {selectedPhase.blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.emoji} {b.name}
                      </option>
                    ))}
                  </select>
                )}

                {sugMode === 'semana' && (
                  <input
                    type="number"
                    min={1}
                    max={selectedDiet.totalWeeks}
                    value={sugWeek}
                    onChange={(e) => setSugWeek(e.target.value)}
                    placeholder={`Nº de semana (1–${selectedDiet.totalWeeks})`}
                    className="input"
                  />
                )}

                <button type="button" onClick={agregarSugerencia} className="btn">
                  + Agregar sugerencia
                </button>
              </>
            )}
          </div>
        )}
      </section>

      {error && <p className="text-sm font-semibold text-mal">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="submit" disabled={submitting} className="btn-primario disabled:opacity-50">
          {submitting ? 'Guardando…' : 'Guardar receta'}
        </button>
      </div>
    </form>
  );
}
