import { BaseAdapter, schedule } from "@/adapters/base-adapter";
import { resolveTargets } from "@/adapters/shared/resolve-targets";
import { cachedFetch } from "@/adapters/shared/cached-fetch";
import type {
  NormalizedObservation,
  RawDataRecord,
} from "@/lib/data-sources/base-source";
import { settings } from "@/lib/db/repositories";
import type { SourceRow } from "@/types/db";

type Mapping = {
  commodityId: string;
  indicatorCode: string;
  dateField?: string;
  valueField?: string;
  columnIndexDate?: number;
  columnIndexValue?: number;
};

function mappingFor(source: SourceRow): Mapping | null {
  return settings.getJson<Mapping | null>(`adapter.mapping.${source.id}`, null);
}

/** Generic public CSV → observation. Mapping in Settings: adapter.mapping.{sourceId} */
export class GenericCsvAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "generic-csv",
      name: "Generic Public CSV",
      accessLabel: "PUBLIC",
      license: "Depends on upstream CSV license",
      schedule: schedule(360, { priority: "normal" }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    if (!source.url) throw new Error("generic-csv requires source.url");
    const result = await cachedFetch(source.id, source.url);
    if (result.notModified) return [{ __notModified: true }];
    return [{ csv: result.text }];
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    if (records[0]?.__notModified) return [];
    const mapping = mappingFor(source);
    if (!mapping) {
      throw new Error(
        `Configure adapter.mapping.${source.id} with commodityId, indicatorCode, column indexes`,
      );
    }
    const csv = String(records[0]?.csv ?? "");
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const dateIdx = mapping.columnIndexDate ?? 0;
    const valueIdx = mapping.columnIndexValue ?? 1;
    const rows: NormalizedObservation[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const date = cols[dateIdx]?.trim();
      const value = Number(cols[valueIdx]);
      if (!date || !Number.isFinite(value)) continue;
      rows.push({
        commodityId: mapping.commodityId,
        indicatorCode: mapping.indicatorCode,
        value,
        timestamp: date.slice(0, 10),
        quality: "NORMAL",
        confidence: 75,
        retrievalMethod: "PUBLIC_CSV",
        validationResult: "ok",
        license: this.license,
      });
    }
    return rows.slice(-1);
  }
}

export const genericCsvAdapter = new GenericCsvAdapter();

/** Generic public JSON — mapping selects path keys for date/value. */
export class GenericJsonAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "generic-json",
      name: "Generic Public JSON",
      accessLabel: "PUBLIC",
      license: "Depends on upstream JSON license",
      schedule: schedule(360, { priority: "normal" }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    if (!source.url) throw new Error("generic-json requires source.url");
    const result = await cachedFetch(source.id, source.url);
    if (result.notModified) return [{ __notModified: true }];
    return [{ json: JSON.parse(result.text) }];
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    if (records[0]?.__notModified) return [];
    const linked = resolveTargets(source);
    const mapping = mappingFor(source) ?? {
      commodityId: linked[0]?.commodityId,
      indicatorCode: linked[0]?.indicatorCode,
      dateField: "date",
      valueField: "value",
    };
    if (!mapping.commodityId || !mapping.indicatorCode) {
      throw new Error(`Configure adapter.mapping.${source.id}`);
    }
    const payload = records[0]?.json as Record<string, unknown> | unknown[];
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { data?: unknown[] })?.data)
        ? ((payload as { data: unknown[] }).data)
        : [payload];
    const dateField = mapping.dateField ?? "date";
    const valueField = mapping.valueField ?? "value";
    const out: NormalizedObservation[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const date = String(row[dateField] ?? "");
      const value = Number(row[valueField]);
      if (!/^\d{4}-\d{2}-\d{2}/.test(date) || !Number.isFinite(value)) continue;
      out.push({
        commodityId: mapping.commodityId,
        indicatorCode: mapping.indicatorCode,
        value,
        timestamp: date.slice(0, 10),
        quality: "NORMAL",
        confidence: 75,
        retrievalMethod: "PUBLIC_JSON",
        validationResult: "ok",
        license: this.license,
      });
    }
    return out.slice(-1);
  }
}

export const genericJsonAdapter = new GenericJsonAdapter();

