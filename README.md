# Protocolo 🌿

App web self-hosted para seguir **planes de alimentación por fases** (protocolos de nutricionista). Tres secciones: **Dietas** (timeline por semanas con fases, reintroducciones y regla de los 4 días), **Recetas** (con macros calculados e importación desde un link) e **Ingredientes** (catálogo global con valores nutricionales por 100 g).

Especificación completa en [SPECS.md](SPECS.md). El diseño replica `prototype.html`.

## Funcionalidad

- **Timeline por semanas**: fases coloreadas, marcador de "hoy", detalle de cada semana (permitidos, a evitar, en prueba, recetas sugeridas). Cambiar la fecha de inicio recalcula todo el plan al instante.
- **Reintroducción**: bloques de 4 días con estado (pendiente / en prueba / tolerado / con síntomas), reencolar al final si hay síntomas — las fechas siguientes se recalculan solas.
- **Disponibilidad (Gantt)**: cada ingrediente día a día — base segura, en prueba, disponible o cortado por síntomas.
- **Recetas**: constructor con ingredientes en gramos y totales nutricionales en vivo; **importar desde un link** (scrapea la página: JSON-LD de schema.org → parser con Claude → parser regex de respaldo) o pegando texto; timers interactivos en los pasos; sugerencias por fase/bloque/semana.
- **Ingredientes**: catálogo global con foto (o emoji), búsqueda y filtros; archivado si está en uso.
- **Vista general + PDF**: resumen compacto de todo el plan (1–2 A4), export a PDF server-side e impresión.
- **Multi-usuario**: email + contraseña, registro abierto o por invitación (`REGISTRATION_OPEN`).
- **PWA**: instalable, lectura offline del último plan sincronizado.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · Prisma 5 · **SQLite** (un archivo, backup trivial) · Docker Compose · sidecar de Tailscale opcional.

## Desarrollo local

```bash
npm install
cp .env.example .env        # revisar valores
npx prisma migrate dev      # crea data/app.db
npm run seed                # catálogo + plan demo "Protocolo Intestinal"
npm run dev                 # http://localhost:3000
```

El seed crea (si no hay usuarios) `demo@protocolo.local` / `protocolo123`.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | SQLite. Local: `file:../data/app.db` · Docker: `file:/data/app.db`. |
| `SECRET_KEY` | Clave para producción (generar una aleatoria). |
| `REGISTRATION_OPEN` | `true` = registro abierto; `false` = solo con link de invitación. |
| `ANTHROPIC_API_KEY` | Opcional — mejora el parseo de recetas importadas (sin clave: parser regex). |
| `ANTHROPIC_MODEL` | Opcional — modelo para el parseo (default `claude-haiku-4-5`). |
| `TS_AUTHKEY` | Opcional — auth key de Tailscale para el sidecar (solo el primer arranque). |
| `COOKIE_SECURE` | Poner `false` solo si se entra por HTTP plano (LAN sin TLS). |

## Deploy (Docker)

```bash
# En el servidor (VM Proxmox con Docker — ssh al host, ver SPECS §9.1):
git clone https://github.com/martomarzo/recipi.git && cd recipi
cp .env.example .env        # completar SECRET_KEY, REGISTRATION_OPEN, TS_AUTHKEY…
docker compose up -d --build
docker compose exec app node prisma/seed.mjs   # una sola vez
```

- Todo lo persistente vive en **`./data/`**: `app.db` (SQLite), `uploads/` (fotos), `tailscale/` (estado del sidecar). Las migraciones corren solas al arrancar.
- **Acceso**: `https://recipi.<tailnet>.ts.net` vía el sidecar de Tailscale (`tailscale serve`, config en `tailscale/serve.json`), o `http://IP:3000` en la LAN (en ese caso `COOKIE_SECURE=false`).
- El PDF usa el chromium incluido en la imagen.

## Backup y restore

```bash
# Backup: copiar la carpeta data/ (idealmente con la app parada o con sqlite3 .backup)
tar czf backup-$(date +%F).tgz data/

# Restore: descomprimir y levantar
tar xzf backup-2026-08-08.tgz && docker compose up -d
```

## Scripts

| Script | Descripción |
|---|---|
| `npm run dev` / `build` / `start` | Next.js. |
| `npm run seed` | Seed idempotente (catálogo + plan demo, Apéndice A de SPECS). |
| `npm run db:migrate` / `db:deploy` / `db:studio` | Prisma. |

# Auto-deploy
El servidor corre `deploy/recipi-deploy.timer` (systemd): cada 2 minutos chequea `origin/main` y, si hay commits nuevos, hace `git reset --hard` + `docker compose up -d --build`. Deployar = pushear a `main`.
Logs: `journalctl -u recipi-deploy.service -n 50`.
