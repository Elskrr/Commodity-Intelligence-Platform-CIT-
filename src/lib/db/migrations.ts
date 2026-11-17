/**
 * Ordered schema migrations.
 *
 * Migrations are embedded as strings rather than .sql files so they survive
 * bundling and can never drift from the compiled application. The runner in
 * `client.ts` records applied ids in `_migrations` and is idempotent.
 */
export type Migration = { id: string; sql: string };

export const MIGRATIONS: Migration[] = [
  {
    id: "001_init",
    sql: `
CREATE TABLE IF NOT EXISTS commodities (
  id           TEXT PRIMARY KEY,
  symbol       TEXT NOT NULL,
  name         TEXT NOT NULL,
  nameZh       TEXT NOT NULL DEFAULT '',
  category     TEXT NOT NULL,
  description  TEXT,
  unit         TEXT,
  currency     TEXT,
  active       INTEGER NOT NULL DEFAULT 1,
  createdAt    TEXT NOT NULL,
  updatedAt    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sources (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  nameZh                 TEXT NOT NULL DEFAULT '',
  sourceType             TEXT NOT NULL,
  url                    TEXT,
  publisher              TEXT,
  country                TEXT,
  reliabilityScore       REAL NOT NULL DEFAULT 0.8,
  refreshIntervalMinutes INTEGER NOT NULL DEFAULT 1440,
  enabled                INTEGER NOT NULL DEFAULT 1,
  requiresPaidAccess     INTEGER NOT NULL DEFAULT 0,
  automation             TEXT NOT NULL DEFAULT 'MANUAL_REQUIRED',
  adapterId              TEXT,
  status                 TEXT NOT NULL DEFAULT 'MANUAL',
  lastCheckedAt          TEXT,
  lastNewDataAt          TEXT,
  notes                  TEXT,
  createdAt              TEXT NOT NULL,
  updatedAt              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS indicators (
  id               TEXT PRIMARY KEY,
  commodityId      TEXT NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  nameZh           TEXT NOT NULL DEFAULT '',
  shortName        TEXT,
  indicatorType    TEXT NOT NULL,
  unit             TEXT NOT NULL,
  currency         TEXT,
  region           TEXT,
  country          TEXT,
  frequency        TEXT NOT NULL,
  directionMeaning TEXT NOT NULL DEFAULT 'HIGHER_IS_BULLISH',
  prefix           TEXT,
  precision        INTEGER NOT NULL DEFAULT 0,
  defaultSourceId  TEXT REFERENCES sources(id),
  isDerived        INTEGER NOT NULL DEFAULT 0,
  active           INTEGER NOT NULL DEFAULT 1,
  sortOrder        INTEGER NOT NULL DEFAULT 0,
  createdAt        TEXT NOT NULL,
  updatedAt        TEXT NOT NULL,
  UNIQUE (commodityId, code)
);

CREATE TABLE IF NOT EXISTS observations (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  indicatorId TEXT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  value       REAL NOT NULL,
  timestamp   TEXT NOT NULL,
  periodStart TEXT,
  periodEnd   TEXT,
  sourceId    TEXT REFERENCES sources(id),
  quality     TEXT NOT NULL DEFAULT 'NORMAL',
  isManual    INTEGER NOT NULL DEFAULT 0,
  note        TEXT,
  createdAt   TEXT NOT NULL,
  UNIQUE (indicatorId, timestamp, sourceId)
);

CREATE INDEX IF NOT EXISTS idx_observations_indicator_time
  ON observations (indicatorId, timestamp);

CREATE TABLE IF NOT EXISTS market_events (
  id              TEXT PRIMARY KEY,
  commodityId     TEXT NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
  timestamp       TEXT NOT NULL,
  country         TEXT,
  countryZh       TEXT,
  region          TEXT,
  category        TEXT NOT NULL,
  title           TEXT NOT NULL,
  titleZh         TEXT NOT NULL DEFAULT '',
  summary         TEXT NOT NULL DEFAULT '',
  summaryZh       TEXT NOT NULL DEFAULT '',
  sourceId        TEXT REFERENCES sources(id),
  sourceUrl       TEXT,
  impactDirection TEXT NOT NULL,
  impactScore     REAL NOT NULL DEFAULT 0,
  confidence      REAL NOT NULL DEFAULT 50,
  severity        TEXT NOT NULL DEFAULT 'MEDIUM',
  status          TEXT NOT NULL DEFAULT 'CONFIRMED',
  classifiedBy    TEXT NOT NULL DEFAULT 'MANUAL',
  createdAt       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_commodity_time
  ON market_events (commodityId, timestamp);

CREATE TABLE IF NOT EXISTS alert_rules (
  id          TEXT PRIMARY KEY,
  commodityId TEXT NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
  indicatorId TEXT REFERENCES indicators(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  nameZh      TEXT NOT NULL DEFAULT '',
  ruleType    TEXT NOT NULL,
  threshold   REAL,
  comparison  TEXT,
  windowSize  INTEGER NOT NULL DEFAULT 1,
  severity    TEXT NOT NULL DEFAULT 'MEDIUM',
  enabled     INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  createdAt   TEXT NOT NULL,
  updatedAt   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ruleId       TEXT REFERENCES alert_rules(id) ON DELETE SET NULL,
  commodityId  TEXT NOT NULL,
  timestamp    TEXT NOT NULL,
  severity     TEXT NOT NULL,
  title        TEXT NOT NULL,
  titleZh      TEXT NOT NULL DEFAULT '',
  message      TEXT NOT NULL,
  messageZh    TEXT NOT NULL DEFAULT '',
  acknowledged INTEGER NOT NULL DEFAULT 0,
  fingerprint  TEXT NOT NULL,
  contextJson  TEXT,
  UNIQUE (fingerprint)
);

CREATE TABLE IF NOT EXISTS daily_reports (
  id            TEXT PRIMARY KEY,
  commodityId   TEXT NOT NULL REFERENCES commodities(id) ON DELETE CASCADE,
  date          TEXT NOT NULL,
  marketScore   REAL NOT NULL,
  previousScore REAL,
  shortTermView TEXT NOT NULL,
  sevenDayView  TEXT NOT NULL,
  thirtyDayView TEXT NOT NULL,
  confidence    REAL NOT NULL,
  summary       TEXT NOT NULL,
  payloadJson   TEXT NOT NULL,
  generatedBy   TEXT NOT NULL DEFAULT 'local-template',
  createdAt     TEXT NOT NULL,
  UNIQUE (commodityId, date)
);

CREATE TABLE IF NOT EXISTS data_fetch_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceId     TEXT NOT NULL,
  adapterId    TEXT,
  startedAt    TEXT NOT NULL,
  finishedAt   TEXT,
  status       TEXT NOT NULL,
  recordsFound INTEGER NOT NULL DEFAULT 0,
  recordsAdded INTEGER NOT NULL DEFAULT 0,
  errorMessage TEXT
);

CREATE INDEX IF NOT EXISTS idx_fetch_logs_source
  ON data_fetch_logs (sourceId, startedAt);

CREATE TABLE IF NOT EXISTS settings (
  key       TEXT PRIMARY KEY,
  value     TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
`,
  },
  {
    id: "002_provenance_and_fetch_metrics",
    sql: `
-- Observation provenance (data-source-first platform). Existing rows keep NULL.
ALTER TABLE observations ADD COLUMN confidence REAL;
ALTER TABLE observations ADD COLUMN retrievalMethod TEXT;
ALTER TABLE observations ADD COLUMN validationResult TEXT;

-- Fetch latency for adapter health / source registry.
ALTER TABLE data_fetch_logs ADD COLUMN latencyMs INTEGER;
`,
  },
  {
    id: "003_license_cache_retry",
    sql: `
-- License / terms attribution on every observation.
ALTER TABLE observations ADD COLUMN license TEXT;

-- HTTP response cache (ETag / body hash) to skip unchanged upstream payloads.
CREATE TABLE IF NOT EXISTS fetch_cache (
  sourceId      TEXT PRIMARY KEY,
  etag          TEXT,
  lastModified  TEXT,
  bodyHash      TEXT,
  status        TEXT NOT NULL DEFAULT 'OK',
  cachedAt      TEXT NOT NULL,
  expiresAt     TEXT,
  metaJson      TEXT
);

-- Retry queue with exponential backoff.
CREATE TABLE IF NOT EXISTS adapter_retry_queue (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceId      TEXT NOT NULL,
  adapterId     TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  maxAttempts   INTEGER NOT NULL DEFAULT 3,
  nextAttemptAt TEXT NOT NULL,
  lastError     TEXT,
  status        TEXT NOT NULL DEFAULT 'PENDING',
  createdAt     TEXT NOT NULL,
  updatedAt     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_retry_next
  ON adapter_retry_queue (status, nextAttemptAt);

-- Dead-letter store for exhausted retries.
CREATE TABLE IF NOT EXISTS adapter_dead_letters (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sourceId      TEXT NOT NULL,
  adapterId     TEXT,
  attempts      INTEGER NOT NULL,
  lastError     TEXT,
  payloadJson   TEXT,
  createdAt     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_source
  ON adapter_dead_letters (sourceId, createdAt);
`,
  },
];
