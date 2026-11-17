import { cloudAnalysisProvider } from "@/lib/analysis/cloud";
import { localTemplateProvider } from "@/lib/analysis/local-template";
import type {
  AnalysisContext,
  AnalysisOutlook,
  AnalysisProvider,
} from "@/lib/analysis/types";
import { isPublicDemo } from "@/lib/public-data/mode";
import { settings } from "@/lib/db/repositories";

/**
 * Provider selection. The stored setting wins over the environment variable so
 * the choice can be made in Settings without editing `.env`.
 *
 * Public demo always uses the offline local template — never cloud / paid APIs.
 */
export function getAnalysisProvider(): AnalysisProvider {
  if (isPublicDemo()) return localTemplateProvider;

  const configured =
    settings.get("ai.provider") ?? process.env.AI_PROVIDER ?? "local";
  return configured === "cloud" ? cloudAnalysisProvider : localTemplateProvider;
}

export function generateMarketAnalysis(
  context: AnalysisContext,
): Promise<AnalysisOutlook> {
  return getAnalysisProvider().generateMarketAnalysis(context);
}

export type { AnalysisContext, AnalysisOutlook, AnalysisProvider };
