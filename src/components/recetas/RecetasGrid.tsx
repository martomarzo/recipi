'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { DishDTO } from '@/lib/recetas/dishQuery';
import { normalizeText } from '@/lib/recetas/match';
import { MEAL_TYPE_LABELS, MEAL_TYPES } from '@/lib/recetas/constants';

const FILTROS = [['todas', 'Todas'] as const, ...MEAL_TYPES.map((m) => [m, MEAL_TYPE_LABELS[m]] as const)];

function suggestionClasses(phaseColor: string | null, isWeek: boolean): string {
  if (isWeek) return 'border-tinta bg-tinta text-crema';
  switch (phaseColor) {
    case 'salvia':
      return 'border-salvia bg-salvia-bg text-salvia-osc';
    case 'azul':
      return 'border-azul bg-azul-bg text-azul';
    case 'terra':
      return 'border-terra bg-terra-bg text-terra-osc';
    case 'neutro':
      return 'border-neutro bg-neutro-bg text-tinta-suave';
    default:
      return 'border-linea bg-neutro-bg text-tinta-suave';
  }
}

const TONE_CLASSES: Record<string, string> = {
  ok: 'text-salvia-osc',
  warn: 'text-terra-osc',
  muted: 'text-tinta-suave',
  bad: 'text-mal',
};

export default function RecetasGrid({
  dishes,
  hasActiveDiet,
}: {
  dishes: DishDTO[];
  hasActiveDiet: boolean;
}) {
  const [mealType, setMealType] = useState<string>('todas');
  const [search, setSearch] = useState('');

  const needle = normalizeText(search);

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      if (mealType !== 'todas' && d.mealType !== mealType) return false;
      if (!needle) return true;
      if (normalizeText(d.name).includes(needle)) return true;
      return d.ingredients.some((i) => normalizeText(i.name).includes(needle));
    });
  }, [dishes, mealType, needle]);

  return (
    <div>
      <div className="mb-4 flex justify-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o ingrediente…"
          className="input max-w-md"
        />
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {FILTROS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => setMealType(id)}
            className={`min-h-[40px] rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
              mealType === id
                ? 'border-terra bg-terra text-white'
                : 'border-linea bg-white text-tinta hover:border-tinta-suave'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-tinta-suave">
          No hay recetas que coincidan{search ? ` con "${search}"` : ''}.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((d) => {
            const muted = hasActiveDiet && d.allAvailableToday === false;
            const matchedIngredient = needle
              ? d.ingredients.find((i) => normalizeText(i.name).includes(needle))
              : null;
            const shown = d.ingredients.slice(0, 4);
            const rest = d.ingredients.length - shown.length;

            return (
              <Link
                key={d.id}
                href={`/recetas/${d.id}`}
                className={`card block p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                  muted ? 'opacity-70 saturate-[.6]' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold leading-snug text-tinta">{d.name}</h3>
                  <span className="shrink-0 whitespace-nowrap rounded-full border border-terra/40 bg-terra-bg px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-terra-osc">
                    {MEAL_TYPE_LABELS[d.mealType as keyof typeof MEAL_TYPE_LABELS] ?? d.mealType}
                  </span>
                </div>

                {d.suggestions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {d.suggestions.map((s) => (
                      <span
                        key={s.id}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${suggestionClasses(
                          s.phaseColor,
                          s.weekNumber != null
                        )}`}
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                )}

                {muted && (
                  <p className="mt-2 text-[11.5px] font-semibold text-mal">⚠ no disponible hoy en tu dieta activa</p>
                )}

                <ul className="mt-2.5 grid gap-1 text-[13px] text-tinta-suave">
                  {shown.map((i) => (
                    <li key={i.ingredientId} className="flex justify-between gap-2">
                      <span>
                        {i.emoji ? `${i.emoji} ` : ''}
                        {i.name}
                      </span>
                      <span className="shrink-0">{i.grams} g</span>
                    </li>
                  ))}
                  {rest > 0 && <li className="text-[12px] italic">+{rest} más…</li>}
                </ul>

                {matchedIngredient?.availability && (
                  <p className={`mt-1.5 text-[11.5px] ${TONE_CLASSES[matchedIngredient.availability.tone]}`}>
                    {matchedIngredient.emoji} {matchedIngredient.name} — {matchedIngredient.availability.text}
                  </p>
                )}

                <p className="mt-3 text-[10px] uppercase tracking-wide text-tinta-suave/70">aprox. por porción</p>
                <div className="mt-1 flex flex-wrap gap-1.5 border-t border-dashed border-linea pt-2.5">
                  <span className="rounded-full border border-tinta bg-tinta px-2.5 py-1 text-xs font-bold text-crema">
                    {d.macros.kcal} kcal
                  </span>
                  <span className="rounded-full border border-linea bg-crema px-2.5 py-1 text-xs font-bold text-tinta">
                    P {d.macros.protein} g
                  </span>
                  <span className="rounded-full border border-linea bg-crema px-2.5 py-1 text-xs font-bold text-tinta">
                    H {d.macros.carbs} g
                  </span>
                  <span className="rounded-full border border-linea bg-crema px-2.5 py-1 text-xs font-bold text-tinta">
                    G {d.macros.fat} g
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
