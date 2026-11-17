# Commodity Intelligence Terminal (CIT)

An interactive commodity market intelligence terminal integrating market
observations, price trends, supply-demand indicators, source tracking, policy
monitoring, risk analysis, and research reports.

## Live Interactive Dashboard

_Public HTTPS demo URL will be inserted here after Vercel Hobby deployment is
verified. See [docs/PUBLIC_DEMO_DEPLOYMENT.md](./docs/PUBLIC_DEMO_DEPLOYMENT.md)._

Local full app (SQLite + scheduler):

```bash
npm install
npm run dev        # http://localhost:3000 → redirects to /sulphur/overview
```

Public read-only demo mode (snapshot-backed, no SQLite writes):

```bash
npm run export:public-demo   # refresh public-data/snapshot.json from local DB
npm run build:public-demo
npm run start:public-demo    # http://localhost:3001
```

Other commands:

```bash
npm run build      # production build (full local app)
npm start          # run the production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
node scripts/inspect-db.mjs   # print a summary of the local database
```

### Data transparency (public demo)

The public deployment serves a validated read-only snapshot. Observation dates
are the stored market timestamps, not the snapshot export time. Live ingestion,
manual edits, admin settings, and cloud AI calls are disabled. Details:
[docs/PUBLIC_DEMO_LIMITATIONS.md](./docs/PUBLIC_DEMO_LIMITATIONS.md).

Node 22 or newer is required, because the persistence layer uses the built-in
`node:sqlite` module.

## Architecture

```
src/
  adapters/                 data-source adapters (ecb-fx, brent, wti, policy, …)
  app/
    [commodityId]/          overview, prices, supply, demand, shipping,
                            policy, reports, manual-input
    system/                 data-sources, health, settings
  components/               charts, market panels, tables, forms, layout, ui
  config/
    commodities/            per-commodity configuration (sulphur, crude-oil, …)
    nav.ts, events.ts
  lib/
    db/                     client, migrations, repositories, seed
    engines/                statistics, derived, market-score, drivers,
                            spreads, quality, alerts, report
    data-sources/           adapter interface + official/public-web/derived
    analysis/               provider abstraction (local-template, cloud)
    bootstrap.ts            migrate + seed + recompute on every server start
    scheduler.ts            local background scheduler
  server/
    queries.ts              server-side read layer → view models
    actions.ts              server actions (the only write path from the UI)
  types/                    db.ts (storage), view.ts (UI view models)
data/commodity-terminal.db  the local database
```

The layering rule is strict: components never touch SQL. Pages call
`src/server/queries.ts`, which reads through repositories, runs the engines and
returns plain serialisable view models. Every write goes through a server action
in `src/server/actions.ts`, which revalidates the affected routes so server
components re-read the database. Market history is never held in React state.

### Why `node:sqlite` instead of Prisma

Prisma would add a code-generation step, a downloaded query engine and a
migration CLI to a tool that is meant to be cloned and run offline. `node:sqlite`
ships with Node 22, needs no native compilation, and works with a plain
`npm install`. `src/lib/db/repositories.ts` provides the typed boundary an ORM
would otherwise give us: it is the only file in the project containing SQL.

## Database

Location: `data/commodity-terminal.db` (override with `CIT_DATABASE_PATH`).
Migrations live in `src/lib/db/migrations.ts` as an ordered, idempotent list and
are applied automatically on first access; applied ids are recorded in
`_migrations`.

| Table | Purpose |
| --- | --- |
| `commodities` | Tracked commodities |
| `sources` | Data-source registry, including automation level and schedule |
| `indicators` | Per-commodity series definitions (type, unit, frequency) |
| `observations` | Every stored value, with source, quality and manual flag |
| `market_events` | Policy, supply, shipping and demand events |
| `alert_rules` / `alerts` | Rule definitions and triggered alerts |
| `daily_reports` | Generated reports, including the full JSON payload |
| `data_fetch_logs` | One row per adapter run |
| `settings` | Score weights, report time, AI and adapter configuration |

Observations are deduplicated on `(indicatorId, timestamp, sourceId)`, so
re-running an adapter never creates duplicates, and a manual entry never
overwrites automatic history — it is stored alongside it under `src-manual`.

Indicator types: `PRICE`, `INVENTORY`, `SUPPLY`, `DEMAND`, `FREIGHT`,
`PRODUCTION`, `IMPORT`, `EXPORT`, `POLICY`, `UTILIZATION`, `FX`, `MACRO`,
`SPREAD`, `DERIVED`. Source types: `OFFICIAL`, `PUBLIC_WEB`, `NEWS`, `MANUAL`,
`API`, `DERIVED`.

