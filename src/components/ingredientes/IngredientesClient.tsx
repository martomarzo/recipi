'use client';

import { useEffect, useMemo, useState } from 'react';
import IngredientCard from './IngredientCard';
import IngredientFormModal from './IngredientFormModal';
import type { Categoria, Ingrediente } from './types';

interface IngredientesClientProps {
  categoriasIniciales: Categoria[];
  ingredientesIniciales: Ingrediente[];
}

export default function IngredientesClient({
  categoriasIniciales,
  ingredientesIniciales,
}: IngredientesClientProps) {
  const [categorias] = useState<Categoria[]>(categoriasIniciales);
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>(ingredientesIniciales);
  const [archivadosCargados, setArchivadosCargados] = useState(false);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);

  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas');

  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<Ingrediente | null>(null);
  const [procesandoId, setProcesandoId] = useState<number | null>(null);
  const [avisoError, setAvisoError] = useState<string | null>(null);

  useEffect(() => {
    if (mostrarArchivados && !archivadosCargados) {
      fetch('/api/ingredientes?archivados=1')
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((data: Ingrediente[]) => {
          setIngredientes(data);
          setArchivadosCargados(true);
        })
        .catch(() => setAvisoError('No se pudieron cargar los ingredientes archivados.'));
    }
  }, [mostrarArchivados, archivadosCargados]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return ingredientes
      .filter((i) => mostrarArchivados || !i.archivedAt)
      .filter((i) => categoriaFiltro === 'todas' || i.category.key === categoriaFiltro)
      .filter((i) => !q || i.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [ingredientes, busqueda, categoriaFiltro, mostrarArchivados]);

  function upsertLocal(ing: Ingrediente) {
    setIngredientes((prev) => {
      const idx = prev.findIndex((i) => i.id === ing.id);
      if (idx === -1) return [...prev, ing];
      const copy = prev.slice();
      copy[idx] = ing;
      return copy;
    });
  }

  function abrirCrear() {
    setEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(ing: Ingrediente) {
    setEditando(ing);
    setModalAbierto(true);
  }

  function onGuardado(ing: Ingrediente) {
    upsertLocal(ing);
    setModalAbierto(false);
    setEditando(null);
  }

  async function archivarOEliminar(ing: Ingrediente) {
    const confirmado = window.confirm(
      `¿Archivar o eliminar "${ing.name}"?\n\nSi está en uso en alguna receta, fase o bloque, se archivará (queda oculto pero se puede restaurar). Si no está en uso, se elimina definitivamente.`
    );
    if (!confirmado) return;

    setProcesandoId(ing.id);
    setAvisoError(null);
    try {
      const res = await fetch(`/api/ingredientes/${ing.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAvisoError(data.error || 'No se pudo archivar/eliminar el ingrediente.');
        return;
      }
      const data = await res.json();
      if (data.deleted) {
        setIngredientes((prev) => prev.filter((i) => i.id !== ing.id));
      } else if (data.archived && data.ingredient) {
        setArchivadosCargados(true);
        upsertLocal(data.ingredient);
      }
    } catch {
      setAvisoError('No se pudo archivar/eliminar el ingrediente.');
    } finally {
      setProcesandoId(null);
    }
  }

  async function restaurar(ing: Ingrediente) {
    setProcesandoId(ing.id);
    setAvisoError(null);
    try {
      const res = await fetch(`/api/ingredientes/${ing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archivedAt: null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setAvisoError(data.error || 'No se pudo restaurar el ingrediente.');
        return;
      }
      const updated: Ingrediente = await res.json();
      upsertLocal(updated);
    } catch {
      setAvisoError('No se pudo restaurar el ingrediente.');
    } finally {
      setProcesandoId(null);
    }
  }

  return (
    <div>
      <div className="mb-5 text-center">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Ingredientes</h1>
        <p className="mx-auto mt-1 max-w-xl text-sm text-tinta-suave">
          Catálogo con valores nutricionales aproximados por 100 g. Con estos componentes se arman las recetas y las
          dietas.
        </p>
      </div>

      <div className="mb-4 flex justify-center">
        <input
          type="search"
          placeholder="Buscar ingrediente…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="input max-w-md"
        />
      </div>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => setCategoriaFiltro('todas')}
          className={`min-h-[40px] rounded-full border px-4 text-[13px] font-semibold ${
            categoriaFiltro === 'todas'
              ? 'border-terra bg-terra text-white'
              : 'border-linea bg-white text-tinta hover:border-tinta-suave'
          }`}
        >
          Todas
        </button>
        {categorias.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoriaFiltro(c.key)}
            className={`min-h-[40px] rounded-full border px-4 text-[13px] font-semibold ${
              categoriaFiltro === c.key
                ? 'border-terra bg-terra text-white'
                : 'border-linea bg-white text-tinta hover:border-tinta-suave'
            }`}
          >
            {c.emoji} {c.name}
          </button>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={abrirCrear} className="btn-primario">
          + Nuevo ingrediente
        </button>
        <label className="flex min-h-[40px] items-center gap-2 rounded-full border border-linea bg-white px-4 text-[13px] font-semibold text-tinta-suave">
          <input
            type="checkbox"
            checked={mostrarArchivados}
            onChange={(e) => setMostrarArchivados(e.target.checked)}
          />
          Mostrar archivados
        </label>
      </div>

      {avisoError && (
        <p className="mx-auto mb-4 max-w-md rounded-xl bg-mal/10 px-4 py-2 text-center text-sm text-mal">
          {avisoError}
        </p>
      )}

      {visibles.length === 0 ? (
        <p className="mt-10 text-center text-sm text-tinta-suave">No hay ingredientes que coincidan.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visibles.map((ing) => (
            <IngredientCard
              key={ing.id}
              ingrediente={ing}
              procesando={procesandoId === ing.id}
              onEditar={() => abrirEditar(ing)}
              onArchivarOEliminar={() => archivarOEliminar(ing)}
              onRestaurar={() => restaurar(ing)}
            />
          ))}
        </div>
      )}

      <p className="mx-auto mt-8 max-w-xl text-center text-xs text-tinta-suave">
        📷 Cada ingrediente puede tener su propia foto; si no tiene, se muestra un emoji.
      </p>

      <IngredientFormModal
        open={modalAbierto}
        categorias={categorias}
        ingrediente={editando}
        onClose={() => {
          setModalAbierto(false);
          setEditando(null);
        }}
        onSaved={onGuardado}
      />
    </div>
  );
}
