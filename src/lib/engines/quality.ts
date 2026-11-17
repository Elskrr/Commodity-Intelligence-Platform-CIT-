import type { Freshness, Frequency, ObservationRow, Quality } from "@/types/db";

/**
 * Freshness and data-quality rules.
 *
 * Physical commodity assessments are not continuously traded, so freshness is
 * measured against each indicator's expected publication frequency rather than
 * against wall-clock seconds.
 */

const DAY_MS = 86_400_000;

/** Expected gap between observations, in days. */
export const FREQUENCY_DAYS: Record<Frequency, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 31,
  QUARTERLY: 92,
  IRREGULAR: 45,
};

export const FREQUENCY_LABELS: Record<Frequency, { en: string; zh: string }> = {
  DAILY: { en: "Daily", zh: "日频" },
  WEEKLY: { en: "Weekly", zh: "周频" },
  MONTHLY: { en: "Monthly", zh: "月频" },
  QUARTERLY: { en: "Quarterly", zh: "季频" },
  IRREGULAR: { en: "Irregular", zh: "不定期" },
};

export const FRESHNESS_LABELS: Record<Freshness, { en: string; zh: string }> = {
  LIVE: { en: "Live", zh: "实时" },
  FRESH: { en: "Fresh", zh: "新鲜" },
  STALE: { en: "Stale", zh: "陈旧" },
  MANUAL: { en: "Manual", zh: "手工" },
  NO_DATA: { en: "No data", zh: "无数据" },
};

/**
 * LIVE  — newer than a quarter of the expected interval (intraday-ish updates)
 * FRESH — within the expected interval
 * STALE — older than twice the expected interval
 */
export function computeFreshness(
  latest: ObservationRow | undefined,
  frequency: Frequency,
  now: Date = new Date(),
): { freshness: Freshness; ageDays: number | null } {
  if (!latest) return { freshness: "NO_DATA", ageDays: null };

  const observed = new Date(
    latest.timestamp.length <= 10
      ? `${latest.timestamp}T00:00:00Z`
      : latest.timestamp,
  ).getTime();
  const ageDays = Math.max(0, (now.getTime() - observed) / DAY_MS);
  const expected = FREQUENCY_DAYS[frequency];

  if (latest.isManual === 1) return { freshness: "MANUAL", ageDays };
  if (ageDays > expected * 2) return { freshness: "STALE", ageDays };
  if (ageDays <= expected * 0.25) return { freshness: "LIVE", ageDays };
  return { freshness: "FRESH", ageDays };
}

export type AnomalyCheck = {
  ok: boolean;
  quality: Quality;
  reason?: string;
  reasonZh?: string;
};

/**
 * Guards against unit and parsing errors: a value that jumps by an order of
 * magnitude is flagged rather than silently accepted.
 */
export function checkAnomaly(
  value: number,
  previous: number | null | undefined,
): AnomalyCheck {
  if (previous === null || previous === undefined || previous === 0) {
    return { ok: true, quality: "NORMAL" };
  }

  const ratio = value / previous;
  if (ratio >= 5 || ratio <= 0.2) {
    return {
      ok: false,
      quality: "CONFLICT",
      reason: `Possible unit or parsing error: ${previous} → ${value}`,
      reasonZh: `疑似单位或解析错误：${previous} → ${value}`,
    };
  }

  const changePct = Math.abs((value - previous) / previous) * 100;
  if (changePct >= 25) {
    return {
      ok: true,
      quality: "ESTIMATED",
      reason: `Large single-period move of ${changePct.toFixed(1)}% — review before relying on it`,
      reasonZh: `单期变动达 ${changePct.toFixed(1)}%，请复核后使用`,
    };
  }

  return { ok: true, quality: "NORMAL" };
}

export const QUALITY_LABELS: Record<Quality, { en: string; zh: string }> = {
  VERIFIED: { en: "Verified", zh: "已核实" },
  NORMAL: { en: "Normal", zh: "正常" },
  ESTIMATED: { en: "Estimated", zh: "估算" },
  STALE: { en: "Stale", zh: "陈旧" },
  CONFLICT: { en: "Conflict", zh: "冲突" },
  MANUAL: { en: "Manual", zh: "手工" },
};
