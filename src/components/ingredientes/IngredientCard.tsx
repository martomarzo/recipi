'use client';

import type { Ingrediente } from './types';

interface IngredientCardProps {
  ingrediente: Ingrediente;
  onEditar: () => void;
  onArchivarOEliminar: () => void;
  onRestaurar: () => void;
  procesando: boolean;
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

export default function IngredientCard({
  ingrediente,
  onEditar,
  onArchivarOEliminar,
  onRestaurar,
  procesando,
}: IngredientCardProps) {
  const archivado = Boolean(ingrediente.archivedAt);
  const esReintro = ingrediente.category.key === 'reintro';

  return (
    <div
      className={`card flex flex-col items-center p-4 text-center transition-opacity ${
        archivado ? 'opacity-60' : ''
      }`}
    >
      {archivado && (
        <span className="mb-1 rounded-full bg-neutro-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tinta-suave">
          Archivado
        </span>
      )}

      <div
        className={`mb-2 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full text-3xl ${
          esReintro ? 'bg-terra-bg' : 'bg-salvia-bg'
        }`}
      >
        {ingrediente.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ingrediente.imagePath} alt={ingrediente.name} className="h-full w-full object-cover" />
        ) : (
          <span>{ingrediente.emoji || ingrediente.category.emoji}</span>
        )}
      </div>

      <b className="text-[13.5px] leading-tight">{ingrediente.name}</b>
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-tinta-suave">
        {ingrediente.category.emoji} {ingrediente.category.name}
      </span>

      <div className="mt-1.5 text-[11.5px] leading-snug text-tinta-suave">
        <b className="text-[11.5px]">{round(ingrediente.kcal100)}</b> kcal · P {round(ingrediente.protein100)} · H{' '}
        {round(ingrediente.carbs100)} · G {round(ingrediente.fat100)}
        <br />
        <span className="text-[10.5px]">aprox. por 100 g</span>
      </div>

      {ingrediente.notes && (
        <div className="mt-1.5 text-[11px] text-tinta-suave">⚠️ {ingrediente.notes}</div>
      )}

      <div className="mt-3 flex w-full flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onEditar}
          disabled={procesando}
          className="min-h-[36px] flex-1 rounded-full border border-linea bg-white px-3 text-xs font-semibold text-tinta hover:border-tinta-suave disabled:opacity-60"
        >
          Editar
        </button>
        {archivado ? (
          <button
            type="button"
            onClick={onRestaurar}
            disabled={procesando}
            className="min-h-[36px] flex-1 rounded-full border border-salvia bg-salvia-bg px-3 text-xs font-semibold text-salvia-osc disabled:opacity-60"
          >
            Restaurar
          </button>
        ) : (
          <button
            type="button"
            onClick={onArchivarOEliminar}
            disabled={procesando}
            className="min-h-[36px] flex-1 rounded-full border border-linea bg-white px-3 text-xs font-semibold text-mal hover:border-mal disabled:opacity-60"
          >
            Archivar…
          </button>
        )}
      </div>
    </div>
  );
}
