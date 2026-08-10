# Spec — App de Planes de Alimentación por Fases ("Recipi")

**Documento para implementación con Claude Code.**
Versión 1.2 — 08/08/2026 — Autora: Marto

---

## 1. Visión

App web self-hosted para seguir planes de alimentación por fases (protocolos de nutricionista). Se organiza en **tres secciones principales** accesibles desde un menú general: **Dietas**, **Recetas** e **Ingredientes**.

- **Ingredientes** es la base: un catálogo con imagen y **valores nutricionales aproximados por 100 g** (kcal, proteínas, hidratos, grasas).
- **Recetas** se construyen eligiendo ingredientes con **cantidades en gramos**; la app **suma automáticamente** los valores nutricionales de la receta.
- **Dietas** se arman con estos componentes: fases, bloques de reintroducción, reglas de ingredientes permitidos/evitados y recetas sugeridas.

La vista principal de una dieta es un **timeline por semanas**: la usuaria abre la app en el celular y ve al instante en qué semana/fase está, qué puede comer hoy, qué alimento está "en prueba" y sugerencias de platos (con sus kcal). Las **fechas del plan son editables**: cambiar la fecha de inicio recalcula todo el timeline.

Todo se guarda en una **base de datos** para reutilizar: repetir un protocolo más adelante, armar dietas nuevas a partir del catálogo, o cargar el plan de otra persona.

El primer plan a cargar (seed) es un protocolo intestinal real de 11 semanas: 3 semanas de exclusión → 1 semana de probióticos → reintroducción de 11 alimentos, uno cada 4 días (regla de los 4 días). Los datos completos están en el **Apéndice A** y deben quedar cargados vía seed.

## 2. Decisiones ya tomadas (no reabrir)

| Tema | Decisión |
|---|---|
| Stack | **A elección del implementador**, con requisitos: SQLite como DB (archivo único, fácil backup), un solo servicio deployable, SSR o SPA indistinto. Sugerencias válidas: Next.js full-stack, SvelteKit, FastAPI+frontend. Priorizar simpleza de mantenimiento. |
| Deploy | **Docker Compose**: `docker compose up -d` levanta todo. Volumen persistente para la DB. Pensada para correr detrás de un reverse proxy (Caddy/Traefik/nginx) que da HTTPS. |
| Usuarios | **Multi-usuario** con login (email + contraseña). Cada usuario ve solo sus planes. Sin roles complejos en v1 (todos iguales; primer usuario registrado o var de entorno define si el registro queda abierto o por invitación — ver §7). |
| PWA | **Sí**: instalable en iOS/Android, con lectura offline del plan activo (ver §8). |
| Idioma | UI en **español**. Fechas formato `dd/mm`, semana empieza **lunes**, timezone del navegador (el usuario está en Europe/Madrid). |
| PDF | El **export a PDF es parte de la app** (ver §6). |

## 3. Conceptos y modelo de datos

### 3.1 Conceptos

- **Plan (Diet)**: un protocolo con fecha de inicio, dueño, y una secuencia de **fases**.
- **Fase (Phase)**: rango de días dentro del plan, con tipo (`exclusion`, `probioticos`, `reintroduccion`, `mantenimiento`, `custom`), color, descripción y reglas asociadas (qué grupos de ingredientes están permitidos/evitados).
- **Bloque de reintroducción (ReintroBlock)**: dentro de una fase de reintroducción, cada alimento a probar: orden, duración en días (default 4), ingrediente(s) asociados, tips, y **estado de tolerancia** (`pendiente`, `en_prueba`, `tolerado`, `con_sintomas`).
- **Ingrediente (Ingredient)**: catálogo global reutilizable entre planes. Nombre, categoría (proteínas, grasas, vegetales, tubérculos, frutas, especias, lácteos, cereales…), **imagen** (foto subida o URL; fallback emoji), notas (ej. "sin piel ni semillas", "remojadas") y **valores nutricionales aproximados por 100 g**: kcal, proteínas (g), hidratos (g), grasas (g) — opcional fibra (g). Los valores son editables por el usuario y se marcan como "aproximados" en la UI.
- **Regla de ingredientes (PhaseIngredientRule)**: vincula fase ↔ ingrediente o ↔ categoría con estado `permitido` / `evitar`. Los bloques de reintroducción agregan ingredientes al set permitido a partir de que su bloque termina con estado `tolerado`.
- **Receta (Dish)**: reutilizable: nombre, descripción corta, tipo de comida (desayuno/comida/cena/snack), y lista de ingredientes **con cantidad en gramos** (M2M con atributo `grams`). La app **calcula y muestra los valores nutricionales de la receta** sumando `valor_por_100g × gramos / 100` de cada ingrediente (kcal + macros, redondeados, etiquetados "aprox. por porción"). El cálculo es derivado — no se persiste, o se cachea e invalida al editar receta o ingrediente. Una receta se puede sugerir en una fase o bloque específico (**DishSuggestion**).
- **Registro (TrackingEntry)** *(v1 simple)*: nota diaria opcional del usuario: fecha, texto libre de síntomas/observaciones, vinculada al plan. Sirve para decidir tolerancia en la reintroducción.

