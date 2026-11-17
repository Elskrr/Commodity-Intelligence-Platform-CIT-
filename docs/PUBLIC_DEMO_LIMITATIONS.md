# CIT V5 — Public Demo Limitations

## What the public demo is

An interactive, read-only deployment of the **existing** Commodity Intelligence Terminal UI, backed by a sanitized JSON snapshot exported from the local SQLite database.

Visitors can navigate commodities, change chart ranges, inspect provenance, open reports, and explore Market Score / drivers that were already computed locally.

## What the public demo is not

| Capability | Local full app | Public demo |
|------------|----------------|-------------|
| Live adapter ingestion | Yes (scheduler) | No |
| Manual observation entry | Yes | Blocked (route + Server Action) |
| Admin settings / AI keys | Yes | Blocked |
| Source refresh / health jobs | Yes | Blocked |
| New CIE report generation | Yes | Browse stored reports only |
| Cloud LLM calls | Optional | Forced off |
| Durable SQLite writes | Yes | No SQLite mounted |
| Continuous data updates | Scheduler | Manual snapshot re-export + redeploy |

## Data honesty

- Snapshot **export time** ≠ observation time. Cards and charts use each series’ stored `observedAt`.
- Sulphur physical assessments in the current DB peak around **2026-08-07/11**; some derived / FX series extend further.
- Quality labels (`VERIFIED`, `NORMAL`, `MANUAL`) and provenance are preserved from SQLite.
- Crude oil / natural gas currently have **no observations** in the DB — expect empty or minimal panels, not invented prices.
- Analysis text on overview is the offline **local-template** output captured at export time.

## Security boundary

Enforced in three layers:

1. **Middleware** — `/system/*` and `/*/manual-input` redirect away when `CIT_PUBLIC_DEMO=1`
2. **Server Actions** — every mutation returns `PUBLIC_DEMO_DENIED`
3. **UI** — admin nav, refresh, acknowledge, and generate controls hidden in demo mode

Hiding a button alone is not considered sufficient.

## Hosting limits (Vercel Hobby)

- Free tier / personal non-commercial use per Vercel’s current Hobby terms
- No always-on worker; no durable filesystem for SQLite WAL
- Cold starts possible; snapshot (~3.4 MB) is bundled into the server build
- Usage quotas apply — suitable for interview demos, not high-traffic production

## Future work (not V5)

To get autonomous cloud updates without the laptop online:

1. Persistent storage + worker (e.g. VPS / Railway) **or**
2. CI job that has access to refreshed observations and commits a new snapshot

Either path needs additional infrastructure beyond Hobby snapshot hosting.
