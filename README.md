<div align="center">

# Commodity Intelligence Platform (CIT)

### A data-driven intelligence terminal for interconnected commodity markets.

Track market indicators, explore price history, examine supply–demand signals, and turn fragmented information into structured, traceable market research.

[**Launch Live Dashboard**](https://commodity-intelligence-cit.netlify.app/) · [Why CIT](#why-we-built-cit) · [Dashboard Design](#how-the-dashboard-is-organized) · [Architecture](#system-architecture) · [Run Locally](#run-locally)

![Next.js](https://img.shields.io/badge/Next.js-16-111827?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Application-3178C6?logo=typescript&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-Local--first-0C6E9A?logo=sqlite&logoColor=white)
![Deployment](https://img.shields.io/badge/Demo-Netlify-00AD9F?logo=netlify&logoColor=white)
![Access](https://img.shields.io/badge/Public%20Demo-Read--only-64748B)

</div>

---

## Live Product

**[Open CIT → Interactive Market Dashboard](https://commodity-intelligence-cit.netlify.app/)**

CIT is a working web application, not a static portfolio mockup. The hosted version uses the existing Next.js interface with **interactive charts, commodity navigation, indicator exploration, and saved market analysis**. It is intended for hands-on exploration, not as a live trading or price-assessment service.

> **Public-demo boundary:** The hosted site reads a validated, read-only data snapshot. It does **not** run continuous cloud ingestion, database writes, administrator actions, or on-demand cloud AI. Some historical sulphur observations are **seeded/synthetic**, and some values are manual or stale. Always check the observation date and source before drawing conclusions.

## Dashboard Preview

[![CIT dashboard showing sulphur market score, price cards and an interactive history chart](docs/assets/cit-dashboard.png)](https://commodity-intelligence-cit.netlify.app/)

*Actual CIT public-demo interface · Sulphur overview. Click the image to explore the deployed application. Displayed market figures are illustrative or historical where indicated by their provenance; they are not guaranteed live quotations.*

## Why We Built CIT

CIT started with a practical market-research problem: **how do global sulphur supply, international benchmark prices, China’s import costs, port inventory, downstream fertilizer demand, shipping conditions and policy developments interact to shape the domestic market?**

The information needed to answer that question rarely comes from a single feed. Prices, trade statistics, inventory updates, government announcements and industry utilization data arrive from different publishers, at different frequencies, in different units and with different licensing constraints. A conventional price dashboard displays the numbers, but still leaves the user to reconstruct the market story.

**Our design goal was to connect fragmented observations to a structured, explainable research workflow**—while making the source, observation date and limitations of each conclusion visible. We built the terminal around four questions:

1. **What changed?** Track historical observations, trends and changes across benchmarks.
2. **What is driving it?** Examine supply, demand, inventory, logistics, FX and policy signals together.
3. **How strong is the evidence?** Preserve provenance and freshness instead of treating all figures as equally reliable.
4. **What should be watched next?** Use driver rankings, conditional scenarios, alerts and research reports to organize follow-up analysis.

Sulphur is the starting point, not a hard-coded limit: the commodity configuration layer is designed to support adjacent energy, fertilizer, coal-chemical and petrochemical markets using the same core engines.

## How the Dashboard Is Organized

Instead of a marketing-style landing page, the application opens directly into a **dense, research-oriented workspace**. Each part of the interface has an analytical purpose:

| Dashboard area | Why it exists |
| --- | --- |
| **Commodity navigator** | Move across related markets without losing the common analysis framework. |
| **Market score & factor decomposition** | Start with a compact market-state summary, then inspect the weighted drivers behind it. |
| **Benchmark, inventory & utilization cards** | Keep import pricing, domestic quotations, stock levels and downstream demand in the same field of view. |
| **Interactive time-series charts** | Test whether a movement is recent, persistent or at odds with another indicator. |
| **Supply / Demand / Shipping / Policy tabs** | Follow a specific hypothesis into the underlying market evidence. |
| **Reports, source and freshness labels** | Separate a research interpretation from the observations—and dates—that support it. |

The page is built from reusable **Next.js App Router + React components** for charts, tables, cards and navigation. The read layer returns consistent view models, while the data/analytics layers remain separate from presentation. That separation makes it possible to serve the same interface from a local SQLite database or a sanitized, read-only public snapshot.

### The reasoning behind the market model

A change in Middle East FOB quotations may affect China’s import cost, but domestic price formation can also depend on port inventory, landed freight, exchange rates and downstream operating rates. **A higher upstream price is not, by itself, proof of a bullish domestic market.**

CIT therefore uses a layered workflow: **observations → normalized indicators → transparent factor scores → market drivers and risks → conditional scenarios → research output.** The market score provides an orientation, not a substitute for the supporting evidence; the intelligence engine is designed to expose assumptions and uncertainties rather than manufacture certainty.

<details>
<summary><strong>Engineering decisions and trade-offs</strong></summary>

| Decision | Rationale |
| --- | --- |
| **Source-first adapters** | Each publisher has different formats, schedules and access rules; adapters isolate collection from analysis. |
| **SQLite for the full local terminal** | Lightweight, persistent history with migrations, without operating a separate database server for a single-user research workstation. |
| **Explicit provenance and quality** | Avoid conflating manual entries, seeded history, verified public observations and proxy indicators. |
| **Rule-based intelligence before price ML** | Provide inspectable drivers and scenarios without claiming model accuracy unsupported by reliable training and backtest data. |
| **Multi-commodity configuration** | Reuse core logic while keeping commodity-specific indicators, supply chains and driver weights configurable. |
| **Public read-only snapshot mode** | Share the real interactive interface online without exposing local database writes, scheduling controls or paid AI keys. |

</details>

## What CIT Does

| Capability | What you can explore |
| --- | --- |
| **Multi-commodity workspace** | Configurable commodity views, including sulphur, crude oil, natural gas and macro indicators; additional industries can be registered without rebuilding the core UI. |
| **Price intelligence** | Interactive price series, history ranges, trend and momentum views, comparative benchmarks, spreads and import-cost analysis. |
| **Supply, demand & logistics** | Inventory, downstream utilization, shipping, import-cost and other commodity-specific indicators where data is available. |
| **Market drivers & risk** | Transparent market scoring, directional drivers, risk categories, conditional scenarios and rule-based outlooks. |
| **Provenance & quality** | Observation dates, source classification, freshness warnings, manual/derived status and anomaly checks. |
| **Alerts & research** | Rule-based monitoring and structured research reports in the full local application; previously saved outputs can be explored in the public demo. |

### The research workflow

**Collect → Validate → Normalize → Store → Analyze → Explain → Report**

The purpose is not simply to display commodity prices. CIT connects observations to their underlying market drivers, preserves the evidence behind conclusions, and makes data-quality limitations visible.

## System Architecture

```mermaid
flowchart TD
    A[Public / configured market sources] --> B[Adapters and normalization]
    B --> C[Validation and provenance]
    C --> D[(Local SQLite history)]
    D --> E[Indicators and market analytics]
    E --> F[Commodity Intelligence Engine]
    F --> G[Drivers · Risks · Scenarios · Reports]
    G --> H[Local interactive terminal]
    D --> I[Validated public snapshot export]
    G --> I
    I --> J[Netlify read-only web demo]
```

The system intentionally separates **data collection**, **market calculations**, **intelligence logic**, and **presentation**. The public demo is a deployment mode of the existing application—not a separate mock dashboard.

<details>
<summary><strong>Engineering architecture & core modules</strong></summary>

| Layer | Implementation |
| --- | --- |
| Frontend | Next.js App Router, React, TypeScript, interactive chart and table components |
| Data access | `src/server/queries.ts` and typed repositories; UI components do not directly query SQL |
| Persistence | `node:sqlite`, additive migrations, observation history and report storage |
| Ingestion | Commodity-specific adapters, scheduled checks, normalization, source metadata and quality validation |
| Analytics | Changes, volatility, market score, price drivers, spreads, import parity and alerts |
| Intelligence | Driver, risk, confidence, scenario, forecast, research, explanation and market-memory modules |
| Public delivery | Sanitized JSON snapshot + read-only Next.js deployment on Netlify |

Key directories:

```text
src/
  app/                  Next.js commodity and system routes
  adapters/             Source-specific data integrations
  components/           Charts, tables and dashboard components
  config/commodities/   Per-commodity configuration
  intelligence/         Market intelligence engines
  lib/db/               SQLite, migrations and repositories
  lib/engines/          Indicators, scores, quality and alerts
  lib/public-data/      Snapshot export and read-only provider
  server/               Query and action boundaries
scripts/                Data export and developer utilities
public-data/            Validated public-demo snapshot
```

</details>

## Two Operating Modes

| | Full local terminal | Public interactive demo |
| --- | --- | --- |
| Web interface and interactive charts | Yes | Yes |
| Historical observations and saved reports | SQLite-backed | Snapshot-backed |
| Data ingestion and scheduling | Runs while local server is active | Disabled |
| Manual data entry and admin writes | Available locally | Disabled |
| Intelligence computation | Existing local engines | Existing exported results |
| Persistent writable database | Local SQLite | No |

This distinction is intentional: public visitors can explore the product without receiving privileged access to its data maintenance or execution workflows.

## Run Locally

**Requirements:** Node.js 22+ and npm.

```bash
# Full local application
npm install
npm run dev
# Open http://localhost:3000/sulphur/overview
```

```bash
# Export and test the read-only public demo using the local database
npm run export:public-demo
npm run build:public-demo
npm run start:public-demo
# Open http://localhost:3001
```

Useful checks:

```bash
npm run typecheck
npm run lint
npm run build
node scripts/inspect-db.mjs
```

The export command requires an existing local database and is not a substitute for automatic data collection in the hosted environment. Database files and secrets must not be committed to Git.

## Data Integrity & Limitations

- **Not a live-price feed:** The public build exposes a dated snapshot; the export timestamp is not the market observation timestamp.
- **Synthetic data:** Seeded sulphur history exists for development and demonstration and must not be interpreted as verified historical market assessments.
- **Source coverage varies:** Some adapters retrieve public data; certain physical commodity benchmarks and downstream indicators require manual updates or licensed access.
- **Model outputs are conditional:** Market scores, risk levels and scenario outlooks are research tools, not calibrated price probabilities or investment recommendations.
- **No privileged public operations:** Public visitors cannot write data, change admin settings, start ingestion jobs or invoke unrestricted cloud AI.

See [Public Demo Limitations](docs/PUBLIC_DEMO_LIMITATIONS.md), [Public Demo Deployment](docs/PUBLIC_DEMO_DEPLOYMENT.md), [Architecture](ARCHITECTURE.md) and [CIE Documentation](docs/CIE.md).

## Direction of Development

The next priorities are to expand **verified public market coverage**, automate safe snapshot refreshes, strengthen **industry-chain relationships**, and validate intelligence signals against reliable historical data—without compromising source provenance or reproducibility.

---

<div align="center">

**From fragmented commodity observations to explainable market intelligence.**

[**Explore CIT Live ↗**](https://commodity-intelligence-cit.netlify.app/)

</div>
