import { SettingsWorkspace } from "@/components/system/settings-workspace";
import { DEFAULT_COMMODITY_ID, getCommodityConfig } from "@/config/commodities";
import { ensureReady } from "@/lib/bootstrap";
import { DB_PATH } from "@/lib/db/client";
import { settings } from "@/lib/db/repositories";
import { getScoreWeights } from "@/lib/engines/market-score";
import { getReportTime } from "@/lib/scheduler";
import { getAlertRules, getIndicatorOptions } from "@/server/queries";

// Reads live database state on every request; never prerender.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  ensureReady();

  const commodityId = DEFAULT_COMMODITY_ID;
  const config = getCommodityConfig(commodityId);
  const weights = config ? getScoreWeights(config) : {};

  return (
    <SettingsWorkspace
      commodityId={commodityId}
      scoreFactors={(config?.scoreFactors ?? []).map((factor) => ({
        key: factor.key,
        label: factor.label,
        labelZh: factor.labelZh,
        weight: weights[factor.key] ?? factor.weight,
        explanation: factor.explanation,
      }))}
      alertRules={getAlertRules(commodityId)}
      indicators={getIndicatorOptions(commodityId)}
      general={{
        reportTime: getReportTime(),
        notifications: settings.get("notifications.enabled") !== "0",
        defaultInterval: Number(
          settings.get("scheduler.defaultInterval") ?? 60,
        ),
      }}
      ai={{
        provider: settings.get("ai.provider") ?? process.env.AI_PROVIDER ?? "local",
        model: settings.get("ai.model") ?? process.env.AI_MODEL ?? "",
        hasApiKey: Boolean(process.env.AI_API_KEY),
        baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
      }}
      dbPath={DB_PATH}
    />
  );
}
