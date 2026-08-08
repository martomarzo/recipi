'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '@/lib/recetas/constants';
import { joinSteps } from '@/lib/recetas/steps';
import type { ImportDraft, ParsedIngredientLine } from '@/lib/recetas/types';
import { fetchIngredients, fetchCategories, IngredientLite, IngredientCategoryLite } from '@/lib/recetas/ingredientsClient';
import { matchIngredients } from '@/lib/recetas/match';
import NuevoIngredienteForm from './NuevoIngredienteForm';

interface LineState {
  line: ParsedIngredientLine;
  matches: IngredientLite[];
  selectedId: number | 'skip' | 'new' | '';
  grams: number;
}

function defaultGrams(line: ParsedIngredientLine): number {
  const qty = line.quantity ? parseFloat(line.quantity.replace(',', '.').replace('/', '.')) : NaN;
  const unit = (line.unit || '').toLowerCase();
  if (!Number.isNaN(qty)) {
    if (/^(kg|kilos?|kilogramos?)$/.test(unit)) return Math.round(qty * 1000);
    if (/^(g|gr|gramos?)$/.test(unit)) return Math.round(qty);
  }
  return 100;
}

const PARSED_WITH_LABEL: Record<ImportDraft['parsedWith'], string> = {
  jsonld: 'datos estructurados de la página (schema.org)',
  claude: 'IA (Claude)',
  regex: 'parser por reglas (sin IA configurada)',
};