### 3.2 Tablas (orientativo)

```
users(id, email UNIQUE, password_hash, name, created_at)
diets(id, user_id FK, name, description, start_date, is_active, created_at)
phases(id, diet_id FK, name, type, sort, start_offset_days, duration_days,
       color, description, daily_rules_md)
reintro_blocks(id, phase_id FK, sort, name, emoji, duration_days DEFAULT 4,
               tips_md, status ENUM(pendiente|en_prueba|tolerado|con_sintomas),
               status_note)
ingredient_categories(id, name, emoji, sort)
ingredients(id, category_id FK, name, notes, emoji, image_path,
            kcal_100, protein_g_100, carbs_g_100, fat_g_100,
            fiber_g_100 NULL)                          -- catálogo GLOBAL (compartido)
phase_ingredient_rules(id, phase_id FK, ingredient_id NULL FK,
                       category_id NULL FK, rule ENUM(permitido|evitar), note)
reintro_block_ingredients(block_id FK, ingredient_id FK)
dishes(id, user_id NULL FK, name, description, meal_type, recipe_md)
dish_ingredients(dish_id FK, ingredient_id FK, grams REAL NOT NULL)
dish_suggestions(id, dish_id FK, diet_id NULL FK, phase_id NULL FK,
                 block_id NULL FK, week_number NULL INT)  -- week_number: tag a semana específica
tracking_entries(id, diet_id FK, date, note_md, created_at)
```

Notas:
- Fechas de fases/bloques se calculan desde `diets.start_date` + offsets → **cambiar la fecha de inicio recalcula todo el timeline** (requisito: la usuaria puede correr el plan si se atrasa).
- Debe existir una acción "**recalcular desde bloque X**": si un bloque da síntomas, se puede reintentar o posponer, empujando las fechas de los bloques siguientes.
- `ingredients` es catálogo global para reutilizar entre planes/usuarios; `dishes` puede ser global (`user_id NULL`) o del usuario.

## 4. Funcionalidad (v1)

### 4.0 Navegación general
- **Menú principal** (barra superior en desktop, accesible en móvil): **Dietas · Recetas · Ingredientes**. El prototipo muestra el patrón exacto.
- Landing tras login: **lista de dietas** del usuario (tarjetas con nombre, rango de fechas, mini-banda de fases, progreso de reintroducciones toleradas, chip "Activa"), más tarjeta "+ Nueva dieta" (crear desde cero o duplicar).
- Abrir una dieta lleva a su vista de timeline (§4.1), con navegación de vuelta a la lista.

### 4.1 Vista de una dieta: Timeline
- Banda horizontal con las semanas del plan activo, coloreadas por fase, con **marcador de "hoy"**.
- Tarjetas por semana (grid responsive; en móvil, lista vertical). Cada tarjeta: número de semana, fechas, fase, y qué hay de nuevo (ej. "🥦 Crucíferas en prueba 08–11/09").
- **Click/tap en una semana → detalle** (modal en desktop, pantalla completa en móvil):
  - Fase y fechas; bloques en prueba esa semana con sus rangos exactos de días.
  - **Alimentos permitidos**: base segura por grupos + "ya reintroducidos" (bloques anteriores tolerados) + "en prueba ahora".
  - Alimentos a evitar (colapsable).
  - **Sugerencias de recetas** de esa fase/bloque (desde `dish_suggestions`), con sus ingredientes y **kcal aprox por porción**; link al detalle completo en la sección Recetas.
  - Reglas diarias de la fase (máx. 3 ingestas, cena temprana, etc.).
