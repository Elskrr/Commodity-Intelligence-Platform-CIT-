import { balticIndexAdapter } from "@/adapters/baltic-index";
import { brentAdapter } from "@/adapters/brent";
import { cnyFxAdapter } from "@/adapters/cny-fx";
import { ecbFxAdapter, publicFxJsonAdapter } from "@/adapters/ecb-fx";
import {
  bankOfCanadaFxAdapter,
  ecbOfficialFxAdapter,
  fedFxAdapter,
} from "@/adapters/fx";
import {
  canadaPolicyAdapter,
  chinaPolicyAdapter,
  genericRssAdapter,
  indiaPolicyAdapter,
  iranPolicyAdapter,
  qatarPolicyAdapter,
  russiaPolicyAdapter,
  saudiPolicyAdapter,
  uaePolicyAdapter,
} from "@/adapters/policy";
import {
  genericCsvAdapter,
  genericHtmlAdapter,
  genericJsonAdapter,
  genericXmlAdapter,
} from "@/adapters/generic";
import {
  containerIndexAdapter,
  cpiInflationAdapter,
  dollarIndexAdapter,
  fedFundsAdapter,
  naturalGasAdapter,
} from "@/adapters/macro";
import {
  cfrChinaAdapter,
  chinaPortInventoryAdapter,
  customsExportAdapter,
  customsImportAdapter,
  dapUtilizationAdapter,
  domesticLiquidAdapter,
  excelTemplateAdapter,
  freightAdapter,
  mapUtilizationAdapter,
  middleEastFobAdapter,
  pdfTemplateAdapter,
  vesselAdapter,
  zhenjiangPriceAdapter,
} from "@/adapters/templates/physical";
import type { RegisteredAdapter } from "@/adapters/types";
import { wtiAdapter } from "@/adapters/wti";
import { publicHtmlTableAdapter } from "@/lib/data-sources/public-web/public-html-table";
import { publicRssAdapter } from "@/lib/data-sources/public-web/public-rss";
import { manualRequiredAdapter } from "@/lib/data-sources/official/manual-required";
import type { DataSourceAdapter } from "@/lib/data-sources/base-source";

function withMeta(
  adapter: DataSourceAdapter,
  meta: Pick<RegisteredAdapter, "schedule" | "accessLabel">,
): RegisteredAdapter {
  return { ...adapter, ...meta };
}

/**
 * Canonical adapter registry — data-source-first entry point.
 */
const REGISTERED: RegisteredAdapter[] = [
  // --- REAL / PUBLIC FX ---
  ecbOfficialFxAdapter,
  {
    ...ecbFxAdapter,
    accessLabel: "REAL",
    schedule: {
      ...ecbFxAdapter.schedule,
      refreshIntervalMinutes: 1440,
      priority: "critical",
    },
  },
  {
    ...publicFxJsonAdapter,
    schedule: ecbFxAdapter.schedule,
    accessLabel: "REAL",
  },
  {
    ...cnyFxAdapter,
    accessLabel: "REAL",
    schedule: {
      ...cnyFxAdapter.schedule,
      refreshIntervalMinutes: 1440,
      priority: "high",
    },
  },
  bankOfCanadaFxAdapter,
  fedFxAdapter,

  // --- REAL energy / shipping / macro ---
  { ...brentAdapter, accessLabel: "REAL" },
  { ...wtiAdapter, accessLabel: "REAL" },
  { ...balticIndexAdapter, accessLabel: "REAL" },
  naturalGasAdapter,
  dollarIndexAdapter,
  fedFundsAdapter,
  cpiInflationAdapter,
  containerIndexAdapter,

  // --- Generic public formats ---
  genericCsvAdapter,
  genericJsonAdapter,
  genericXmlAdapter,
  genericHtmlAdapter,

  // --- Policy RSS (PUBLIC when URL configured) ---
  chinaPolicyAdapter,
  russiaPolicyAdapter,
  saudiPolicyAdapter,
  qatarPolicyAdapter,
  uaePolicyAdapter,
  canadaPolicyAdapter,
  indiaPolicyAdapter,
  iranPolicyAdapter,
  genericRssAdapter,

  // --- TEMPLATE / MANUAL physical & paid ---
  chinaPortInventoryAdapter,
  zhenjiangPriceAdapter,
  domesticLiquidAdapter,
  mapUtilizationAdapter,
  dapUtilizationAdapter,
  freightAdapter,
  vesselAdapter,
  customsImportAdapter,
  customsExportAdapter,
  middleEastFobAdapter,
  cfrChinaAdapter,
  pdfTemplateAdapter,
  excelTemplateAdapter,
  withMeta(publicHtmlTableAdapter, {
    accessLabel: "PUBLIC",
    schedule: {
      refreshIntervalMinutes: 60,
      priority: "normal",
      timeoutMs: 15_000,
      maxRetries: 2,
      backoffMinutes: 60,
    },
  }),
  withMeta(publicRssAdapter, {
    accessLabel: "PUBLIC",
    schedule: {
      refreshIntervalMinutes: 30,
      priority: "normal",
      timeoutMs: 15_000,
      maxRetries: 2,
      backoffMinutes: 60,
    },
  }),
  withMeta(manualRequiredAdapter, {
    accessLabel: "MANUAL",
    schedule: {
      refreshIntervalMinutes: 1440,
      priority: "low",
      timeoutMs: 1_000,
      maxRetries: 0,
      backoffMinutes: 1440,
    },
  }),
];

const BY_ID: Record<string, RegisteredAdapter> = Object.fromEntries(
  REGISTERED.map((adapter) => [adapter.id, adapter]),
);

export function getRegisteredAdapter(
  id: string | null,
): RegisteredAdapter | undefined {
  return id ? BY_ID[id] : undefined;
}

export function listRegisteredAdapters(): RegisteredAdapter[] {
  return REGISTERED;
}

export function getAdapter(id: string | null): DataSourceAdapter | undefined {
  return getRegisteredAdapter(id);
}

export function listAdapters(): DataSourceAdapter[] {
  return REGISTERED;
}

export { BY_ID as ADAPTER_REGISTRY };
