'use client';

// Gestión de usuarios (§7: sin roles, todos iguales). Dos vías de alta:
// crear el usuario directamente con contraseña, o generar un link de
// invitación para que la persona se registre sola (/api/auth/invite).
// Cada usuario se puede editar (nombre, email, contraseña) desde la lista.
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Usuario = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  _count: { diets: number };
};

// dd/mm/aaaa determinista desde el ISO, sin depender del locale del runtime.
function fecha(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function EditarUsuario({
  usuario,
  esPropio,
  onListo,
  onCancelar,
}: {
  usuario: Usuario;
  esPropio: boolean;
  onListo: () => void;
  onCancelar: () => void;
}) {
  const [nombre, setNombre] = useState(usuario.name);
  const [email, setEmail] = useState(usuario.email);
  const [password, setPassword] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${usuario.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre, email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && typeof data.error === 'string' && data.error) || 'No se pudo guardar.');
        return;
      }
      onListo();
    } catch {
      setError('No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="mt-3 grid gap-3 border-t border-linea pt-3 sm:grid-cols-3">
      <input
        className="input"
        placeholder="Nombre"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        required
      />
      <input
        className="input"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="input"
        type="password"
        placeholder="Nueva contraseña (opcional)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
      />
      <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
        <button type="submit" disabled={guardando} className="btn-primario disabled:opacity-60">
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={onCancelar} className="btn">
          Cancelar
        </button>
        <span className="text-xs text-tinta-suave">
          {esPropio
            ? 'Si cambiás tu contraseña, seguís logueada acá; otros dispositivos se cierran.'
            : 'Cambiar la contraseña cierra las sesiones de ese usuario.'}
        </span>
      </div>
      {error && <p className="text-sm text-mal sm:col-span-3">{error}</p>}
    </form>
  );
}

export default function UsuariosClient({
  usuariosIniciales,
  currentUserId,
}: {
  usuariosIniciales: Usuario[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setCreando(true);
    setError(null);
    setOk(null);
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nombre, email, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError((data && typeof data.error === 'string' && data.error) || 'No se pudo crear el usuario.');
        return;
      }
      setOk(`Usuario creado: ${email.toLowerCase().trim()}`);
      setNombre('');
      setEmail('');
      setPassword('');
      router.refresh();
    } catch {
      setError('No se pudo crear el usuario.');
    } finally {
      setCreando(false);
    }
  }

  async function generarInvitacion() {
    setGenerando(true);
    setError(null);
    setCopiado(false);
    try {
      const res = await fetch('/api/auth/invite', { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        setError((data && typeof data.error === 'string' && data.error) || 'No se pudo generar la invitación.');
        return;
      }
      setInviteUrl(data.url);
    } catch {
      setError('No se pudo generar la invitación.');
    } finally {
      setGenerando(false);
    }
  }

  async function copiar() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiado(true);
    } catch {
      // Sin permiso de clipboard: el link queda visible para copiar a mano.
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold">Usuarios</h1>
        <p className="mt-1 text-sm text-tinta-suave">
          Cada usuario ve solo sus dietas. Recetas e ingredientes del catálogo son compartidos.
        </p>
      </header>

      <section className="card p-5">
        <h2 className="font-display text-xl font-semibold">Nuevo usuario</h2>
        <form onSubmit={crear} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            className="input"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
          />
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Contraseña (mín. 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <button type="submit" disabled={creando} className="btn-primario disabled:opacity-60 sm:col-span-3 sm:justify-self-start">
            {creando ? 'Creando…' : '+ Crear usuario'}
          </button>
        </form>

        <div className="mt-4 border-t border-linea pt-4">
          <p className="text-sm text-tinta-suave">
            ¿Preferís que elija su propia contraseña? Generá un link de invitación (vale 7 días, un solo uso).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={generarInvitacion} disabled={generando} className="btn disabled:opacity-60">
              {generando ? 'Generando…' : '🔗 Generar link de invitación'}
            </button>
            {inviteUrl && (
              <>
                <code className="max-w-full break-all rounded-xl border border-linea bg-crema px-3 py-2 text-xs">
                  {inviteUrl}
                </code>
                <button type="button" onClick={copiar} className="btn">
                  {copiado ? '✓ Copiado' : 'Copiar'}
                </button>
              </>
            )}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-mal">{error}</p>}
        {ok && <p className="mt-3 text-sm text-salvia-osc">{ok}</p>}
      </section>

      <section className="card divide-y divide-linea">
        {usuariosIniciales.map((u) => (
          <div key={u.id} className="px-5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="leading-tight">
                <p className="font-semibold">
                  {u.name}
                  {u.id === currentUserId && <span className="chip ml-2 text-xs">Vos</span>}
                </p>
                <p className="text-sm text-tinta-suave">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-tinta-suave">
                <span className="chip">{u._count.diets} {u._count.diets === 1 ? 'dieta' : 'dietas'}</span>
                <span>desde {fecha(u.createdAt)}</span>
                <button
                  type="button"
                  onClick={() => setEditando(editando === u.id ? null : u.id)}
                  className="btn min-h-[36px] px-4 py-1 text-xs"
                >
                  {editando === u.id ? 'Cerrar' : 'Editar'}
                </button>
              </div>
            </div>
            {editando === u.id && (
              <EditarUsuario
                usuario={u}
                esPropio={u.id === currentUserId}
                onListo={() => {
                  setEditando(null);
                  router.refresh();
                }}
                onCancelar={() => setEditando(null)}
              />
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
