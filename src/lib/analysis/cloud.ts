import { localTemplateProvider } from "@/lib/analysis/local-template";
import type {
  AnalysisContext,
  AnalysisOutlook,
  AnalysisProvider,
} from "@/lib/analysis/types";

/**
 * Cloud analysis provider (OpenAI-compatible chat completions).
 *
 * Disabled unless AI_PROVIDER=cloud and AI_API_KEY are set. It sends only the
 * bounded context object, and falls back to the deterministic local provider on
 * any error so the terminal never blocks on a network call.
 */
export const cloudAnalysisProvider: AnalysisProvider = {
  id: "cloud-ai",

  async generateMarketAnalysis(
    context: AnalysisContext,
  ): Promise<AnalysisOutlook> {
    const apiKey = process.env.AI_API_KEY;
    const model = process.env.AI_MODEL ?? "gpt-4o-mini";
    const baseUrl = process.env.AI_BASE_URL ?? "https://api.openai.com/v1";

    if (!apiKey) {
      return localTemplateProvider.generateMarketAnalysis(context);
    }

    const baseline = await localTemplateProvider.generateMarketAnalysis(context);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a commodity market analyst. Use only the supplied JSON context. Never invent numbers. Reply with JSON matching: {narrative: string[], narrativeZh: string[], upsideRisks: {en,zh}[], downsideRisks: {en,zh}[], watchNext: {en,zh}[]}.",
            },
            { role: "user", content: JSON.stringify(context) },
          ],
        }),
      });

      if (!response.ok) return baseline;

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) return baseline;

      const parsed = JSON.parse(content) as Partial<AnalysisOutlook>;

      return {
        ...baseline,
        narrative: parsed.narrative ?? baseline.narrative,
        narrativeZh: parsed.narrativeZh ?? baseline.narrativeZh,
        upsideRisks: parsed.upsideRisks ?? baseline.upsideRisks,
        downsideRisks: parsed.downsideRisks ?? baseline.downsideRisks,
        watchNext: parsed.watchNext ?? baseline.watchNext,
        provider: `cloud-ai:${model}`,
      };
    } catch {
      return baseline;
    }
  },
};
