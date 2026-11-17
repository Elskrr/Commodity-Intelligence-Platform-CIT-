# CIT V5 — Public Demo Audit

**Date:** 2026-11-17
**Scope:** Free interactive public deployment of the existing Commodity Intelligence Terminal
**Constraint:** Audit evidence from the live repository; no assumptions from prior chat claims.

---

## 1. Repository state

| Item | Evidence |
|------|----------|
| Project root | `/Users/elskrr/Desktop/COMMODITY INTELLIGENCE` |
| Package manager | npm (`package-lock.json`) |
| Package name | `commodity-intelligence-terminal` @ 1.0.0 |
| Next.js | `^16.3.0` (resolved 16.3.0) — see `package.json` |
| React | `^19.2.0` |
| TypeScript | `^5.9.3`, `strict: true` (`tsconfig.json`) |
| Charts | `lightweight-charts`, `recharts` |
| Persistence | `node:sqlite` (Node 22+ built-in) — `src/lib/db/client.ts` |
| Database file | `data/commodity-terminal.db` (~5 MB + WAL); override via `CIT_DATABASE_PATH` |
| Git | **Not initialized** (`fatal: not a git repository`) — no remote, no GitHub link yet |
| Deployment config | None (`vercel.json` absent; `next.config.ts` has no `output: "export"`) |
| API routes | **None** under `src/app/api/` — writes go through Server Actions only |
| Auth | **None** — every Server Action is callable without credentials |

### Scripts (`package.json`)

- `dev` → `next dev -p 3000`
- `build` / `start` / `lint` / `typecheck`
- No test script; `scripts/inspect-db.mjs` and `scripts/e2e-ops.mts` exist

### Runtime assumptions that block naïve cloud deploy

1. **Always-on scheduler** started from `src/instrumentation.ts` → `startScheduler()` (`src/lib/scheduler.ts`, 60s interval).
2. **Writable SQLite + WAL** on a durable local path (`getDb()` in `src/lib/db/client.ts`).
3. **Bootstrap mutates DB** (`ensureReady()` seeds + recomputes analytics).
4. **Server Actions mutate DB** (`src/server/actions.ts` — manual input, refresh, settings, AI keys, backup, etc.).
5. **No authentication** on any write path.
6. **Overview page** may call AI provider (`generateMarketAnalysis`) using DB settings / `AI_API_KEY`.

---

## 2. Application routes (verified)

### Public commodity workspace (`src/app/[commodityId]/…`)

| Route | File | Data path |
|-------|------|-----------|
| `/` | `src/app/page.tsx` | Redirect → `/sulphur/overview` |
| `…/overview` | `…/overview/page.tsx` | `getCommodityDataset`, `generateMarketAnalysis` |
| `…/prices` | `…/prices/page.tsx` | `getCommodityDataset` |
| `…/supply` | `…/supply/page.tsx` | `getCommodityDataset` |
| `…/demand` | `…/demand/page.tsx` | `getCommodityDataset` |
| `…/shipping` | `…/shipping/page.tsx` | `getCommodityDataset` |
| `…/policy` | `…/policy/page.tsx` | `getCommodityDataset` |
| `…/reports` | `…/reports/page.tsx` | `getCommodityDataset`, `getReports`, optional `buildReport` |
| `…/manual-input` | `…/manual-input/page.tsx` | **WRITE UI** — must not be public |

### System / admin (`src/app/system/…`)

| Route | File | Risk |
|-------|------|------|
| `/system/data-sources` | `data-sources/page.tsx` | Adapter config, refresh triggers |
| `/system/health` | `health/page.tsx` | Exposes `databasePath`, queue depths |
| `/system/settings` | `settings/page.tsx` | AI keys, weights, report time |

Layouts call `ensureReady()` and repositories directly (`src/app/[commodityId]/layout.tsx`, `src/app/system/layout.tsx`).

---

## 3. Feature inventory (pre-demo)

| Feature | Classification | Evidence |
|---------|----------------|----------|
| Commodity dashboard / overview | IMPLEMENTED_BUT_NOT_VERIFIED (code present; runtime TBD in demo) | `overview/page.tsx` |
| Prices / supply / demand / shipping / policy | IMPLEMENTED_BUT_NOT_VERIFIED | matching `page.tsx` files |
| Charts + range toggle | IMPLEMENTED_BUT_NOT_VERIFIED | `src/components/charts/*` |
| Market Score | IMPLEMENTED_BUT_NOT_VERIFIED | `src/lib/engines/market-score.ts` |
| Alerts UI | IMPLEMENTED_BUT_NOT_VERIFIED (ack is a write) | `alert-drawer.tsx` → `acknowledgeAlert` |
| Reports | IMPLEMENTED_BUT_NOT_VERIFIED | 108 rows in `daily_reports` |
| Manual input | IMPLEMENTED — **exclude from public** | `manual-input/page.tsx` |
| Data sources / settings / health admin | IMPLEMENTED — **exclude or read-only sanitize** | `system/*` |
| Scheduler / ingestion | IMPLEMENTED — **not for serverless public demo** | `scheduler.ts` |
| CIE (drivers/risk/scenario/forecast/research/memory) | IMPLEMENTED_BUT_NOT_VERIFIED | `src/intelligence/*`; used via `generateReport` / `runIntelligence` |
| Auth | MISSING | no middleware/session |

