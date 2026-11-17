import {
  defaultPersist,
  defaultValidate,
  politeFetch,
  type DataSourceAdapter,
  type NormalizedObservation,
  type RawDataRecord,
} from "@/lib/data-sources/base-source";
import { settings } from "@/lib/db/repositories";
import type { SourceRow } from "@/types/db";

/**
 * Template adapter for a publicly accessible static HTML table.
 *
 * Ships disabled and unconfigured on purpose. Point it at a page whose terms of
 * use permit automated access, describe the columns in Settings, then enable
 * the source. It performs no JavaScript execution and no anti-bot evasion; if a
 * page needs either, mark the source MANUAL_REQUIRED instead.
 */

export type HtmlTableMapping = {
  /** Absolute URL of the page containing the table. */
  url: string;
  commodityId: string;
  /** Zero-based column holding the observation date. */
  dateColumn: number;
  /** Column index → indicator code. */
  valueColumns: { column: number; indicatorCode: string }[];
  /** Rows to skip (headers). */
  skipRows?: number;
  /** Optional date format hint: "iso" | "cn" (YYYY年M月D日). */
  dateFormat?: "iso" | "cn";
};

const MAPPING_KEY = (sourceId: string) => `adapter.html-table.${sourceId}`;

export function getHtmlTableMapping(
  sourceId: string,
): HtmlTableMapping | null {
  return settings.getJson<HtmlTableMapping | null>(MAPPING_KEY(sourceId), null);
}

export function saveHtmlTableMapping(
  sourceId: string,
  mapping: HtmlTableMapping,
) {
  settings.setJson(MAPPING_KEY(sourceId), mapping);
}

/** Extracts rows of plain-text cells from the first table in the document. */
export function parseHtmlTable(html: string): string[][] {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (!tableMatch) return [];

  const rows: string[][] = [];
  const rowRegex = /<tr[\s\S]*?<\/tr>/gi;
  const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;

  for (const rowHtml of tableMatch[0].match(rowRegex) ?? []) {
    const cells: string[] = [];
    let cell: RegExpExecArray | null;
    cellRegex.lastIndex = 0;
    while ((cell = cellRegex.exec(rowHtml)) !== null) {
      cells.push(
        cell[1]
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim(),
      );
    }
    if (cells.length > 0) rows.push(cells);
  }

  return rows;
}

function parseDate(raw: string, format: "iso" | "cn" = "iso"): string | null {
  if (format === "cn") {
    const match = raw.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!match) return null;
    return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  }
  const match = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : null;
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export const publicHtmlTableAdapter: DataSourceAdapter = {
  id: "public-html-table",
  name: "Public HTML table",

  async fetch(source: SourceRow): Promise<RawDataRecord[]> {
    const mapping = getHtmlTableMapping(source.id);
    if (!mapping?.url) {
      throw new Error(
        "No table mapping configured — configure it in Settings or keep this source MANUAL_REQUIRED",
      );
    }

    const response = await politeFetch(mapping.url);
    const rows = parseHtmlTable(await response.text());
    return rows.slice(mapping.skipRows ?? 1).map((cells) => ({ cells }));
  },

  async normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]> {
    const mapping = getHtmlTableMapping(source.id);
    if (!mapping) return [];

    const output: NormalizedObservation[] = [];
    for (const record of records) {
      const cells = record.cells as string[];
      const timestamp = parseDate(
        cells[mapping.dateColumn] ?? "",
        mapping.dateFormat,
      );
      if (!timestamp) continue;

      for (const column of mapping.valueColumns) {
        const value = parseNumber(cells[column.column] ?? "");
        if (value === null) continue;
        output.push({
          commodityId: mapping.commodityId,
          indicatorCode: column.indicatorCode,
          value,
          timestamp,
          note: `Parsed from ${mapping.url}`,
          quality: "NORMAL",
          confidence: 70,
          retrievalMethod: "PUBLIC_HTML",
          validationResult: "ok",
          license: "Depends on upstream page terms — robots-checked",
        });
      }
    }
    return output;
  },

  validate: defaultValidate,
  persist: defaultPersist,
};
