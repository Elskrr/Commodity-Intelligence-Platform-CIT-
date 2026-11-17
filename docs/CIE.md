# Commodity Intelligence Engine (CIE)

Stable platform architecture. CIE adds reasoning on top of observations without redesigning UI, adapters, scheduler, or migrations.

## Pipeline

```
Observation → Indicators → Market Drivers → Risk → Scenario → Forecast → Research → Reports → Dashboard
```

## Folder structure

```
src/intelligence/
  index.ts                 # runIntelligence + toAnalysisOutlook
  types.ts
  context.ts               # read-only bundle builder
  confidence-engine/
  explanation-engine/
  driver-engine/
  risk-engine/
  scenario-engine/
  forecast-engine/
  research-engine/
  market-memory/
  event-correlation/
  observation-graph/
```

## Integration

`src/lib/engines/report.ts` calls `runIntelligence()` and maps research into the existing `AnalysisOutlook` shape so the reports UI receives institutional narrative without layout changes. Full `IntelligenceBundle` is stored on `ReportPayload.intelligence`.

Alert change-% messages now append correlated co-movers when present.

## Database

No new tables. Memory and graph are derived views over observations, events, and prior report JSON.
