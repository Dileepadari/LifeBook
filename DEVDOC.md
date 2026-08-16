# LifeBook - Developer Documentation

Technical reference for the LifeBook codebase: architecture, auth model, data model, the AI layer, API surface, and setup/deployment. For what the app does from a user's point of view, see [README.md](./README.md).

## Table of contents

- [Tech stack](#tech-stack)
- [Architecture overview](#architecture-overview)
- [Auth model](#auth-model)
- [The API](#the-api)
- [Data model](#data-model)
- [The AI layer](#the-ai-layer)
- [The insight engine](#the-insight-engine)
- [Theming system](#theming-system)
- [Charts](#charts)
- [Frontend structure](#frontend-structure)
- [Environment variables](#environment-variables)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Where the product came from](#where-the-product-came-from)
- [Known constraints and gotchas](#known-constraints-and-gotchas)

## Tech stack

**Frontend** - React 19, Vite 5, TypeScript, Tailwind v4 (no JS config; tokens live in `src/index.css`), shadcn/ui on Radix, TanStack Query, React Router 6, Recharts, framer-motion, dnd-kit, sonner. Path alias `@/` → `src/`.

**Backend** - Node 20+, Express 4, better-sqlite3 (synchronous, single file), bcryptjs, jsonwebtoken, multer. Plain ESM JavaScript, no build step.

**AI** - `@anthropic-ai/sdk` for Claude; Gemini over plain `fetch`. Both optional.

## Architecture overview

```
┌────────────────────────┐
│  React SPA  (:8082)    │
│  src/lib/api.ts is the │
│  only place fetch()    │
│  is called             │
└───────────┬────────────┘
            │  /api/*  (vite proxies in dev; same origin in prod)
            ▼
┌────────────────────────┐        ┌──────────────────────────┐
│  Express  (:4000)      │───────▶│  SQLite                  │
│  routes/ + auth.js     │        │  server/data/*.sqlite    │
│  analytics.js          │        └──────────────────────────┘
│  badges.js             │
│  ai/                   │──┬────▶ Anthropic  (optional)
└───────────┬────────────┘  └────▶ Gemini     (optional)
            │
            ▼
      uploads/<user-id>/   (static, served by the same process)
```

One process serves the API; in production it also serves the built SPA, so a deployment is `npm run build && npm start`. There is no CORS handling anywhere because there is never a cross-origin request.

## Auth model

Hand-rolled, matching the pattern in `workos` and `moneyos`: bcrypt password hashes plus a self-issued HS256 JWT. No third-party auth provider.

- `server/auth.js` owns hashing, signing, `publicUser()` (which strips `password_hash`), and the `requireAuth` middleware.
- The signing secret comes from `LIFEBOOK_JWT_SECRET`. **If unset, one is generated and persisted to `server/data/.jwt-secret`** - without persisting it every restart would silently invalidate all sessions, which reads as a bug rather than a security posture. Set it explicitly for a real deployment.
- Tokens last 30 days. `src/lib/authToken.ts` decodes (but never verifies) the token client-side purely to avoid a guaranteed-401 round trip on cold load; verification is always server-side.
- **Ownership is enforced in the route layer and nowhere else.** SQLite has no row-level security, so every query filters on `req.user.id`. There is no second line of defence here - a route that forgets the filter is a data leak. This is the single most important invariant in the codebase.

## The API

`src/lib/api.ts` is the only module that calls `fetch`. It wraps everything in `call()` / `jsonCall()`, which attach the bearer token, clear it and throw a readable error on 401, and unwrap `{ error }` bodies.

Two shapes of endpoint:

**The generic gateway** - `POST /api/data` takes `{ table, operation, payload, id, filters, order, limit }` and handles plain CRUD for the tables in its allowlist, with the fixed `list` / `create` / `update` / `remove` vocabulary. Column names in filters and ordering are checked against a per-table allowlist before interpolation; values are always bound.

**Named routes** - anything with a side effect gets its own route and is deliberately absent from the gateway allowlist:

| Route | Why it is not on the gateway |
|---|---|
| `POST /api/lifebook/pages/:date/generate` | Reads a dozen tables and calls a provider |
| `POST /api/lifebook/pages/:date/seal` | The one write meant to be permanent |
| `POST /api/study/cards/:id/review` | Next due date is computed by SM-2 from the card's state |
| `POST /api/study/quizzes/:id/attempt` | Scores server-side; answers must not reach the client early |
| `POST /api/day/habits/:id/toggle` | Computes the streak and may award a badge |
| `POST /api/day/challenges/:id/checkin` | May complete an enrollment and award a badge |
| `PUT  /api/day/wellness/:date` | Upsert, one row per day |
| `POST /api/study/resources/upload` | Writes to disk |
| `POST /api/assistant/parse` | Calls a provider; returns a proposal and writes nothing |
| `POST /api/assistant/apply` | Writes across five tables in one transaction |
| `POST /api/assistant/undo` | Reverses a specific apply by row id |

Quiz answers are withheld from `GET /api/study/quizzes/:id` and only returned with the attempt result - otherwise the answers sit in the network tab of the page taking the test.

## Data model

`server/schema.sql` is the whole schema and is entirely `CREATE ... IF NOT EXISTS`, applied on every boot. That doubles as the migration story for additions; column *changes* still need a hand-written `ALTER`.

Roughly thirty tables in six groups:

- **Identity** - `users`, `profiles` (onboarding answers and targets), `settings` (theme, AI provider/key/model, notification prefs).
- **Capture** - `tasks`, `study_sessions`, `wellness_logs`, `moods`, `journal_entries`, `habits` + `habit_logs`, `challenge_enrollments` + `challenge_progress`.
- **Study material** - `resources`, `decks`, `flashcards` (SM-2 fields), `mind_maps`, `quizzes` + `quiz_questions` + `quiz_attempts`.
- **The book** - `lifepages` (one per user per day, `UNIQUE(user_id, date)`), `print_orders`.
- **Shared catalogs** (`user_id IS NULL` or no `user_id`) - `challenges`, `badges`, `motivation_items`, `feed_posts`, `support_resources`. Seeded idempotently from `server/seed.js` with stable ids.
- **Social** - `saved_posts`, `saved_motivation`, `goal_visions`, `sos_contacts`, `notifications`.

**Dates are `YYYY-MM-DD` text in the user's local day, not UTC timestamps.** A LifePage is a *day in someone's life*; a UTC boundary would split an evening study session across two pages for anyone east of London. `today()` in `server/db.js` and `todayStr()` in `src/lib/format.ts` must agree.

## The AI layer

`server/ai/index.js` is the dispatcher. Resolution order for a user: their explicit choice in Settings → their saved key → the process env key → `builtin`.

```
generateLifePage / generateInsights / generateFlashcards
  / generateQuiz / generateMindMap / coachChat / parseDayBrief
        │
        ├─ anthropic.js   claude-opus-5, adaptive thinking, effort: medium,
        │                 output_config.format for JSON, refusal-aware
        ├─ gemini.js      generateContent, responseSchema (OpenAPI-flavoured)
        └─ deterministic.js   no network, always available
```

**Every capability has all three implementations behind one interface, and any provider failure falls back to `deterministic`.** The provider that actually produced a result is returned alongside it and stored on the row, so a page always says who wrote it and the UI can be honest about degradation instead of pretending the key worked.

Shared prompts and JSON schemas live in `server/ai/prompts.js` so switching provider changes the voice, never the shape. Gemini's `responseSchema` is OpenAPI-flavoured rather than full JSON Schema - it rejects `additionalProperties` and expresses nullability as `nullable: true` - so `gemini.js` translates the shared schemas rather than maintaining a second copy.

### The day assistant

`parseDayBrief` is the one capability whose output becomes *rows* rather than prose, so it is split across two routes on purpose. `/assistant/parse` calls the provider and returns a proposal without writing anything; `/assistant/apply` writes it and returns an undo token listing every id it created or changed. That split is what makes auto-apply defensible: the client can write immediately, show exactly what it wrote, and reverse it precisely rather than asking the user to hunt five tables.

Mapping decisions, all in `server/routes/assistant.js`:

- `completed` becomes tasks already `done` with `completed_at` set, so finished things count toward the completion tile and show up on the page as achievements.
- `missed` becomes still-open tasks at `important` priority. "Didn't get to X" *is* a backlog item; dropping it on the floor would be the wrong reading.
- `wellness` upserts only the fields actually mentioned - `cleanNumbers()` drops nulls and non-numerics so an unmentioned field never overwrites a real logged value with 0.
- `journal` **appends** to the day's reflection rather than replacing it; the user may already have written something.

**Reconciliation happens after the provider returns, in `reconcile()`, so all three engines behave identically.** It does two things, both about not being destructive:

- *Duplicates become updates.* `matchTask()` compares stemmed, stop-worded keyword sets and requires at least two shared words scoring 0.5 against the smaller set. A `completed` phrase that matches an open task closes that task instead of inserting a second one; a `tasks` entry that already exists is dropped; a `missed` entry that already exists is only bumped to `important`. The crude stemmer is load-bearing - "Revise thermodynamics" and "finished revising thermodynamics" share exactly one unstemmed word and would never match.
- *Overwrites become questions.* A wellness field already logged for the day with a materially different value, or a second study session, goes into `proposal.conflicts` with `decision: null`. `/apply` returns **409** if any decision is still null, and skips the fields whose decision is `keep`. Partial writes are worse than refusing, so it refuses the whole apply.

Two grounding guards exist because models fill schemas rather than admitting absence. `cleanNumbers()` only accepts a wellness field if `WELLNESS_EVIDENCE` finds the subject raised in the message - Gemini 2.5 Flash answers 0 for every field it was not told about, and 0 is a measurement, not a null. `groundedSubject()` only accepts a study subject whose words appear in the message, because given "I studied for two hours" and a context full of past sessions the model will confidently name last week's subject.

Conversation history (last 8 turns, client-held) is passed to `dayBriefPrompt`. Only the newest message is extracted from; the rest is there so corrections resolve. The built-in engine ignores it.

The deterministic implementation is the interesting one, because it has to do this without a model. It splits on sentence boundaries *and* on conjunctions (`didn't do X and never did Y` is two items), then classifies each clause. The guard worth knowing about is `WELLNESS_ONLY`: a sentence like "slept about 5 hours and skipped breakfast" is already fully captured as wellness numbers, so it must not *also* be filed as a missed task - unless it contains a genuinely actionable noun too. Sentences still carry their terminating punctuation at that point, which the regex has to allow for.

The key is stored server-side in `settings.ai_key` and is **write-only from the browser's perspective**: `GET /api/auth/settings` returns `has_ai_key` and a masked hint, never the value. It is also excluded from the JSON export.

## The insight engine

`server/analytics.js` is the single source of truth for "what actually happened". Both the deterministic engine and the LLM providers are handed the output of `daySnapshot()` or `rangeAnalytics()` and nothing else - which is what keeps a Claude-written page and a built-in page describing the same day rather than two different ones.

Things worth knowing:

- **Correlations use the *previous* night's sleep against the day's focus.** Sleeping badly tonight cannot affect this morning's session. Pearson, and `null` under four paired points rather than a meaningless number from two.
- `healthPoints()` is a weighted composite against the user's *own* targets (sleep 30, exercise 20, water 15, screen time 15, mindfulness 10, breakfast 10). `src/pages/Wellness.tsx` mirrors it locally so the number does not sit at 0 until the first save round-trips - **if you change the weights, change both.**
- `habitStreak()` does not count today's missing check-in as a break until the day is over.
- Badge rules are data, not code: each row in `badges` names a rule and a threshold, and `server/badges.js` knows how to measure each rule. Adding a badge is a seed row.

## Theming system

Adapted from `moneyos`. Light/dark plus seven accent palettes, all `localStorage`-only (keys `lifebook-theme`, `lifebook-palette`, `lifebook-custom-*`).

Tokens are bare HSL triples in `@layer base` in `src/index.css`; `@theme inline` maps them onto Tailwind colour utilities. `ThemeContext` writes `--primary`, `--ring` and `--accent` as inline styles on `<html>` - it does not swap classes. The default palette is **violet**, tuned to the ADK Dev brand mark `#47266B`.

Two token families beyond stock shadcn:

- `--success` / `--warning`, as in the other house apps.
- `--paper` / `--paper-foreground` / `--paper-edge`, used by `.page-surface` for book surfaces (Welcome, LifePage, LifeBook, print view, journal). Deliberately **outside** the accent system: the shell can be any colour the user picks, but a page of a book is always paper. In dark mode paper goes warm-dark rather than inverted - a lit page at night, not a negative.

`.logo-mono` applies `brightness(0)` in light and `brightness(0) invert(1)` in dark, so the single purple PNG reads against any theme. Do not ship a second recoloured file.

## Charts

`src/lib/chartTheme.ts` holds a **fixed four-slot categorical palette that is independent of the user's accent**. A series colour has to mean "this is sleep" consistently; repainting series when someone switches the shell to Rose would break identity. Single-series charts do use the accent, because there is no identity to confuse.

The palette was validated against this app's real surfaces (light `#ffffff`, dark `#181221`) on the adjacent pairlist: light CVD ΔE 9.1 / normal-vision 22.9; dark CVD ΔE 8.4 / normal-vision 19.8, all dark slots ≥ 3:1. Two light-mode slots fall below 3:1 contrast, so the **relief rule** applies and is discharged deliberately: every multi-series chart ships a legend and a named-value tooltip, and Analytics carries a full table view. Identity is never colour-alone.

**Four slots is the cap.** A fifth puts yellow beside orange, which fails the all-pairs floor. If a chart needs more series, facet instead of extending the palette.

## Frontend structure

```
src/
  main.tsx              createRoot + StrictMode
  App.tsx               providers, route table, RequireAuth + RequireOnboarding
  index.css             tokens, base layer, book surfaces, print rules, .logo-mono
  assets/logo-mark.png  the ADK Dev mark
  pages/                one file per route, PascalCase, default export
  components/
    ui/                 shadcn primitives, kebab-case (generated; don't hand-edit)
    assistant/          DayAssistant - the corner orb and its panel
    layout/             AppShell, NotificationsBell
    lifebook/           LifePage (shared by screen and print), GeneratePageButton
    study/              StudyTimer, FlashcardReview, GenerateStudio, MindMapView
    dashboard/          StatTile, HabitGrid, CoachChat
    skeletons/          loading states
  contexts/             AuthContext, ThemeContext
  hooks/useLifeData.ts  every TanStack Query hook, one shared invalidation helper
  lib/                  api.ts, authToken.ts, format.ts, chartTheme.ts, utils.ts
```

All types live in `src/lib/api.ts` next to the client that returns them; there is no `types/` directory.

`useInvalidate()` in `useLifeData.ts` exists because almost every write changes a number the Dashboard, the LifePage and the badge engine all read. Rather than remembering that at thirty call sites, every mutation funnels through it.

Motion is `framer-motion` plus the CSS keyframes in `index.css`, and all of it is decorative - the DOM is complete before any animation runs. `useReducedMotion()` is honoured in components; the `prefers-reduced-motion` media query covers the CSS.

## Environment variables

### Frontend (Vite)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Only needed if the SPA and API are on different origins. In dev it is unset and `vite.config.ts` proxies `/api` to `:4000`. |

### Backend only - never put these in a Vite variable

Anything prefixed `VITE_` is compiled into the public bundle. These must not be.

| Variable | Purpose |
|---|---|
| `LIFEBOOK_JWT_SECRET` | Session signing secret. Generated and persisted to `server/data/.jwt-secret` if unset. |
| `PORT` | API port, default 4000. |
| `LIFEBOOK_DB` | SQLite path, default `server/data/lifebook.sqlite`. |
| `ANTHROPIC_API_KEY` | Optional fallback Claude key for all users. A per-user key in Settings wins. |
| `GEMINI_API_KEY` | Optional fallback Gemini key. Same precedence. |

## Local development

```sh
npm install
npm run dev          # API on :4000 and Vite on :8082, together
```

Ports are per-app across this repo family: `workos` 8080, `moneyos` 8081, LifeBook 8082, so all three can run at once.

Verification:

```sh
npm run lint
npm run typecheck
npm run build
npm run preview
```

To reset to a clean database, delete `server/data/` - the schema and all seed catalogs are recreated on next boot.

## Deployment

```sh
npm run build
LIFEBOOK_JWT_SECRET=... npm start
```

`server/index.js` serves `dist/` when it exists and falls through to `index.html` for any non-`/api`, non-`/uploads` path, so the SPA's client-side routes work on a hard refresh. `vercel.json` is present for the frontend-only case, but note the API and the uploads directory need a persistent host - Vercel alone is not sufficient for the whole app.

Back up `server/data/` and `uploads/`. That is the entire application state.

## Where the product came from

The 2024 Design Thinking report and poster:

```
/media/cherry/Expansion/Delhi/PopOs/Documents/delhi_pc/Downloads/
  DT_project_LifeBook_2022101007_2024204002_2024204010/
```

- Figma design: `figma.com/design/OGjGTtKX8SyGjfpgMKkMQL/DesignThinking-LifeBook`
- Figma prototype: `figma.com/proto/OGjGTtKX8SyGjfpgMKkMQL/DesignThinking-LifeBook?node-id=1-3`
- Notion (questionnaires, interview profiles): `notion.so/Design-Thinking-13549a65f88e802b8fced2be416e2e25`

The seeded challenge catalog, the three onboarding personas, the feed digests and the persona starter-habit sets are all taken from that report rather than invented. If you change them, change them against the research.

## Known constraints and gotchas

- **Route-layer ownership is the only authorization.** SQLite has no RLS. Every query filters on `req.user.id`; a forgotten filter is a data leak with nothing behind it. Treat any new query touching a user-owned table as security-relevant.
- **A sealed page refuses regeneration.** `POST .../generate` on a sealed page returns 409 unless `force` is passed. This is deliberate: the book is a record, and silently rewriting a day someone already read is worse than an error. The UI offers an explicit Unseal with a warning rather than hiding the escape hatch.
- **Client-supplied MIME types are not trusted.** curl and several browsers send `application/octet-stream` for a plain `.md`. `extractText()` in `server/routes/study.js` uses three signals - MIME, file extension, and a content sniff for NUL bytes and control-character density - and stores nothing rather than mojibake. This was a real bug: `.md` uploads were silently not indexed, which made the AI generators refuse perfectly good files.
- **`hours()` is not for prose.** It renders a 40-minute session as "0 hours", which reads as though nothing happened. `dur()` in `server/ai/deterministic.js` speaks minutes under an hour; use it for any user-facing sentence. Also a real bug, caught in browser testing.
- **Testing an unsaved AI key.** Settings sends the typed key with the test request, and `testConnection()` uses it even when the provider is `auto` (inferring Anthropic vs Gemini from the key prefix). An earlier version fell through to saved settings and reported "no key needed" while the user stared at a key they had just typed.
- **Provider errors are humanised, not swallowed.** `humanizeProviderError()` in `routes/insights.js` maps the handful of actionable cases (bad key, wrong model, rate limit, unreachable) to plain sentences and passes anything unrecognised through rather than hiding it.
- **`tasks` has no `updated_at` column.** Several sibling tables do, which makes it easy to write an `UPDATE tasks SET ... , updated_at = datetime('now')` that throws at runtime. Check `schema.sql` before adding one.
- **Gemini counts thinking tokens against `maxOutputTokens`.** A 3.x model handed a 16-token budget spends all of it thinking and returns HTTP 200 with an empty `content` and `finishReason: MAX_TOKENS` - which reads like a parsing bug and is not one. `gemini.js` adds `THINKING_HEADROOM` on top of every caller's budget and reports the real cause when it still runs out. This broke Test connection on `gemini-3.7-flash`.
- **Model names are fetched, not hard-coded.** `POST /api/ai/models` asks the provider what the key can actually call, and Settings renders it as a datalist and flags a saved model that is not on it. A stale model name is a valid key that fails every request - the most confusing possible failure, and the one that actually happened (`gemini-3.1-flash-mini`, which never existed).
- **Dictation is the browser's, not ours.** `useDictation` in `DayAssistant.tsx` wraps `webkitSpeechRecognition`. It hides the button entirely where unsupported, and releases the microphone when the panel closes - not only when the user stops it.
- **No scheduler.** There is no cron. Nothing generates pages for you overnight; closing the day is a deliberate user action, which is also the design intent.
- **The 20-element `lucide-react` namespace import in `Badges.tsx`** resolves icon names from seed data at runtime. It costs bundle size. If that matters, replace it with an explicit map of the icons actually used by the badge catalog.
- **The bundle is ~2 MB** (500 kB gzipped) in one chunk. Recharts and framer-motion dominate. Route-level `React.lazy` would fix it; it has not been done because the app is self-hosted and loads from localhost.
- **`ThemeContext` exports non-components** (`colorPalettes`, `hexToHSL`, `useTheme`), so it trips `react-refresh/only-export-components`. Three warnings, inherited from the `moneyos` original, left as-is for consistency with the other house apps.
