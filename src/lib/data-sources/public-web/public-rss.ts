import {
  defaultValidate,
  politeFetch,
  type DataSourceAdapter,
  type NormalizedEvent,
  type NormalizedObservation,
  type RawDataRecord,
} from "@/lib/data-sources/base-source";
import { settings } from "@/lib/db/repositories";
import type { EventCategory, SourceRow } from "@/types/db";

/**
 * RSS news adapter.
 *
 * Ingested items are stored as market events with status REVIEW and
 * `classifiedBy = KEYWORD`: nothing an automated classifier produces becomes
 * confirmed intelligence until an analyst approves it, and the source URL is
 * always retained.
 */

const FEEDS_KEY = "adapter.rss.feeds";

export type RssFeedConfig = {
  url: string;
  commodityId: string;
  /** Only headlines containing one of these terms are ingested. */
  keywords: string[];
};

export function getRssFeeds(): RssFeedConfig[] {
  return settings.getJson<RssFeedConfig[]>(FEEDS_KEY, []);
}

export function saveRssFeeds(feeds: RssFeedConfig[]) {
  settings.setJson(FEEDS_KEY, feeds);
}

type Item = { title: string; link: string; date: string; description: string };

function stripTags(value: string): string {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseRss(xml: string): Item[] {
  const items: Item[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];

  for (const block of blocks) {
    const title = stripTags(
      block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
    );
    const link =
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() ??
      block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ??
      "";
    const rawDate =
      block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1] ??
      block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i)?.[1] ??
      "";
    const description = stripTags(
      block.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ??
        block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ??
        "",
    );

    const parsed = new Date(rawDate.trim());
    items.push({
      title,
      link: stripTags(link),
      description,
      date: Number.isNaN(parsed.getTime())
        ? new Date().toISOString()
        : parsed.toISOString(),
    });
  }

  return items.filter((item) => item.title);
}

/** Keyword classifier. Deliberately conservative — output requires review. */
const CATEGORY_KEYWORDS: { category: EventCategory; terms: string[] }[] = [
  { category: "EXPORT_BAN", terms: ["export ban", "禁止出口"] },
  { category: "EXPORT_RESTRICTION", terms: ["export restriction", "export quota", "出口限制", "出口配额"] },
  { category: "SANCTIONS", terms: ["sanction", "制裁"] },
  { category: "PLANT_OUTAGE", terms: ["outage", "turnaround", "shutdown", "检修", "停车"] },
  { category: "SHIPPING_DISRUPTION", terms: ["blockade", "disruption", "delay", "封锁", "延误"] },
  { category: "SHIPPING_RECOVERY", terms: ["resume", "recovery", "reopen", "恢复"] },
  { category: "GOVERNMENT_POLICY", terms: ["policy", "regulation", "政策", "监管"] },
  { category: "IMPORT_POLICY", terms: ["import duty", "import tariff", "进口关税"] },
  { category: "INVENTORY_EVENT", terms: ["inventory", "stocks", "库存"] },
  { category: "DEMAND_EVENT", terms: ["demand", "utilization", "需求", "开工"] },
];

function classify(title: string): EventCategory {
  const haystack = title.toLowerCase();
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.terms.some((term) => haystack.includes(term.toLowerCase()))) {
      return entry.category;
    }
  }
  return "GOVERNMENT_POLICY";
}

function hashId(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return `rss-${(hash >>> 0).toString(36)}`;
}

export const publicRssAdapter: DataSourceAdapter = {
  id: "public-rss",
  name: "Public RSS feed",

  async fetch(): Promise<RawDataRecord[]> {
    const feeds = getRssFeeds();
    if (feeds.length === 0) {
      throw new Error(
        "No RSS feeds configured — add a permitted feed URL in Settings",
      );
    }

    const records: RawDataRecord[] = [];
    for (const feed of feeds) {
      const response = await politeFetch(feed.url);
      const items = parseRss(await response.text());
      for (const item of items) {
        const haystack = `${item.title} ${item.description}`.toLowerCase();
        const matches =
          feed.keywords.length === 0 ||
          feed.keywords.some((keyword) =>
            haystack.includes(keyword.toLowerCase()),
          );
        if (matches) records.push({ ...item, commodityId: feed.commodityId });
      }
    }
    return records;
  },

  /** This adapter produces events rather than numeric observations. */
  async normalize(): Promise<NormalizedObservation[]> {
    return [];
  },

  validate: defaultValidate,

  async persist(): Promise<number> {
    return 0;
  },

  async fetchEvents(source: SourceRow): Promise<NormalizedEvent[]> {
    const records = await publicRssAdapter.fetch(source);
    return records.map((record) => {
      const title = String(record.title);
      return {
        id: hashId(`${record.commodityId}:${title}`),
        commodityId: String(record.commodityId),
        timestamp: String(record.date),
        country: null,
        countryZh: null,
        region: null,
        category: classify(title),
        title,
        titleZh: "",
        summary: String(record.description ?? ""),
        summaryZh: "",
        sourceUrl: String(record.link ?? ""),
        impactDirection: "NEUTRAL" as const,
        impactScore: 0,
        confidence: 40,
        severity: "LOW" as const,
        status: "REVIEW" as const,
        classifiedBy: "KEYWORD",
      };
    });
  },
};
