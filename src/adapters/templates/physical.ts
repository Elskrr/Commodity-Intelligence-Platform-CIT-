import type { RegisteredAdapter } from "@/adapters/types";
import {
  defaultPersist,
  defaultValidate,
  type NormalizedObservation,
  type RawDataRecord,
} from "@/lib/data-sources/base-source";
import type { SourceRow } from "@/types/db";

/**
 * Template adapters for Phase 2 sulphur physical series.
 * They stay MANUAL_REQUIRED / TEMPLATE until a permitted URL is configured.
 * Prefer Manual Input over fabricating scraped access.
 */

function makeTemplateAdapter(opts: {
  id: string;
  name: string;
  reason: string;
}): RegisteredAdapter {
  return {
    id: opts.id,
    name: opts.name,
    accessLabel: "TEMPLATE",
    schedule: {
      refreshIntervalMinutes: 360,
      priority: "normal",
      timeoutMs: 15_000,
      maxRetries: 1,
      backoffMinutes: 120,
    },
    async fetch(source: SourceRow): Promise<RawDataRecord[]> {
      throw new Error(
        `${opts.reason} Source ${source.id}. Use Manual Input, HTML/PDF/Excel upload, or configure a permitted public URL.`,
      );
    },
    async normalize(): Promise<NormalizedObservation[]> {
      return [];
    },
    validate: defaultValidate,
    persist: defaultPersist,
  };
}

export const chinaPortInventoryAdapter = makeTemplateAdapter({
  id: "china-port-inventory",
  name: "China Port Inventory",
  reason:
    "Port inventory is typically subscription or interactive-portal data (MANUAL / TEMPLATE).",
});

export const zhenjiangPriceAdapter = makeTemplateAdapter({
  id: "zhenjiang-price",
  name: "Zhenjiang Port Price",
  reason: "Zhenjiang quotations are usually paywalled industry assessments.",
});

export const domesticLiquidAdapter = makeTemplateAdapter({
  id: "domestic-liquid",
  name: "Domestic Liquid Sulphur",
  reason: "Domestic liquid sulphur is survey-based.",
});

export const mapUtilizationAdapter = makeTemplateAdapter({
  id: "map-utilization",
  name: "MAP Utilization",
  reason: "MAP operating rates are survey-based.",
});

export const dapUtilizationAdapter = makeTemplateAdapter({
  id: "dap-utilization",
  name: "DAP Utilization",
  reason: "DAP operating rates are survey-based.",
});

export const freightAdapter = makeTemplateAdapter({
  id: "freight",
  name: "Freight Routes",
  reason: "Route freight is broker/survey data without a free public feed.",
});

export const vesselAdapter = makeTemplateAdapter({
  id: "vessel",
  name: "Vessel Line-up",
  reason: "Vessel line-ups are operator/portal data.",
});

export const customsImportAdapter = makeTemplateAdapter({
  id: "customs-import",
  name: "Customs Import",
  reason: "China Customs public queries require interactive sessions.",
});

export const customsExportAdapter = makeTemplateAdapter({
  id: "customs-export",
  name: "Customs Export",
  reason: "Customs export micro-data is not reliably automatable.",
});

export const pdfTemplateAdapter = makeTemplateAdapter({
  id: "pdf",
  name: "PDF Document Template",
  reason: "PDF ingestion is LOCAL_FILE / MANUAL until a parser is configured.",
});

export const excelTemplateAdapter = makeTemplateAdapter({
  id: "excel",
  name: "Excel Document Template",
  reason: "Excel ingestion is LOCAL_FILE / MANUAL until a parser is configured.",
});

export const middleEastFobAdapter = makeTemplateAdapter({
  id: "middle-east-fob",
  name: "Middle East FOB",
  reason: "ME FOB assessments are typically subscription (Argus/CRU/etc.).",
});

export const cfrChinaAdapter = makeTemplateAdapter({
  id: "cfr-china",
  name: "CFR China",
  reason: "CFR China assessments are typically subscription.",
});
