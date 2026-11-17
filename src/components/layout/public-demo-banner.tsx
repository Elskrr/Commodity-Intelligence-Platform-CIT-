import { getPublicMeta } from "@/lib/public-data/provider";
import { formatDateTime } from "@/lib/format";

/** Compact honesty banner for public read-only deployments. */
export function PublicDemoBanner() {
  const meta = getPublicMeta();
  return (
    <div className="border-b border-warn/25 bg-warn/[0.07] px-3 py-1 text-3xs text-ink-muted">
      <span className="font-medium tracking-wide text-warn uppercase">
        Public read-only demo
      </span>
      <span className="mx-2 text-ink-dim">·</span>
      <span>
        Snapshot {formatDateTime(meta.generatedAt)} · {meta.observationCount}{" "}
        observations · live ingestion &amp; admin writes disabled
      </span>
      <span className="mx-2 hidden text-ink-dim sm:inline">·</span>
      <span className="hidden sm:inline">{meta.dataDisclaimer}</span>
    </div>
  );
}