Seeding (`src/lib/db/seed.ts`) converts the original mock sulphur history into
real observations on first run. It is versioned and idempotent, and it backdates
`createdAt` so the "new data today" counters stay honest.

## Data ingestion

Every adapter implements the same interface (`src/lib/data-sources/base-source.ts`):

```ts
interface DataSourceAdapter {
  id: string;
  name: string;
  fetch(): Promise<RawDataRecord[]>;
  normalize(records: RawDataRecord[]): Promise<NormalizedObservation[]>;
  validate(records: NormalizedObservation[]): ValidationResult;
  persist(records: NormalizedObservation[]): Promise<void>;
}
```

Shipped adapters:

| Adapter | Kind | Status |
| --- | --- | --- |
| `public-fx-json` | Public JSON endpoint (ECB rates via Frankfurter) | Automated, enabled |
| `derived-engine` | Recomputes derived indices and score history | Automated, enabled |
| `public-html-table` | Static HTML table template | Template — configure a URL first |
| `public-rss` | RSS news → market events in review status | Template — configure a feed first |
| `manual-required` | Placeholder that logs `MANUAL_REQUIRED` | Manual |

Requests go through `politeFetch`, which reads and honours `robots.txt`, applies
a per-host rate limit and sends an identifiable user agent (`CIT_USER_AGENT`).
Paywalls, logins, CAPTCHAs and anti-bot protection are never bypassed: a source
that cannot legally or reliably be automated is marked `MANUAL_REQUIRED` and
surfaced as such in the registry rather than being faked.

Sulphur sources that are currently manual-only: producer OSP announcements,
China Customs import volumes, port inventory and Zhenjiang quotations, refinery
liquid sulphur, downstream utilization, freight, vessel line-ups and domestic
production. Ready for public-web automation once you supply a permitted URL:
the benchmark price table and the policy/news RSS feed.

## Scheduler

`src/instrumentation.ts` starts `src/lib/scheduler.ts` once per Node server
process. Every 60 seconds it:

1. runs each enabled source whose `refreshIntervalMinutes` has elapsed,
2. recomputes derived indicators and market-score history,
3. re-evaluates alert rules and stores newly triggered alerts,
4. writes a `data_fetch_logs` row per run,
5. generates the daily report once the configured time has passed.

Default intervals follow the publication cadence: news and public price pages
30–60 minutes, official and government pages 3 hours, port inventory and
utilization 6 hours, customs and monthly OSP 24 hours. Per-source overrides live
in the Data Sources screen. **REFRESH NOW** in the header forces every source.

If the app was closed at report time, the missed report is generated the next
time the server starts.

## Analytics

**Statistics** (`engines/statistics.ts`) computes current, previous, absolute and
percentage change, 7/30/90-day changes, ranges, averages, high, low, distance
from high, annualised volatility, trend and momentum. Lookbacks are calendar
based, so weekly and monthly series are handled correctly. Nothing is hard-coded.

**Trend** is classified from the 7- and 30-day slope (`STRONG UP`, `UP`,
`SIDEWAYS`, `DOWN`, `STRONG DOWN`); **momentum** compares the recent slope with
the prior one (`ACCELERATING`, `STABLE`, `DECELERATING`, `REVERSING`);
**volatility** buckets annualised standard deviation (`LOW`, `MODERATE`, `HIGH`,
`EXTREME`). Every panel exposes the method in a tooltip.

**Market score** (`engines/market-score.ts`) is a weighted blend of factors
defined in the commodity config — for sulphur: global price pressure 20%, China
import cost 20%, supply tightness 20%, domestic price strength 15%, demand
strength 15%, freight 5%, policy risk 5%. Each factor maps its measured input
onto 0–100, weights are normalised, and the result bands into
STRONG BEARISH / BEARISH / NEUTRAL / BULLISH / STRONG BULLISH. Weights are
editable in Settings and stored in the `settings` table.

**Price drivers** (`engines/drivers.ts`) build Supply, Inventory, Demand,
Freight, Policy and FX scores from the underlying indicators. Expanding a driver
shows each component's raw input, normalised score, weight and weighted
contribution.

**Spreads and import parity** (`engines/spreads.ts`) chart historical spreads and
build the landed-cost stack: FOB + freight + insurance + FX + port costs +
financing + other costs → estimated China landed cost, then domestic price minus
landed cost → import arbitrage spread.

