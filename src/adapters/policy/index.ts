import { parseNewsToEvent } from "@/adapters/news/parser";
import type { RegisteredAdapter } from "@/adapters/types";
import {
  defaultPersist,
  defaultValidate,
  politeFetch,
  type NormalizedEvent,
  type NormalizedObservation,
  type RawDataRecord,
} from "@/lib/data-sources/base-source";
import { settings } from "@/lib/db/repositories";
import type { SourceRow } from "@/types/db";
import { DEFAULT_COMMODITY_ID } from "@/config/commodities";

type PolicyProfile = {
  id: string;
  name: string;
  country: string;
  countryZh: string;
  defaultFeeds: string[];
};

function makePolicyAdapter(profile: PolicyProfile): RegisteredAdapter {
  return {
    id: profile.id,
    name: profile.name,
    accessLabel: "PUBLIC",
    schedule: {
      refreshIntervalMinutes: profile.id === "rss" ? 30 : 180,
      priority: "normal",
      timeoutMs: 15_000,
      maxRetries: 2,
      backoffMinutes: 60,
    },

    async fetch(): Promise<RawDataRecord[]> {
      return [];
    },

    async normalize(): Promise<NormalizedObservation[]> {
      return [];
    },

    validate: defaultValidate,
    persist: defaultPersist,

    async fetchEvents(source: SourceRow): Promise<NormalizedEvent[]> {
      const configured = settings.getJson<string[]>(
        `adapter.rss.feeds.${source.id}`,
        [],
      );
      const feeds =
        configured.length > 0
          ? configured
          : source.url
            ? [source.url]
            : profile.defaultFeeds;

      if (feeds.length === 0) {
        throw new Error(
          `No RSS/Atom feed configured for ${profile.id}. Set source URL or adapter.rss.feeds.${source.id}.`,
        );
      }

      const events: NormalizedEvent[] = [];
      for (const feedUrl of feeds) {
        const response = await politeFetch(feedUrl);
        const xml = await response.text();
        const items = extractRssItems(xml).slice(0, 12);
        for (const item of items) {
          const draft = parseNewsToEvent({
            title: item.title,
            summary: item.summary,
            sourceUrl: item.link,
            defaultCountry: profile.country,
            defaultCountryZh: profile.countryZh,
          });
          const commodityId =
            draft.commodityHints[0] ?? DEFAULT_COMMODITY_ID;
          const id = `evt-${profile.id}-${hash(item.link ?? item.title)}`;
          events.push({
            id,
            commodityId,
            timestamp: item.date ?? new Date().toISOString().slice(0, 10),
            country: draft.country,
            countryZh: draft.countryZh,
            region: null,
            category: draft.eventType,
            title: draft.title,
            titleZh: draft.titleZh,
            summary: draft.summary,
            summaryZh: draft.summaryZh,
            sourceUrl: draft.sourceUrl,
            impactDirection: draft.direction,
            impactScore:
              draft.direction === "BULLISH"
                ? Math.round(draft.confidence / 15)
                : draft.direction === "BEARISH"
                  ? -Math.round(draft.confidence / 15)
                  : 0,
            confidence: draft.confidence,
            severity: draft.severity,
            status: "REVIEW",
            classifiedBy: "KEYWORD",
          });
        }
      }
      return events;
    },
  };
}

function extractRssItems(xml: string): {
  title: string;
  summary: string;
  link: string | null;
  date: string | null;
}[] {
  const items: {
    title: string;
    summary: string;
    link: string | null;
    date: string | null;
  }[] = [];
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  const atomBlocks =
    blocks.length > 0 ? blocks : xml.split(/<entry[\s>]/i).slice(1);

  for (const block of atomBlocks) {
    const title = matchTag(block, "title") ?? "Untitled";
    const summary =
      matchTag(block, "description") ??
      matchTag(block, "summary") ??
      matchTag(block, "content") ??
      "";
    const link =
      matchTag(block, "link") ??
      block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ??
      null;
    const dateRaw =
      matchTag(block, "pubDate") ??
      matchTag(block, "updated") ??
      matchTag(block, "published");
    const date = dateRaw
      ? new Date(dateRaw).toISOString().slice(0, 10)
      : null;
    items.push({ title: strip(title), summary: strip(summary), link, date });
  }
  return items;
}

function matchTag(xml: string, tag: string): string | null {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${tag}>`,
    "i",
  );
  const m = xml.match(re);
  return m?.[1] ?? m?.[2] ?? null;
}

function strip(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function hash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

export const russiaPolicyAdapter = makePolicyAdapter({
  id: "russia-policy",
  name: "Russia Policy RSS",
  country: "Russia",
  countryZh: "俄罗斯",
  defaultFeeds: [],
});

export const saudiPolicyAdapter = makePolicyAdapter({
  id: "saudi-policy",
  name: "Saudi Arabia Policy RSS",
  country: "Saudi Arabia",
  countryZh: "沙特阿拉伯",
  defaultFeeds: [],
});

export const qatarPolicyAdapter = makePolicyAdapter({
  id: "qatar-policy",
  name: "Qatar Policy RSS",
  country: "Qatar",
  countryZh: "卡塔尔",
  defaultFeeds: [],
});

export const uaePolicyAdapter = makePolicyAdapter({
  id: "uae-policy",
  name: "UAE Policy RSS",
  country: "UAE",
  countryZh: "阿联酋",
  defaultFeeds: [],
});

export const canadaPolicyAdapter = makePolicyAdapter({
  id: "canada-policy",
  name: "Canada Policy RSS",
  country: "Canada",
  countryZh: "加拿大",
  defaultFeeds: [],
});

export const indiaPolicyAdapter = makePolicyAdapter({
  id: "india-policy",
  name: "India Policy RSS",
  country: "India",
  countryZh: "印度",
  defaultFeeds: [],
});

export const iranPolicyAdapter = makePolicyAdapter({
  id: "iran-policy",
  name: "Iran Policy RSS",
  country: "Iran",
  countryZh: "伊朗",
  defaultFeeds: [],
});

export const chinaPolicyAdapter = makePolicyAdapter({
  id: "china-policy",
  name: "China Policy RSS",
  country: "China",
  countryZh: "中国",
  defaultFeeds: [],
});

export const genericRssAdapter = makePolicyAdapter({
  id: "rss",
  name: "Generic Policy/Market RSS",
  country: "",
  countryZh: "",
  defaultFeeds: [],
});
