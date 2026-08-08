# Recipi — guía para agentes

App en producción (v1 completa, ver SPECS.md §12). UI 100 % en español; diseño = `prototype.html` (paleta en `tailwind.config.ts`, clases `.card .chip .btn .btn-primario .input`).

## Comandos

- `npm run dev` / `npm run build` / `npx tsc --noEmit` (validar siempre antes de commitear)
- `npm run seed` — idempotente; `npx prisma migrate dev` para cambios de schema
- Deploy = **pushear a `main`**: el servidor (`root@containers`, carpeta `/root/recipi`) tiene un systemd timer que hace pull + rebuild solo. Logs: `journalctl -u recipi-deploy.service`.

## Reglas duras

- Commits SIN atribución a Claude (sin Co-Authored-By ni "Generated with").
- No reabrir decisiones de SPECS §2 y §12.
- No persistir fechas de fases/bloques ni macros: son derivados (`src/lib/plan.ts`, `src/lib/macros.ts`). "Hoy" siempre client-side.
- Uploads van a `data/uploads` (servidos por `/uploads/[name]`), nunca a `public/`.
- `data/` es el único directorio persistente (SQLite + uploads + estado tailscale); en el server debe ser del uid 1001.

## Mapa rápido

- Motor de dominio: `src/lib/plan.ts` (computePlan/availability/requeue) + `src/lib/planData.ts` (loadDiet/loadActiveDiet, único punto de carga) + `src/lib/dates.ts` (ISO date-only).
- Secciones: `src/app/dietas` (timeline, gantt en `/disponibilidad`, resumen+PDF en `/resumen`), `src/app/recetas` (import por link en `/importar`, pipeline en `src/lib/recetas/`), `src/app/ingredientes`.
- Auth: `src/lib/auth.ts` (sesiones cookie + invitaciones); dietas scopeadas por acceso en `src/lib/dietAccess.ts` — dueño o share `DietShare` (viewer/editor); sin acceso = 404. Gestión de usuarios en `/usuarios` (alta directa + edición + link de invitación, sin roles).
- Semántica API: `PATCH /api/recetas/[id]` es full-replace; `DishSuggestion` solo con dietId = todo el plan; ingredientes globales, dishes con userId null = solo lectura.
- Docker: no tocar sin leer los comentarios — openssl en cada stage, `HOSTNAME=0.0.0.0` en entrypoint, bcryptjs copiado a mano, sidecar tailscale comparte netns de la app.