- Estado "hoy": header con "Estás en Semana N — Fase X" y acceso directo al detalle de hoy.
- **Fecha de inicio editable desde esta vista** (input de fecha en el header del plan): al cambiarla se recalculan todas las semanas, fases y bloques al instante. El prototipo demuestra el comportamiento.

### 4.2 Reintroducción
- En el detalle de un bloque: botones **"Tolerado" / "Con síntomas"** + nota.
- "Con síntomas" ofrece: reintentar más adelante (reencolar al final) o marcar y seguir — siempre recalculando fechas siguientes.
- Recordatorios visibles de las reglas: un alimento a la vez, 4 días aumentando cantidad, no introducir tras noche de guardia sin dormir.

### 4.3 Sección Ingredientes
- Catálogo global en grilla de tarjetas: **imagen** (o emoji fallback), nombre, categoría, valores nutricionales por 100 g.
- **Búsqueda** por nombre + **filtro por categoría** (chips), como en el prototipo.
- **Alta de ingredientes** desde la propia sección (botón "+ Nuevo ingrediente") y al vuelo desde el editor de recetas: nombre, categoría, valores nutricionales, notas, imagen.
- **Cambiar la foto** de un ingrediente en cualquier momento: subir/reemplazar imagen desde la tarjeta o el editor (guardada en el volumen de datos, redimensionada a thumbnail; fallback emoji si no hay foto).
- Un ingrediente en uso por recetas/planes no se borra: se archiva.

### 4.4 Sección Recetas
- Grilla de tarjetas: nombre, tipo (desayuno/comida/cena/snack), fase o bloque al que se sugiere, ingredientes con gramos, y **macros calculados** (kcal destacada + P/H/G en g), como en el prototipo.
- Filtros por tipo de comida; búsqueda por nombre **y por ingrediente**.
- **Búsqueda por ingrediente con disponibilidad**: al buscar/filtrar por un ingrediente, cada resultado muestra desde cuándo ese ingrediente está **"disponible"** en la dieta activa (ej. "🥦 Brócoli — disponible desde S6 · 08/09, en prueba hasta 11/09"), calculado desde las fases/bloques. Ingredientes de la base segura → "disponible todo el plan"; aún no reintroducidos → "todavía no (entra en S6)". Recetas cuyos ingredientes no están todos disponibles hoy se marcan visualmente.
- **Constructor de recetas**: elegir ingredientes del catálogo, asignar gramos, ver los totales nutricionales actualizarse en vivo; asignar sugerencia a fase/bloque de una dieta.
- **Taggear recetas a una semana específica** de una dieta (además de fase/bloque): desde el constructor o desde el detalle de semana ("agregar receta a esta semana"), vía `dish_suggestions.week_number`. Las recetas taggeadas aparecen destacadas primero en el detalle de esa semana ("Recetas de esta semana") y con un chip "S6" en la sección Recetas.

### 4.4-bis Vista "Disponibilidad" (Gantt) — dentro de la dieta
Tercera sub-vista de una dieta, junto a Timeline y Vista general (**prototipada — replicar el prototipo**):
- **Eje X**: cada día del plan, una columna; cabecera con las semanas (S1…SN) coloreadas por fase; línea vertical "hoy".
- **Eje Y**: todos los ingredientes, agrupados por categoría; al final el grupo "Reintroducción" ordenado por bloque.
- **Barras**: base segura → disponible todo el plan (verde claro); ingredientes de reintroducción → vacío hasta su bloque, **4 días "en prueba"** (terracota), luego disponible (verde) si el bloque no falló; si el bloque está "con síntomas" → prueba en rojo y sin disponibilidad posterior.
- Deriva de los mismos datos que el timeline (`reintro_block_ingredients` + estados): cambiar fecha de inicio o estado de un bloque actualiza el Gantt.
- **Filtro de ingredientes** (búsqueda) dentro de la vista; tooltip por fila con el detalle ("entra con «Crucíferas»: prueba 08/09–11/09, tolerado").
- Scroll horizontal en móvil con la columna de ingredientes fija (sticky).

