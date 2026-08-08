'use client';

import { useState } from 'react';

export interface UsuarioOption {
  id: string;
  name: string;
  email: string;
}

export interface ShareDTO {
  userId: string;
  role: 'viewer' | 'editor';
}

type RolOpcion = 'none' | 'viewer' | 'editor';

export default function DietShareForm({
  dietId,
  usuarios,
  sharesIniciales,
}: {
  dietId: string;
  usuarios: UsuarioOption[];
  sharesIniciales: ShareDTO[];
}) {
  const initial: Record<string, RolOpcion> = {};
  for (const u of usuarios) {
    const share = sharesIniciales.find((s) => s.userId === u.id);
    initial[u.id] = share ? share.role : 'none';
  }

  const [roles, setRoles] = useState<Record<string, RolOpcion>>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setRole(userId: string, rol: RolOpcion) {
    setRoles((prev) => ({ ...prev, [userId]: rol }));
    setSaved(false);
  }

  async function guardar() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const shares = usuarios
      .filter((u) => roles[u.id] !== 'none')
      .map((u) => ({ userId: u.id, role: roles[u.id] as 'viewer' | 'editor' }));
    const res = await fetch(`/api/dietas/${dietId}/shares`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shares }),
    });
    if (res.ok) {
      setSaved(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'No se pudo guardar los cambios.');
    }
    setBusy(false);
  }

  return (
    <div className="card space-y-3.5 p-5">
      <div>
        <h3 className="font-display text-lg font-semibold">Compartir</h3>
        <p className="mt-0.5 text-sm text-tinta-suave">
          Compartí esta dieta con otros usuarios: pueden verla o también editarla.
        </p>
      </div>

      {error && <p className="rounded-xl bg-mal/10 px-4 py-2 text-sm text-mal">{error}</p>}
      {saved && !error && <p className="text-sm text-salvia-osc">Cambios guardados.</p>}

      {usuarios.length === 0 ? (
        <p className="text-sm text-tinta-suave">
          No hay otros usuarios todavía — creá uno en la sección Usuarios.
        </p>
      ) : (
        <div className="space-y-2.5">
          {usuarios.map((u) => (
            <div
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-linea bg-white p-3"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{u.name}</div>
                <div className="truncate text-[12.5px] text-tinta-suave">{u.email}</div>
              </div>
              <select
                className="input min-h-[44px] w-auto min-w-[150px]"
                value={roles[u.id]}
                onChange={(e) => setRole(u.id, e.target.value as RolOpcion)}
              >
                <option value="none">No compartida</option>
                <option value="viewer">Puede ver</option>
                <option value="editor">Puede editar</option>
              </select>
            </div>
          ))}
        </div>
      )}

      {usuarios.length > 0 && (
        <button type="button" disabled={busy} onClick={guardar} className="btn-primario disabled:opacity-60">
          {busy ? 'Guardando…' : 'Guardar cambios'}
        </button>
      )}
    </div>
  );
}