/** Generic public XML — extracts first matching numeric leaf heuristically. */
export class GenericXmlAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "generic-xml",
      name: "Generic Public XML",
      accessLabel: "PUBLIC",
      license: "Depends on upstream XML license",
      schedule: schedule(360, { priority: "normal" }),
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    if (!source.url) throw new Error("generic-xml requires source.url");
    const result = await cachedFetch(source.id, source.url);
    if (result.notModified) return [{ __notModified: true }];
    return [{ xml: result.text }];
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    if (records[0]?.__notModified) return [];
    const targets = resolveTargets(source);
    if (targets.length === 0) {
      throw new Error(`Link indicators or set adapter.mapping.${source.id}`);
    }
    const xml = String(records[0]?.xml ?? "");
    const date =
      xml.match(/<ObsDimension[^>]*value="(\d{4}-\d{2}-\d{2})"/i)?.[1] ??
      xml.match(/>(\d{4}-\d{2}-\d{2})</)?.[1];
    const valueRaw =
      xml.match(/<ObsValue[^>]*value="([0-9.]+)"/i)?.[1] ??
      xml.match(/<value>([0-9.]+)<\/value>/i)?.[1];
    const value = Number(valueRaw);
    if (!date || !Number.isFinite(value)) {
      throw new Error("generic-xml could not parse date/value — refine upstream or use MANUAL");
    }
    return targets.map((target) => ({
      commodityId: target.commodityId,
      indicatorCode: target.indicatorCode,
      value,
      timestamp: date,
      quality: "NORMAL" as const,
      confidence: 70,
      retrievalMethod: "PUBLIC_XML" as const,
      validationResult: "ok",
      license: this.license,
    }));
  }
}

export const genericXmlAdapter = new GenericXmlAdapter();

/**
 * Generic public HTML table — mapping via Settings `adapter.html-table.{sourceId}`.
 * Same contract as legacy `public-html-table`; prefer this id for new sources.
 */
export class GenericHtmlTableAdapter extends BaseAdapter {
  constructor() {
    super({
      id: "generic-html",
      name: "Generic Public HTML Table",
      accessLabel: "PUBLIC",
      license: "Depends on upstream page terms — robots-checked",
      schedule: schedule(60, { priority: "normal", maxRetries: 2, backoffMinutes: 60 }),
      defaultConfidence: 70,
    });
  }

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const { getHtmlTableMapping, parseHtmlTable } = await import(
      "@/lib/data-sources/public-web/public-html-table"
    );
    const mapping = getHtmlTableMapping(source.id);
    const url = mapping?.url ?? source.url;
    if (!url) {
      throw new Error(
        "Configure adapter.html-table." +
          source.id +
          " (url + columns) or set source.url",
      );
    }
    const result = await cachedFetch(source.id, url);
    if (result.notModified) return [{ __notModified: true }];
    const rows = parseHtmlTable(result.text);
    return rows.slice(mapping?.skipRows ?? 1).map((cells) => ({ cells }));
  }

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    if (records[0]?.__notModified) return [];
    const { getHtmlTableMapping } = await import(
      "@/lib/data-sources/public-web/public-html-table"
    );
    const mapping = getHtmlTableMapping(source.id);
    if (!mapping) {
      throw new Error(`Configure adapter.html-table.${source.id}`);
    }

    const output: NormalizedObservation[] = [];
    for (const record of records) {
      const cells = record.cells as string[];
      const rawDate = cells[mapping.dateColumn] ?? "";
      let timestamp: string | null = null;
      if (mapping.dateFormat === "cn") {
        const m = rawDate.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
        if (m) {
          timestamp = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
        }
      } else {
        timestamp = rawDate.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
      }
      if (!timestamp) continue;

      for (const column of mapping.valueColumns) {
        const cleaned = (cells[column.column] ?? "").replace(/[^\d.\-]/g, "");
        const value = Number(cleaned);
        if (!Number.isFinite(value)) continue;
        output.push({
          commodityId: mapping.commodityId,
          indicatorCode: column.indicatorCode,
          value,
          timestamp,
          quality: "NORMAL",
          confidence: this.defaultConfidence,
          retrievalMethod: "PUBLIC_HTML",
          validationResult: "ok",
          license: this.license,
          note: `Parsed from ${mapping.url}`,
        });
      }
    }
    return output;
  }
}

export const genericHtmlAdapter = new GenericHtmlTableAdapter();
