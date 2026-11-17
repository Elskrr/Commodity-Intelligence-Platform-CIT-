import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { formatDateTime, formatNumber } from "@/lib/format";

type Row = {
  id: number;
  indicatorName: string;
  indicatorNameZh: string;
  unit: string;
  value: number;
  timestamp: string;
  createdAt: string;
  sourceId: string | null;
  note: string | null;
};

export function RecentManualEntries({ rows }: { rows: Row[] }) {
  return (
    <Panel>
      <PanelHeader
        title="Recent Manual Entries"
        titleZh="最近手工记录"
        actions={<span className="num text-3xs text-ink-dim">{rows.length}</span>}
      />
      <PanelBody className="p-0">
        {rows.length === 0 ? (
          <p className="px-2 py-6 text-center text-2xs text-ink-dim">
            No manual entries yet. 暂无手工录入记录。
          </p>
        ) : (
          <div className="flex flex-col">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-0.5 border-b border-hairline/60 px-2 py-1.5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="num text-3xs text-ink-dim">
                    {row.timestamp.slice(0, 10)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-2xs text-ink-muted">
                    {row.indicatorName}
                    <span className="ml-1 text-3xs text-ink-dim">
                      {row.indicatorNameZh}
                    </span>
                  </span>
                  <span className="num text-2xs text-ink">
                    {formatNumber(row.value, 2)}
                    <span className="ml-1 text-3xs text-ink-dim">
                      {row.unit}
                    </span>
                  </span>
                  <Badge variant="warn">MANUAL</Badge>
                </div>
                <div className="flex items-center gap-2 text-3xs text-ink-dim">
                  <span>Entered {formatDateTime(row.createdAt)}</span>
                  <span>·</span>
                  <span>{row.sourceId ?? "—"}</span>
                  {row.note ? (
                    <>
                      <span>·</span>
                      <span className="truncate">{row.note}</span>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