### 4.5 Gestión de dietas (CRUD)
- Planes: crear/editar/**duplicar** ("repetir este plan con nueva fecha de inicio"), archivar; cambiar fecha de inicio en cualquier momento (§4.1).
- Fases y bloques: editor dentro del plan (orden drag & drop no requerido en v1; basta subir/bajar).
- Tracking: nota rápida del día desde la pantalla principal.

### 4.6 Vista general + Export PDF (§6)

## 5. Diseño

**Referencia obligatoria: el prototipo HTML entregado junto a esta spec (`prototipo-timeline.html`). El resultado final debe verse como el prototipo.** Estética heredada del PDF de la nutricionista: cálida, editorial, mucho aire.

- **Paleta**: fondo crema `#FAF7F2`; tinta `#2E332E`; salvia (exclusión) `#7D9B76` / oscuro `#3F5741`; azul suave (probióticos) `#6B8CAE`; terracota (reintroducción) `#C68A4F`; neutro (mantenimiento) `#A39E93`; blanco tarjetas `#FFFFFF`; líneas `#E8E2D8`. Estados: tolerado `#5F8D5F`, con síntomas `#B85C48`.
- **Tipografía**: display serif (Cormorant Garamond o Playfair Display, self-hosted — sin CDNs externos en runtime) para títulos; sans (system-ui / Inter self-hosted) para cuerpo. Títulos con letter-spacing amplio tipo "p r o t o c o l o".
- **Componentes clave**: chips de fase redondeados; tarjetas con borde suave y sombra mínima; timeline como banda segmentada con marcador "HOY" (línea vertical + pill); listas de alimentos como tags/pills agrupadas por categoría con emoji; tiles de ingrediente con imagen circular; tarjetas de receta con badges de macros (kcal en badge oscuro destacado); barra de menú superior Dietas/Recetas/Ingredientes; mini-banda de fases en las tarjetas de dieta.
- **Móvil primero**: la usuaria lo usará sobre todo en el celular. Targets táctiles ≥44px, detalle de semana como bottom-sheet/pantalla completa.
- Accesibilidad: contraste AA, no comunicar fase solo por color (siempre etiqueta de texto).

## 6. Vista general + Export PDF

- Ruta `/plan/:id/resumen`: **vista compacta de todo el plan** — tabla/listado de todas las semanas con fechas, fase, novedades y en-prueba, más caja de "base segura" y caja de "a evitar". Optimizada para leer de un vistazo y para papel (1–2 A4).
- Botón **"Exportar PDF"**: genera un PDF server-side de esa vista (Playwright/Puppeteer/WeasyPrint, a elección del stack) y lo descarga. Debe funcionar desde el celular (descarga/share sheet).
- Botón "Imprimir" (print CSS de la misma vista) como alternativa rápida.

## 7. Auth y multi-usuario

- Email + contraseña (hash argon2/bcrypt), sesión con cookie httpOnly. Sin OAuth en v1.
- Var de entorno `REGISTRATION_OPEN=true|false`: si `false`, solo se puede crear usuario vía invitación (link generado por un usuario existente) — suficiente para "familia + nutricionista".
- Rate-limit básico en login. HTTPS asumido vía reverse proxy.

## 8. PWA

- `manifest.json` (nombre, iconos, standalone, theme color crema) + service worker.
- **Offline**: cachear shell + datos del plan activo (última sincronización) para consulta de solo lectura sin conexión. Las acciones de escritura requieren conexión (v1; sin cola offline).
- Indicador sutil de "sin conexión — mostrando última versión".

## 9. Deploy

- `Dockerfile` multi-stage + `docker-compose.yml` con: servicio app, volumen `./data:/data` (SQLite en `/data/app.db`), `PORT`, `SECRET_KEY`, `REGISTRATION_OPEN`.
- Migraciones automáticas al arrancar; **seed** (Apéndice A) con comando explícito (`npm run seed` o equivalente) que crea el plan demo para el primer usuario.
- README con: levantar en local, deploy en servidor, backup (copiar el archivo SQLite), restore.

### 9.1 Entorno de despliegue inicial (infra propia)

- **Host**: servidor local — VM en Proxmox que corre Docker.
- **Acceso**: `ssh root@docker` (Tailscale SSH; la ACL usa check mode — puede pedir re-autenticación en el navegador).
- **Layout en el servidor**: una carpeta dedicada para la app (`/root/containers/recipi/`) que contiene el código (clone de `https://github.com/martomarzo/recipi.git`) y, dentro, el volumen de datos `./data/` (SQLite `app.db` + `uploads/`). Backup = copiar la carpeta `data/`.
- **Flujo de deploy**: `git pull` + `docker compose up -d --build` dentro de esa carpeta; el seed se corre una sola vez con `docker compose exec app npm run seed` (o equivalente).
- **HTTPS**: dentro de la LAN puede ir en HTTP; si se expone hacia afuera, detrás de un reverse proxy con TLS (ver §2).
- **Tailscale**: el `docker-compose.yml` incluye un **sidecar de Tailscale** (`tailscale/tailscale`) que publica la app en el tailnet con HTTPS vía `tailscale serve` (`https://recipi.<tailnet>.ts.net`), sin reverse proxy propio. Config en `tailscale/serve.json`; requiere `TS_AUTHKEY` en `.env` la primera vez (estado persistido en `./data/tailscale`). El acceso por LAN sigue disponible en `http://IP:3000` (para login por HTTP plano poner `COOKIE_SECURE=false`).

## 10. Fuera de alcance v1

- Notificaciones push, recordatorios.
- Cola de escritura offline.
- Compartir públicamente / links de solo lectura.
- Cálculo nutricional (calorías/macros).
- Import automático de PDFs de nutricionista.

## 11. Criterios de aceptación

1. `docker compose up -d` + seed → login → veo el timeline del protocolo con las 11 semanas, colores por fase y marcador de hoy correcto.
2. Tap en Semana 6 desde el celular → veo: crucíferas en prueba 08–11/09, quinoa desde 12/09, permitidos (base + frutas nuevas y verduras crudas si toleradas), platos sugeridos.
3. Marco "Frutas nuevas" como tolerado → aparece en "ya reintroducidos" de las semanas siguientes.
4. Marco un bloque "con síntomas" y elijo reencolar → las fechas de los bloques siguientes se recalculan.
5. Cambio la fecha de inicio del plan → todo el timeline se recalcula.
6. "Exportar PDF" desde el resumen descarga un PDF legible de 1–2 páginas.
7. Instalo la PWA en el celular, apago el wifi → sigo viendo mi plan activo.
8. Duplico el plan con otra fecha de inicio → obtengo un plan nuevo idéntico, reutilizando ingredientes y recetas del catálogo.
9. Un segundo usuario no ve los planes del primero.
10. Desde el menú general navego entre Dietas, Recetas e Ingredientes; la lista de dietas muestra tarjetas con mini-banda de fases y progreso.
11. Creo un ingrediente nuevo con imagen y valores nutricionales → lo uso en una receta con gramos → la receta muestra kcal y macros sumados correctamente; edito los gramos y los totales se actualizan.
12. Cambio la fecha de inicio desde el input en el header del plan → semanas, fases y bloques se recalculan al instante (mismo comportamiento que el prototipo).
13. Busco y filtro ingredientes por categoría; las tarjetas muestran imagen y valores por 100 g.
14. Cambio la foto de un ingrediente existente → se actualiza en catálogo, recetas y detalle.
15. Taggeo una receta a la Semana 6 de mi dieta → aparece primero en el detalle de esa semana y con chip "S6" en Recetas.
16. En la dieta abro la vista "Disponibilidad" → veo el Gantt con días en X e ingredientes en Y; marco un bloque "con síntomas" y su fila corta la disponibilidad; cambio la fecha de inicio y todo se desplaza (igual que el prototipo).
17. En Recetas busco "brócoli" → veo las recetas que lo usan y desde cuándo está disponible en mi dieta activa.

---

## Apéndice A — Seed: "Protocolo Intestinal — Agosto 2026"

**Plan**: nombre "Protocolo Intestinal", inicio **2026-08-03** (lunes), activo.

### A.1 Fases

| # | Fase | Tipo | Días (offset desde inicio) | Color | Descripción |
|---|---|---|---|---|---|
| 1 | Exclusión | exclusion | 0–20 (semanas 1–3, 03/08–23/08) | salvia | Reducir inflamación y reparar barrera intestinal eliminando irritantes |
| 2 | Probióticos | probioticos | 21–27 (semana 4, 24/08–30/08) | azul | Misma dieta de exclusión + probióticos (ej. Bonusan Bacteri 17 Resilience Pro, 1 sobre después de comer) |
| 3 | Reintroducción | reintroduccion | 28–71 (31/08–13/10) | terracota | Reintroducir alimentos de a uno, regla de los 4 días |
| 4 | Mantenimiento | mantenimiento | 72+ (desde 14/10) | neutro | Dieta ampliada con lo tolerado |

**Reglas diarias (todas las fases)**: máximo 3 ingestas/día (Complejo Motor Migratorio); cena temprana ≥3 h antes de dormir y ligera (salvo guardia); mantener "Gut Day" antes de las comidas durante todo el protocolo.

### A.2 Alimentos base seguros (permitidos en TODAS las fases)

- **Proteínas**: arenque, sardina, salmón, caballa, bacalao (pescados blancos y azules), pollo, pavo, carne vacuna, huevos, almejas, mejillones, pulpo.
- **Grasas saludables**: aceite de oliva, palta, aceite de coco, nueces de Brasil, macadamias, avellanas, almendras remojadas.
- **Vegetales cocidos**: calabacín (sin piel ni semillas), calabaza, canónigos, berenjena, espárragos, espinaca, hortalizas de raíz (ej. rábano), pimientos, puerro, rúcula, tomate, zanahoria, zapallo.
- **Tubérculos y arroz**: boniato, papa, yuca, arroz.
- **Frutas de baja carga glucémica**: arándanos, moras, frambuesas, fresas, limón, coco.
- **Otros**: hongos/champiñones; jengibre, cúrcuma, canela, té verde; caldo de huesos.

### A.3 A evitar (fases 1–2, y todo lo aún no reintroducido en fase 3)

- **Lácteos** de todo tipo (vaca, cabra, oveja): leche, queso, yogur, kéfir.
- **Gluten y cereales**: trigo, centeno, cebada, avena (en primera fase).
- **Legumbres**: alubias, lentejas, garbanzos, soja/tofu.
- **Ultraprocesados y aditivos**: glutamato monosódico, sulfitos, edulcorantes (sacarina, ciclamato, acesulfame K, aspartamo).
- **Azúcares**: azúcar blanco, harinas refinadas, gaseosas, jugos industriales, fructosa añadida.
- **Grasas de mala calidad**: aceites vegetales refinados (girasol, maíz), margarinas, grasas trans.

### A.4 Bloques de reintroducción (cada uno 4 días, inicio 31/08/2026)

| # | Alimento | Emoji | Fechas | Tips |
|---|---|---|---|---|
| 1 | Frutas nuevas (fibra soluble) | 🍎 | 31/08–03/09 | Manzana o pera cocida/asada; frutas con algo más de fructosa |
| 2 | Verduras crudas y hojas verdes | 🥗 | 04/09–07/09 | Incorporar paulatinamente; incluye alcaucil cocido |
| 3 | Crucíferas | 🥦 | 08/09–11/09 | Brócoli, coliflor, etc., bien cocidas al inicio |
| 4 | Quinoa | 🌾 | 12/09–15/09 | Pseudocereal sin gluten; poca cantidad, bien cocida |
| 5 | Trigo sarraceno | 🥞 | 16/09–19/09 | Pseudocereal sin gluten; poca cantidad, bien cocido |
| 6 | Avena sin gluten | 🥣 | 20/09–23/09 | Certificada sin gluten |
| 7 | Legumbres: lentejas | 🫘 | 24/09–27/09 | Remojadas y muy bien cocidas (reducir antinutrientes) |
| 8 | Fermentados | 🫙 | 28/09–01/10 | Chucrut/kimchi, cantidades chicas |
| 9 | Lácteos de cabra/oveja | 🐐 | 02/10–05/10 | Empezar por quesos duros/curados |
| 10 | Gluten | 🍞 | 06/10–09/10 | Espelta / masa madre. Solo si asintomática |
| 11 | Lácteos de vaca | 🥛 | 10/10–13/10 | Queso duro → yogur/kéfir → leche. Solo si asintomática |

**Reglas de reintroducción** (mostrar en la UI de fase 3): un solo alimento nuevo a la vez; consumirlo 4 días seguidos empezando con cantidad mínima y aumentando; observar gases, calor en piel, cambios de tránsito; **no introducir un alimento nuevo tras una noche de guardia sin dormir** (falso positivo); ante reacción, retirar el alimento y volver al último punto bien tolerado. El orden de gluten y lácteos de vaca es intercambiable.

### A.4-bis Valores nutricionales e ingredientes (seed)

El catálogo completo de ~64 ingredientes con sus valores nutricionales aproximados por 100 g, y las ~27 recetas con cantidades en gramos, están **embebidos como datos JS en el prototipo** (`prototipo-timeline.html`, constantes `ING`, `CATS` y `RECETAS`). **Migrar esos datos tal cual al seed de la base de datos** — son la fuente de verdad, no reescribirlos. Los valores son aproximados y así deben etiquetarse en la UI.

### A.5 Platos sugeridos (seed)

**Base (fases 1–4, siempre válidos):**

| Plato | Tipo | Ingredientes principales |
|---|---|---|
| Tortilla de huevos con champiñones y espinaca | desayuno | huevos, champiñones, espinaca, aceite de oliva |
| Bowl de frutos rojos con coco y avellanas | desayuno | arándanos, frambuesas, coco, avellanas |
| Huevos revueltos con palta y tomate asado | desayuno | huevos, palta, tomate |
| Salmón al horno con puré de calabaza | comida | salmón, calabaza, aceite de oliva |
| Pollo al limón con boniato asado y zanahorias | comida | pollo, limón, boniato, zanahoria |
| Wok de carne con pimientos, calabacín y arroz | comida | carne vacuna, pimientos, calabacín, arroz, jengibre |
| Sardinas con tomate y puerro asados | comida | sardina, tomate, puerro, papa |
| Mejillones al vapor con limón y papas | comida | mejillones, limón, papa |
| Bacalao con puré de boniato y espárragos | comida | bacalao, boniato, espárragos |
| Berenjenas rellenas de pavo | comida | berenjena, pavo, tomate, cúrcuma |
| Caldo de huesos con verduras de raíz y jengibre | cena | caldo de huesos, zanahoria, rábano, jengibre |
| Crema de calabaza y zanahoria con cúrcuma | cena | calabaza, zanahoria, cúrcuma, aceite de coco |
| Tortilla francesa con canónigos | cena | huevos, canónigos, aceite de oliva |

**Por bloque de reintroducción:**

| Bloque | Plato sugerido |
|---|---|
| Frutas nuevas | Manzana asada con canela y coco · Compota de pera con jengibre |
| Verduras crudas | Ensalada de canónigos, zanahoria rallada y palta con limón |
| Crucíferas | Brócoli al vapor con aceite de oliva y limón · Coliflor asada con cúrcuma |
| Quinoa | Quinoa bien cocida con verduras asadas · Ensalada tibia de quinoa y pollo |
| Trigo sarraceno | Panqueques de trigo sarraceno con arándanos |
| Avena sin gluten | Porridge de avena con frutos rojos y canela |
| Lentejas | Guiso de lentejas (remojadas) con calabaza y zanahoria |
| Fermentados | Cucharada de chucrut acompañando la comida principal |
| Lácteos de cabra | Queso curado de cabra en pequeña cantidad |
| Gluten | Tostada de pan de espelta masa madre con palta |
| Lácteos de vaca | Queso duro curado → yogur → leche (en ese orden) |

### A.6 Extra opcional (v1.1): rutinas de biorritmo

El protocolo incluye dos rutinas de día (post-guardia / día normal) con horarios de melatonina, luz solar, ejercicio y cena temprana. No son parte del timeline de alimentos; si se implementa, mostrarlas como página estática de referencia dentro del plan.

---

## 12. Estado de implementación (08/08/2026)

**v1 completa y en producción.** Stack elegido: Next.js 14 (App Router) + TypeScript + Tailwind + Prisma 5 + SQLite. Deploy según §9.1: `https://recipi.peacock-snapper.ts.net` (tailnet) / `http://docker:3000` (LAN), con CD por systemd timer (push a `main` → deploy automático en ~3–5 min).

**Verificación**: los 17 criterios de §11 pasados el 08/08/2026 (fechas del seed exactas al Apéndice A; macros al gramo; aislamiento entre usuarios; PDF de 2 páginas). Pendiente de verificación humana: PWA offline en el celular y QA visual contra el prototipo.

**Decisiones de implementación** (complementan §2, no reabrir sin motivo):
- Ninguna fecha de fase/bloque se persiste: todo deriva de `startDate` + duraciones (`src/lib/plan.ts`); la fase de reintroducción dura la suma de sus bloques; reencolar = reordenar `sort`.
- §10 decía "sin cálculo nutricional" — línea obsoleta: los macros SÍ están (exigidos por §3.1/§4.4/criterio 11). El catálogo real es de 62 ingredientes (el "~64" era aproximado).
- "A evitar" del seed: filas de `phase_ingredient_rules` con ambos FK null y el texto en `note` (markdown).
- `dish_suggestions` con solo `diet_id` = "válido todo el plan"; `week_number` rinde chip "S{N}" y ordena primero en esa semana.
- Recetas: `PATCH` es reemplazo completo (herencia de Recipi). Importación por link: JSON-LD de schema.org → parser Claude (`ANTHROPIC_API_KEY`) → parser regex; líneas sin mapear quedan en `parsed_json`.
- Import con IA (08/08/2026): los ingredientes sin mapear se pueden crear en un clic con **macros estimados por Claude** (`POST /api/ingredientes/estimar`); reusa existentes por nombre normalizado y marca los nuevos con `notes` "Valores estimados con IA — revisar". Modelo económico `claude-haiku-4-5` (≈ USD 0,001 por import), sobreescribible con `ANTHROPIC_MODEL`; si el id configurado no existe (404), parser y estimador reintentan con el default (`src/lib/recetas/anthropicModel.ts`) en vez de fallar en silencio.
- Imágenes subidas en `data/uploads` (servidas por route handler, no `public/`); `data/` concentra TODO lo persistente (SQLite, uploads, estado tailscale).
- Extra heredado de Recipi (fuera de spec, requerido por Marto): importar recetas por link/texto + timers interactivos en los pasos.
- A.6 (rutinas de biorritmo) no implementado.
- App renombrada a **"Recipi"** (08/08/2026, pedido de Marto): wordmark, manifest PWA, cookie de sesión (`recipi_session`), nombre del PDF. La marca original de Recipi (tenedor + cuchara sobre ámbar `#D97706`) vuelve como logo del header (`src/components/Logo.tsx`), favicon (`src/app/icon.tsx`) e iconos PWA. El nombre del plan seed ("Protocolo Intestinal") no cambia.
- Gestión de usuarios en `/usuarios` (extra sobre §7, sin roles): cualquier usuario logueado puede crear otro directamente (nombre/email/contraseña vía `POST /api/usuarios`) o generar un link de invitación (UI para `/api/auth/invite`). También editar nombre/email/contraseña de cualquier usuario (`PATCH /api/usuarios/[id]`; cambiar una contraseña cierra las demás sesiones de ese usuario) y eliminarlo (`DELETE`, con confirmación en UI: borra sus dietas en cascada, sus recetas pasan al catálogo global; no permite auto-borrarse, garantizando ≥1 usuario con acceso).
- **Dietas compartibles** (08/08/2026): tabla `DietShare` con rol por share — `viewer` (solo lectura: timeline, Gantt, resumen, PDF) o `editor` (todo menos activar/archivar/borrar/compartir, que quedan en el dueño). Acceso centralizado en `src/lib/dietAccess.ts`; `loadDiet` expone `role` y las vistas ocultan la edición a viewers (el server igual rechaza: writes sin permiso → 404, owner-only como editor → 403). Shares se administran desde el editor de la dieta (`PUT /api/dietas/[id]/shares`, full-replace, solo dueño). Duplicar admite cualquier dieta visible (la copia es de quien duplica); sugerencias de recetas solo hacia dietas escribibles; `loadActiveDiet` (disponibilidad en Recetas) sigue siendo solo la dieta activa propia.

**Cuentas**: seed crea `demo@protocolo.local` / `protocolo123` si no hay usuarios (cambiar la contraseña). Registro por invitación (`REGISTRATION_OPEN=false` en producción).
