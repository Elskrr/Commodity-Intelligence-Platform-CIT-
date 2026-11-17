import { createHash } from "node:crypto";

import { fetchCache } from "@/lib/db/fetch-ops";
import { politeFetch } from "@/lib/data-sources/base-source";

const memoryCache = new Map<
  string,
  { etag?: string; lastModified?: string; bodyHash?: string; at: number }
>();

export type CachedFetchResult = {
  status: number;
  notModified: boolean;
  text: string;
  etag: string | null;
  lastModified: string | null;
  bodyHash: string;
};

function hashBody(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

/**
 * Conditional GET with ETag / Last-Modified + SQLite/memory cache.
 * When upstream returns 304 or the body hash matches, callers should skip
 * writing duplicate observations.
 */
export async function cachedFetch(
  sourceId: string,
  url: string,
): Promise<CachedFetchResult> {
  const cached = fetchCache.get(sourceId) ?? null;
  const mem = memoryCache.get(sourceId);
  const headers: Record<string, string> = {};
  const etag = cached?.etag ?? mem?.etag;
  const lastModified = cached?.lastModified ?? mem?.lastModified;
  if (etag) headers["if-none-match"] = etag;
  if (lastModified) headers["if-modified-since"] = lastModified;

  // politeFetch doesn't accept custom headers — use internal variant.
  const response = await politeFetchWithHeaders(url, headers);

  if (response.status === 304) {
    return {
      status: 304,
      notModified: true,
      text: "",
      etag: etag ?? null,
      lastModified: lastModified ?? null,
      bodyHash: cached?.bodyHash ?? mem?.bodyHash ?? "",
    };
  }

  const text = await response.text();
  const bodyHash = hashBody(text);
  const nextEtag = response.headers.get("etag");
  const nextLastModified = response.headers.get("last-modified");

  if (cached?.bodyHash && cached.bodyHash === bodyHash) {
    fetchCache.upsert({
      sourceId,
      etag: nextEtag,
      lastModified: nextLastModified,
      bodyHash,
      status: "UNCHANGED",
    });
    memoryCache.set(sourceId, {
      etag: nextEtag ?? undefined,
      lastModified: nextLastModified ?? undefined,
      bodyHash,
      at: Date.now(),
    });
    return {
      status: response.status,
      notModified: true,
      text,
      etag: nextEtag,
      lastModified: nextLastModified,
      bodyHash,
    };
  }

  fetchCache.upsert({
    sourceId,
    etag: nextEtag,
    lastModified: nextLastModified,
    bodyHash,
    status: "OK",
  });
  memoryCache.set(sourceId, {
    etag: nextEtag ?? undefined,
    lastModified: nextLastModified ?? undefined,
    bodyHash,
    at: Date.now(),
  });

  return {
    status: response.status,
    notModified: false,
    text,
    etag: nextEtag,
    lastModified: nextLastModified,
    bodyHash,
  };
}

async function politeFetchWithHeaders(
  url: string,
  extraHeaders: Record<string, string>,
): Promise<Response> {
  // Reuse robots + rate-limit from politeFetch by calling it when no conditionals.
  if (Object.keys(extraHeaders).length === 0) {
    return politeFetch(url);
  }

  // Conditional requests: duplicate the polite path with extra headers.
  const { isAllowedByRobots } = await import("@/lib/data-sources/base-source");
  if (!(await isAllowedByRobots(url))) {
    throw new Error(
      "Blocked by robots.txt — mark this source as MANUAL_REQUIRED",
    );
  }

  const USER_AGENT =
    process.env.CIT_USER_AGENT ??
    "CommodityIntelligenceTerminal/1.0 (local-first personal research tool)";

  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "*/*",
      ...extraHeaders,
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });

  if (response.status === 304) return response;
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `Source requires authorisation (HTTP ${response.status}) — mark as MANUAL_REQUIRED`,
    );
  }
  if (response.status === 429) {
    throw new Error("Rate limited by source (HTTP 429) — backing off");
  }
  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status}`);
  }
  return response;
}