**Quality** (`engines/quality.ts`) assigns `VERIFIED`, `NORMAL`, `ESTIMATED`,
`STALE`, `CONFLICT` or `MANUAL`, and flags order-of-magnitude jumps as a possible
unit or parsing error instead of accepting them silently. Freshness (`LIVE`,
`FRESH`, `STALE`, `MANUAL`, `NO DATA`) is measured against each indicator's
expected publication frequency, never against wall-clock time — a weekly
assessment three days old is FRESH, not stale.

## Alerts

`engines/alerts.ts` evaluates the rules stored in `alert_rules`:

- `THRESHOLD` — e.g. CFR China above $1,030, port inventory below 80 万吨
- `CHANGE_PCT` — e.g. CFR China weekly change above 5%
- `CONSECUTIVE_MOVE` — e.g. Middle East FOB falling two periods running
- `COMPOUND_REVERSAL` — CFR China and Middle East FOB declining **and** port
  inventory rising **and** MAP/DAP utilization weakening
- `FRESHNESS` — an indicator has gone stale relative to its frequency

Each alert carries a fingerprint, so re-evaluation is idempotent. High and
critical alerts also raise a browser notification when permission is granted;
everything appears in the in-app Alert Center regardless.

## Daily report

`engines/report.ts` builds the payload from database values only: market score
and change, latest observation changes, 7- and 30-day trends, price ranges,
supply, inventory, demand, freight, policy events, largest positive and negative
drivers, reversal signals, what changed since the previous report and what to
watch next. Narrative commentary is produced separately by the analysis provider
and stored in its own slot, so switching to a cloud model never changes a number.
Reports are stored in `daily_reports` with the full payload; the Reports page
lists history and compares today against roughly seven days ago.

## Extending the terminal

**Add a commodity.** Create `src/config/commodities/<id>.ts` exporting a
`CommodityConfig` (indicators, sources, drivers, score factors, alert rules,
spreads, import parity, optional derived formulas) and register it in
`src/config/commodities/index.ts`. The schema, engines and pages need no changes.

**Add an indicator.** Either add an `IndicatorConfig` entry to the commodity
config, or create it at runtime from the Manual Input page — the form writes
directly to the `indicators` table.

**Add a public data source.** Add a `SourceConfig` to the commodity config with
an `adapterId`, then implement the adapter under
`src/lib/data-sources/public-web/` and register it in
`src/lib/data-sources/index.ts`. Confirm the site's terms and `robots.txt` permit
automated access before enabling it; otherwise set
`automation: "MANUAL_REQUIRED"`.

**Add a manual observation.** Manual Input → pick indicator, date, value,
source and notes. The value is stored with quality `MANUAL`, displayed with a
MANUAL badge, and never overwrites automatic history.

**Connect a paid API later.** Add a `SourceConfig` with
`sourceType: "API"` and `requiresPaidAccess: true`, implement the adapter against
the same `DataSourceAdapter` interface, and read the credential from an
environment variable. Nothing else changes: the scheduler, dedup, quality checks
and provenance already work for any adapter.

**Connect Cloud AI later.** Copy `.env.example` to `.env.local`, set
`AI_PROVIDER=cloud`, `AI_API_KEY`, `AI_MODEL` and optionally `AI_BASE_URL` (any
OpenAI-compatible chat completions endpoint), then select the cloud provider in
Settings. The provider receives a bounded JSON context — prices, changes, ranges,
inventory, supply, demand, freight, events, score, alerts and spreads — never the
database. Any failure or missing key falls back to the local template.

**Back up the database.** Settings → Data → **BACK UP DATA** checkpoints the WAL
and writes `data/backups/commodity-terminal-backup-<timestamp>.db`. The same
panel exports any indicator's full history as CSV. Copying
`data/commodity-terminal.db` while the app is stopped works just as well.

## Limitations

- Only two sources are automated out of the box: the public FX endpoint and the
  internal derived engine. Everything else is deliberately manual or a template,
  because the underlying publishers either require a subscription or do not
  permit automated access.
- Seeded sulphur history is synthetic. It is realistic and anchored to plausible
  headline levels, but it is not a market assessment; replace it with real
  observations before relying on the numbers.
- The scheduler runs inside the Next.js server process, so nothing is fetched
  while the app is stopped. Missed daily reports are generated on the next start;
  missed fetches simply happen at the next tick.
- Event classification from RSS is keyword based and lands in `REVIEW` status
  with its source URL stored. It is a triage aid, not a decision.