export default function ImportarClient() {
  const router = useRouter();
  const [step, setStep] = useState<'input' | 'draft'>('input');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<ImportDraft | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mealType, setMealType] = useState('comida');
  const [stepsText, setStepsText] = useState('');
  const [lines, setLines] = useState<LineState[]>([]);
  const [categories, setCategories] = useState<IngredientCategoryLite[]>([]);
  const [newIngFor, setNewIngFor] = useState<number | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [estimando, setEstimando] = useState(false);
  const [estimadoMsg, setEstimadoMsg] = useState<string | null>(null);

  async function analizar() {
    setError(null);
    if (!url.trim() && !text.trim()) {
      setError('Pegá un link o el texto de la receta.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/recetas/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(url.trim() ? { url: url.trim() } : { text: text.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo importar la receta.');

      const d: ImportDraft = data.draft;
      setDraft(d);
      setName(d.name);
      setDescription(d.description);
      setMealType(d.mealType);
      setStepsText(d.steps.join('\n'));

      fetchCategories().then(setCategories);

      const lineStates: LineState[] = await Promise.all(
        d.ingredientLines.map(async (line) => {
          const results = await fetchIngredients(line.name || line.raw);
          const ranked = matchIngredients(line.name || line.raw, results);
          return {
            line,
            matches: ranked,
            selectedId: ranked[0]?.id ?? '',
            grams: defaultGrams(line),
          };
        })
      );
      setLines(lineStates);
      setStep('draft');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo importar la receta.');
    } finally {
      setLoading(false);
    }
  }

  function updateLine(idx: number, patch: Partial<LineState>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  // Crea de una vez todos los ingredientes sin mapear, con macros estimados
  // por IA (POST /api/ingredientes/estimar), y mapea las líneas al resultado.
  async function crearFaltantes() {
    const pares = lines
      .map((l, idx) => ({ idx, nombre: (l.line.name || l.line.raw).trim() }))
      .filter((p) => lines[p.idx].selectedId === '' && p.nombre);
    if (pares.length === 0) return;

    setEstimando(true);
    setError(null);
    setEstimadoMsg(null);
    try {
      const res = await fetch('/api/ingredientes/estimar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: pares.map((p) => p.nombre) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo estimar con IA.');

      const items: { input: string; created: boolean; ingredient: IngredientLite }[] =
        Array.isArray(data.items) ? data.items : [];
      for (const p of pares) {
        const item = items.find((it) => it.input === p.nombre);
        if (!item?.ingredient) continue;
        updateLine(p.idx, {
          selectedId: item.ingredient.id,
          matches: [item.ingredient, ...lines[p.idx].matches],
        });
      }
      const creados = items.filter((it) => it.created).length;
      const reusados = items.length - creados;
      setEstimadoMsg(
        `${creados} ingrediente${creados === 1 ? '' : 's'} creado${creados === 1 ? '' : 's'} con macros estimados` +
          (reusados > 0 ? ` (${reusados} ya existía${reusados === 1 ? '' : 'n'})` : '') +
          ' — los valores son aproximados, revisalos en Ingredientes.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo estimar con IA.');
    } finally {
      setEstimando(false);
    }
  }

  async function guardar() {
    if (!draft) return;
    setError(null);
    if (!name.trim()) {
      setError('El nombre es obligatorio.');
      return;
    }

    const ingredients = lines
      .filter((l) => typeof l.selectedId === 'number' && l.grams > 0)
      .map((l) => ({ ingredientId: l.selectedId as number, grams: l.grams }));

    if (ingredients.length === 0) {
      setError('Mapeá al menos un ingrediente a un ítem del catálogo.');
      return;
    }

    const unmapped = lines.filter((l) => typeof l.selectedId !== 'number').map((l) => l.line.raw);

    const stepsList = stepsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const res = await fetch('/api/recetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          mealType,
          recipeMd: stepsList.length ? joinSteps(stepsList) : undefined,
          sourceUrl: draft.sourceUrl,
          rawText: draft.rawText,
          parsedJson: unmapped.length ? JSON.stringify(unmapped) : undefined,
          ingredients,
          suggestions: [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la receta.');
      router.push(`/recetas/${data.dish.id}/editar`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la receta.');
      setSubmitting(false);
    }
  }

  if (step === 'input') {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-semibold">Importar receta</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Pegá el link de una receta o el texto completo — la app intenta separar ingredientes y pasos.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-tinta">Link de la receta</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="input"
              disabled={!!text.trim()}
            />
          </div>
          <p className="text-center text-xs text-tinta-suave">— o —</p>
          <div>
            <label className="mb-1 block text-sm font-semibold text-tinta">Texto de la receta</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder="Pegá acá el texto completo: nombre, ingredientes y preparación…"
              className="input"
              disabled={!!url.trim()}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-semibold text-mal">{error}</p>}

        <div className="mt-5 flex justify-end">
          <button onClick={analizar} disabled={loading} className="btn-primario disabled:opacity-50">
            {loading ? 'Analizando…' : 'Analizar'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Revisar receta importada</h1>
        {draft && (
          <p className="mt-1 text-xs text-tinta-suave">
            Parseada con {PARSED_WITH_LABEL[draft.parsedWith]}
            {draft.sourceUrl ? ` · ${draft.sourceUrl}` : ''}. Revisá y corregí antes de guardar.
          </p>
        )}
      </div>

      <section className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-tinta">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-tinta">Descripción</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input" />
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
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">
          Ingredientes detectados
        </h2>
        <p className="mb-3 text-xs text-tinta-suave">
          Mapeá cada línea a un ingrediente del catálogo y confirmá los gramos, o creá el ingrediente si no existe.
          Las líneas sin mapear no se pierden: quedan guardadas junto a la receta.
        </p>
        {lines.some((l) => l.selectedId === '') && (
          <div className="mb-3">
            <button
              type="button"
              onClick={crearFaltantes}
              disabled={estimando}
              className="btn disabled:opacity-60"
            >
              {estimando ? 'Estimando macros…' : '✨ Crear faltantes con macros estimados (IA)'}
            </button>
          </div>
        )}
        {estimadoMsg && <p className="mb-3 text-xs font-semibold text-salvia-osc">{estimadoMsg}</p>}
        <div className="space-y-2">
          {lines.map((l, idx) => (
            <div key={idx} className="card p-3">
              <p className="mb-2 text-sm text-tinta-suave">
                <span className="font-semibold text-tinta">{l.line.raw}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={typeof l.selectedId === 'number' ? l.selectedId : l.selectedId}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'skip') updateLine(idx, { selectedId: 'skip' });
                    else if (v === 'new') {
                      updateLine(idx, { selectedId: 'new' });
                      setNewIngFor(idx);
                    } else updateLine(idx, { selectedId: Number(v) });
                  }}
                  className="input !min-h-[40px] flex-1"
                >
                  <option value="">— omitir —</option>
                  {l.matches.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.emoji ? `${m.emoji} ` : ''}
                      {m.name}
                    </option>
                  ))}
                  <option value="new">+ Crear ingrediente nuevo…</option>
                  <option value="skip">Omitir esta línea</option>
                </select>
                {typeof l.selectedId === 'number' && (
                  <>
                    <input
                      type="number"
                      min={1}
                      value={l.grams}
                      onChange={(e) => updateLine(idx, { grams: Number(e.target.value) })}
                      className="input !min-h-[40px] w-24 py-1 text-right"
                    />
                    <span className="text-xs text-tinta-suave">g</span>
                  </>
                )}
              </div>
              {newIngFor === idx && (
                <div className="mt-2">
                  <NuevoIngredienteForm
                    categories={categories}
                    initialName={l.line.name || l.line.raw}
                    onCreated={(ing) => {
                      updateLine(idx, {
                        selectedId: ing.id,
                        matches: [ing, ...l.matches],
                      });
                      setNewIngFor(null);
                    }}
                    onCancel={() => {
                      updateLine(idx, { selectedId: '' });
                      setNewIngFor(null);
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-tinta-suave">Preparación</h2>
        <textarea
          value={stepsText}
          onChange={(e) => setStepsText(e.target.value)}
          rows={6}
          className="input"
        />
        <p className="mt-1 text-xs text-tinta-suave">Un paso por línea. Podés editarlos libremente.</p>
      </section>

      {error && <p className="text-sm font-semibold text-mal">{error}</p>}

      <div className="flex justify-between gap-2">
        <button type="button" onClick={() => setStep('input')} className="btn">
          Volver
        </button>
        <button type="button" onClick={guardar} disabled={submitting} className="btn-primario disabled:opacity-50">
          {submitting ? 'Guardando…' : 'Guardar receta'}
        </button>
      </div>
    </div>
  );
}