### Database snapshot (read-only inspect, 2026-11-17)

- Migrations applied: `001_init`, `002_provenance_and_fetch_metrics`, `003_license_cache_retry`
- Observations: **4938** (sulphur 4914, macro 24; crude-oil / natural-gas **0** observations)
- Quality: VERIFIED 2604, NORMAL 2332, MANUAL 2
- Reports: sulphur 41, crude-oil 39, natural-gas 14, macro 14
- Sulphur physical prices last observed ~2026-08-07/11; several derived series through 2026-11-13

---

## 4. Hosting decision

### Option A — Vercel Hobby (selected)

**Why it fits**

- Native Next.js 16 App Router / Server Components / Server Actions.
- Free HTTPS URL; private GitHub source can deploy without making source public.
- No paid database required if the public site is **snapshot-backed**.

**Constraints (must respect)**

- No durable writable SQLite.
- No always-on 60s scheduler inside serverless.
- Do not call paid AI from anonymous public traffic.
- Server Actions remain reachable unless explicitly blocked.

### Option B — GitHub Pages / static export

**Rejected for V5 primary path**

- App is server-component + SQLite + Server Actions heavy (`getCommodityDataset` on every page; layouts call `ensureReady()`).
- Enabling `output: "export"` would require a parallel static rewrite of the terminal, not a minimal change.
- GitHub Free Pages for project sites often implies a **public** artifact repo.

### Decision

**Vercel Hobby + `CIT_PUBLIC_DEMO=1` + sanitized JSON snapshot provider.**

- Preserve local full app (SQLite + scheduler) unchanged when demo flag is off.
- Public build reads allowlisted snapshot data only.
- All Server Actions reject writes in demo mode.
- Admin / manual routes redirected or unavailable.
- Continuous live ingestion is **out of scope** for V5; snapshot timestamps are shown honestly.

---

## 5. Public demo scope

### Preserve (interactive, read-only)

- Terminal chrome (sidebar, tabs, dark financial UI)
- Commodity navigation and search
- Overview / prices / supply / demand / shipping / policy / reports
- Charts, filters, time ranges, provenance, freshness, Market Score
- Existing stored reports and precomputed analysis narrative

### Exclude from public surface

- Manual market-data editing
- Source/scheduler/settings mutations
- DB backup, health-triggered jobs, AI key management
- Live adapter refresh / unrestricted LLM calls
- Internal paths (`databasePath`, retry queues) that aid attackers

---

## 6. Outstanding facts (pre-implementation)

| Fact | Status |
|------|--------|
| Production `npm run build` under demo mode | Not yet run |
| Vercel account / project link | Not authorized / not present |
| GitHub remote | Missing (no `.git`) |
| Legal redistribution of every source URL on a public site | Needs per-source review at export validation |
| Crude oil / NG interactive depth | No observations in DB — expect empty/NoDataset honesty |

---

## 7. Implementation plan (this phase)

1. Add `src/lib/public-data/*` export / validate / provider.
2. Gate DB, scheduler, actions, nav, and admin routes on `CIT_PUBLIC_DEMO`.
3. Generate `public-data/snapshot.json` from local SQLite (sanitized).
4. Document deploy steps; attempt Vercel only with user authorization.
5. Insert Live Demo URL into README **only after** a verified HTTPS URL exists.

---

## 8. Post-implementation verification (2026-11-17)

| Check | Result |
|-------|--------|
| `npm run export:public-demo` | PASS — 4938 observations, 88 reports, sulphur score 73.2 |
| `npm run typecheck` | PASS |
| `npm run build:public-demo` | PASS (Next.js 16.3 Turbopack) |
| `npm run start:public-demo` | PASS — http://localhost:3001 |
| `/` → `/sulphur/overview` | PASS (307) |
| Overview markers (banner, PUBLIC DEMO, CFR, score) | PASS |
| `/sulphur/prices`, `/reports`, `/macro/overview` | PASS (200) |
| `/system/settings`, `/sulphur/manual-input` | PASS — redirect to overview |
| Refresh / admin nav absent in HTML | PASS |
| Git remote / Vercel account | **NOT AVAILABLE** — no `.git`; `vercel` CLI not installed |
| Live HTTPS URL in README | **NOT INSERTED** (no verified public URL yet) |
