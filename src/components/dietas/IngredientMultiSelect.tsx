'use client';

import { useMemo, useState } from 'react';
import type { IngredientOption } from './EditorClient';

export default function IngredientMultiSelect({
  opciones,
  cargando,
  selected,
  onChange,
}: {
  opciones: IngredientOption[];
  cargando: boolean;
  selected: number[];
  onChange: (ids: number[]) => void;
}) {
  const [q, setQ] = useState('');

  const filtradas = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return opciones.filter((o) => !qq || o.name.toLowerCase().includes(qq));
  }, [opciones, q]);

  function toggle(id: number) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  return (
    <div>
      <input
        type="search"
        placeholder="Buscar ingrediente…"
        className="input mb-2 text-[13px]"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-48 overflow-y-auto rounded-xl border border-linea bg-white p-2">
        {cargando && <p className="p-2 text-[13px] text-tinta-suave">Cargando catálogo…</p>}
        {!cargando && filtradas.length === 0 && <p className="p-2 text-[13px] text-tinta-suave">Sin resultados.</p>}
        {filtradas.map((ing) => (
          <label
            key={ing.id}
            className="flex min-h-[36px] cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-[13px] hover:bg-crema"
          >
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={selected.includes(ing.id)}
              onChange={() => toggle(ing.id)}
            />
            <span>
              {ing.emoji ?? '•'} {ing.name}
            </span>
            <span className="ml-auto text-[11px] text-tinta-suave">{ing.category.name}</span>
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="mt-1.5 text-[12px] text-tinta-suave">{selected.length} ingrediente(s) seleccionado(s)</p>
      )}
    </div>
  );
}
