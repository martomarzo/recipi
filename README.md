# Recipi 🍳

A self-hosted personal recipe collection. Its standout feature is **paste-to-parse**: paste raw recipe text from anywhere (a website, a note, a photo transcription) and Recipi turns it into structured ingredients and step-by-step instructions — with **interactive cooking timers** automatically detected in each step.

## Features

- **Paste-to-parse** — paste any recipe text and get structured ingredients + steps.
- **AI parsing with graceful fallback** — uses the Claude API when configured; falls back to a built-in regex parser when no API key is set or the API call fails.
- **Interactive timers** — time phrases like "bake for 30 minutes" are detected per step and rendered as start/pause/reset countdown widgets.
- **Image uploads** — attach a photo to each recipe (validated, 10 MB limit, persisted in a Docker volume).
- **Star ratings** — rate recipes 1–5; averages shown on cards and detail pages.
- **Edit & re-parse** — update any recipe, with the option to re-parse the original text.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, React 18, standalone output) |
| Language | TypeScript 5 (strict mode) |
| Styling | Tailwind CSS 3 (warm amber theme) |
| Database | PostgreSQL via Prisma 5 |
| AI | `@anthropic-ai/sdk` (Claude API, optional) |
| Deployment | Docker (multi-stage build); external Postgres |

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database
- (Optional) An [Anthropic API key](https://console.anthropic.com/) for AI-powered parsing

### Local development

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# edit .env with your DATABASE_URL (and optionally ANTHROPIC_API_KEY)

# 3. Run database migrations
npm run db:migrate

# 4. Start the dev server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. |
| `NEXT_PUBLIC_BASE_URL` | Yes | Base URL the server uses for its own internal API fetches. **Must match the deployed host** (e.g. `http://192.168.1.x:3000`) or server-rendered pages will 500. |
| `ANTHROPIC_API_KEY` | No | Enables AI parsing. Without it, the regex fallback parser is used. |
| `ANTHROPIC_MODEL` | No | Claude model for parsing. Defaults to `claude-haiku-4-5`. Options: `claude-haiku-4-5` (fast/cheap), `claude-sonnet-4-6` (balanced), `claude-opus-4-7` (best). |

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server. |
| `npm run build` | Generate the Prisma client and build for production. |
| `npm run start` | Start the production server. |
| `npm run lint` | Run Next.js lint. |
| `npm run db:migrate` | Create/apply a migration (development). |
| `npm run db:deploy` | Apply migrations (`prisma migrate deploy`, for production). |
| `npm run db:studio` | Open Prisma Studio. |

## Deployment (Docker)

Recipi ships as a single-container app that connects to an **external** Postgres database (none is bundled).

```bash
# 1. Configure .env (set NEXT_PUBLIC_BASE_URL to the host's real IP/hostname)
# 2. Apply migrations against the production DB
npm run db:deploy
# 3. Build and start
docker compose up -d --build
```

- Image uploads are stored in `public/uploads/`, persisted via a named Docker volume (`uploads`) so they survive container restarts.
- The container runs as a non-root `nextjs` user.
- If the Prisma client seems stale, rebuild with `docker compose build --no-cache`.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── parse/route.ts          # Parse raw text → structured recipe (Claude or fallback)
│   │   ├── recipes/route.ts        # List / create recipes
│   │   ├── recipes/[id]/route.ts   # Get / update / delete a recipe
│   │   ├── ratings/route.ts        # Submit a star rating
│   │   └── upload/route.ts         # Image upload
│   ├── recipes/
│   │   ├── new/page.tsx            # Add recipe
│   │   ├── [id]/page.tsx           # Recipe detail
│   │   └── [id]/edit/page.tsx      # Edit recipe
│   ├── page.tsx                    # Home (recipe grid)
│   ├── layout.tsx                  # App shell + header
│   └── icon.tsx                    # Favicon (Next.js ImageResponse)
├── components/                     # RecipeForm, RecipeCard, StepTimer, StarRating, etc.
├── hooks/useTimer.ts               # useReducer-based countdown timer
├── lib/
│   ├── claudeParser.ts             # Claude API parsing (with prompt caching)
│   ├── parser.ts                   # Regex fallback parser
│   ├── timeParser.ts               # Extracts timer durations from step text
│   └── prisma.ts                   # Prisma client singleton
└── types/recipe.ts                 # Shared TypeScript types
prisma/schema.prisma                # Recipe, Ingredient, Step, Rating models
```

## How Parsing Works

1. The client sends raw text to `POST /api/parse`.
2. If `ANTHROPIC_API_KEY` is set, the text is sent to Claude with a system prompt that returns structured JSON (and keeps timing phrases inside step text so timers can be detected later). On any failure, it falls back automatically.
3. The fallback `parser.ts` uses section-heading detection and regex (handling unicode fractions like ½, ¾) to extract ingredients and steps.
4. The response includes an `aiParsed` flag indicating which path was used.
5. On the recipe detail page, `timeParser.ts` scans each step for time phrases and renders an interactive countdown timer where found.

## Notes

- **Single-user** — there is no authentication; Recipi is designed as a private, personal collection.
- **Edits are destructive replaces** — updating a recipe deletes and recreates its ingredients and steps (positions reset), so their database IDs are not stable across edits. The original pasted text (`rawText`) is always retained for re-parsing.
