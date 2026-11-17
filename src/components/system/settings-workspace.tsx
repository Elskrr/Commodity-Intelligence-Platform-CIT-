"use client";

import { Download, HardDriveDownload } from "lucide-react";
import { useActionState, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/field";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import {
  backupDatabase,
  exportIndicatorCsv,
  saveAdapterConfig,
  saveAiSettings,
  saveAlertRule,
  saveGeneralSettings,
  saveScoreWeightSettings,
  type ActionResult,
} from "@/server/actions";
import { cn } from "@/lib/utils";
import type { AlertRuleRow } from "@/types/db";

type ScoreFactor = {
  key: string;
  label: string;
  labelZh: string;
  weight: number;
  explanation: string;
};

type IndicatorOption = {
  id: string;
  code: string;
  name: string;
  nameZh: string;
  unit: string;
  isDerived: boolean;
};

/** Settings: general, market score weights, alerts, data and AI provider. */
export function SettingsWorkspace({
  commodityId,
  scoreFactors,
  alertRules,
  indicators,
  general,
  ai,
  dbPath,
}: {
  commodityId: string;
  scoreFactors: ScoreFactor[];
  alertRules: AlertRuleRow[];
  indicators: IndicatorOption[];
  general: {
    reportTime: string;
    notifications: boolean;
    defaultInterval: number;
  };
  ai: {
    provider: string;
    model: string;
    hasApiKey: boolean;
    baseUrl: string;
  };
  dbPath: string;
}) {
  return (
    <div className="grid gap-2 xl:grid-cols-2">
      <GeneralSection general={general} />
      <ScoreSection commodityId={commodityId} factors={scoreFactors} />
      <AlertSection commodityId={commodityId} rules={alertRules} />
      <div className="flex flex-col gap-2">
        <DataSection dbPath={dbPath} indicators={indicators} />
        <AiSection ai={ai} />
        <AdapterSection commodityId={commodityId} />
      </div>
    </div>
  );
}

function useResultAction(
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>,
) {
  return useActionState<ActionResult | null, FormData>(action, null);
}

function Result({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  return (
    <span className={cn("text-2xs", state.ok ? "text-teal" : "text-bear")}>
      {state.message}
    </span>
  );
}

function GeneralSection({
  general,
}: {
  general: { reportTime: string; notifications: boolean; defaultInterval: number };
}) {
  const [state, formAction, pending] = useResultAction(saveGeneralSettings);

  return (
    <Panel>
      <PanelHeader title="General" titleZh="通用设置" />
      <PanelBody className="p-2.5">
        <form action={formAction} className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="reportTime" zh="报告生成时间">
                Daily report time
              </Label>
              <Input
                id="reportTime"
                name="reportTime"
                type="time"
                defaultValue={general.reportTime}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="defaultInterval" zh="默认刷新间隔（分钟）">
                Default refresh interval
              </Label>
              <Input
                id="defaultInterval"
                name="defaultInterval"
                type="number"
                min={5}
                defaultValue={general.defaultInterval}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-2xs text-ink-muted">
            <input
              type="checkbox"
              name="notifications"
              defaultChecked={general.notifications}
              className="accent-accent"
            />
            Browser notifications for high-severity alerts
            <span className="text-3xs text-ink-dim">高优先级提醒的浏览器通知</span>
          </label>

          <p className="text-3xs leading-relaxed text-ink-dim">
            If the app is closed at the scheduled time, the missed report is
            generated the next time the server starts. Per-source intervals set
            in Data Sources override the default above.
          </p>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Save 保存
            </Button>
            <Result state={state} />
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

function ScoreSection({
  commodityId,
  factors,
}: {
  commodityId: string;
  factors: ScoreFactor[];
}) {
  const [state, formAction, pending] = useResultAction(saveScoreWeightSettings);
  const [weights, setWeights] = useState(
    Object.fromEntries(
      factors.map((factor) => [factor.key, Math.round(factor.weight * 100)]),
    ),
  );
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);

  return (
    <Panel>
      <PanelHeader
        title="Market Score Weights"
        titleZh="市场评分权重"
        actions={
          <span
            className={cn(
              "num text-2xs",
              total === 100 ? "text-teal" : "text-warn",
            )}
          >
            {total}%
          </span>
        }
      />
      <PanelBody className="p-2.5">
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="commodityId" value={commodityId} />

          {factors.map((factor) => (
            <div key={factor.key} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`weight.${factor.key}`} zh={factor.labelZh}>
                  {factor.label}
                </Label>
                <span className="num text-2xs text-ink">
                  {weights[factor.key]}%
                </span>
              </div>
              <input
                id={`weight.${factor.key}`}
                name={`weight.${factor.key}`}
                type="range"
                min={0}
                max={50}
                step={1}
                value={weights[factor.key]}
                onChange={(event) =>
                  setWeights((prev) => ({
                    ...prev,
                    [factor.key]: Number(event.target.value),
                  }))
                }
                className="accent-accent"
              />
              <p className="text-3xs leading-snug text-ink-dim">
                {factor.explanation}
              </p>
            </div>
          ))}

          <p className="text-3xs text-ink-dim">
            Weights are normalised before scoring, so they do not have to sum to
            exactly 100. Changing them recomputes the score history immediately.
          </p>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Save weights 保存权重
            </Button>
            <Result state={state} />
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

function AlertSection({
  commodityId,
  rules,
}: {
  commodityId: string;
  rules: AlertRuleRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <Panel>
      <PanelHeader
        title="Alert Rules"
        titleZh="预警规则"
        actions={
          message ? (
            <span className="text-3xs text-ink-muted">{message}</span>
          ) : (
            <span className="num text-3xs text-ink-dim">
              {rules.filter((rule) => rule.enabled === 1).length}/{rules.length}{" "}
              enabled
            </span>
          )
        }
      />
      <PanelBody className="p-0">
        {rules.map((rule) => (
          <form
            key={rule.id}
            action={(formData) =>
              startTransition(async () => {
                const result = await saveAlertRule(null, formData);
                setMessage(result.message);
              })
            }
            className="flex flex-wrap items-center gap-2 border-b border-hairline/60 px-2 py-1.5 last:border-0"
          >
            <input type="hidden" name="ruleId" value={rule.id} />
            <input type="hidden" name="commodityId" value={commodityId} />

            <span className="min-w-0 flex-1">
              <span className="block truncate text-2xs text-ink">
                {rule.name}
              </span>
              <span className="block truncate text-3xs text-ink-dim">
                {rule.nameZh} · {rule.ruleType}
                {rule.comparison ? ` ${rule.comparison}` : ""}
              </span>
            </span>

            <Badge
              variant={
                rule.severity === "CRITICAL" || rule.severity === "HIGH"
                  ? "bear"
                  : "outline"
              }
            >
              {rule.severity}
            </Badge>

            <Input
              name="threshold"
              defaultValue={rule.threshold ?? 0}
              className="h-6 w-20 text-right"
              aria-label={`${rule.name} threshold`}
              disabled={rule.ruleType === "COMPOUND_REVERSAL"}
            />

            <label className="flex items-center gap-1 text-3xs text-ink-dim">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={rule.enabled === 1}
                className="accent-accent"
              />
              on
            </label>

            <Button type="submit" size="xs" variant="outline" disabled={pending}>
              Save
            </Button>
          </form>
        ))}
      </PanelBody>
    </Panel>
  );
}

function DataSection({
  dbPath,
  indicators,
}: {
  dbPath: string;
  indicators: IndicatorOption[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(indicators[0]?.id ?? "");

  const download = () =>
    startTransition(async () => {
      const { filename, csv } = await exportIndicatorCsv(selected);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(`Exported ${filename}`);
    });

  return (
    <Panel>
      <PanelHeader title="Data" titleZh="数据管理" />
      <PanelBody className="flex flex-col gap-2 p-2.5">
        <div className="flex flex-col gap-0.5">
          <span className="label-caps">Database path 数据库路径</span>
          <span className="break-all text-3xs text-ink-muted">{dbPath}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await backupDatabase();
                setMessage(result.message);
              })
            }
          >
            <HardDriveDownload className="size-3" />
            Back up data 备份
          </Button>

          <NativeSelect
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            aria-label="Indicator to export"
            className="h-7 w-56"
          >
            {indicators.map((indicator) => (
              <option key={indicator.id} value={indicator.id}>
                {indicator.name}
              </option>
            ))}
          </NativeSelect>

          <Button size="sm" variant="outline" disabled={pending} onClick={download}>
            <Download className="size-3" />
            Export CSV 导出
          </Button>
        </div>

        {message ? (
          <span className="break-all text-2xs text-ink-muted">{message}</span>
        ) : null}
      </PanelBody>
    </Panel>
  );
}

function AiSection({
  ai,
}: {
  ai: { provider: string; model: string; hasApiKey: boolean; baseUrl: string };
}) {
  const [state, formAction, pending] = useResultAction(saveAiSettings);

  return (
    <Panel>
      <PanelHeader
        title="AI Analysis"
        titleZh="AI 分析"
        actions={
          <Badge variant={ai.hasApiKey ? "teal" : "outline"} size="sm">
            {ai.hasApiKey ? "API KEY SET" : "NO API KEY"}
          </Badge>
        }
      />
      <PanelBody className="p-2.5">
        <form action={formAction} className="flex flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label htmlFor="provider" zh="提供方">
                Provider
              </Label>
              <NativeSelect
                id="provider"
                name="provider"
                defaultValue={ai.provider === "cloud" ? "cloud" : "local"}
              >
                <option value="local">local-template (offline)</option>
                <option value="cloud">cloud-ai (OpenAI-compatible)</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="model" zh="模型">
                Model
              </Label>
              <Input
                id="model"
                name="model"
                defaultValue={ai.model}
                className="font-sans"
                placeholder="gpt-4o-mini"
              />
            </div>
          </div>

          <p className="text-3xs leading-relaxed text-ink-dim">
            Credentials are read from environment variables only —
            AI_API_KEY, AI_MODEL and AI_BASE_URL (currently {ai.baseUrl}). The
            cloud provider receives a bounded JSON context of prices, changes,
            inventory, demand, freight, events, score and alerts; never the
            database. Any failure falls back to the local template.
          </p>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              Save 保存
            </Button>
            <Result state={state} />
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}

function AdapterSection({ commodityId }: { commodityId: string }) {
  const [state, formAction, pending] = useResultAction(saveAdapterConfig);

  return (
    <Panel>
      <PanelHeader title="Public Source Configuration" titleZh="公开数据源配置" />
      <PanelBody className="p-2.5">
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="kind" value="rss" />
          <input type="hidden" name="commodityId" value={commodityId} />

          <div className="flex flex-col gap-1">
            <Label htmlFor="rss-url" zh="RSS 链接">
              News / policy RSS feed
            </Label>
            <Input
              id="rss-url"
              name="url"
              className="font-sans"
              placeholder="https://example.gov/news/rss"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="keywords" zh="关键词（逗号分隔）">
              Keywords
            </Label>
            <Input
              id="keywords"
              name="keywords"
              className="font-sans"
              placeholder="sulphur, sulfur, export, fertilizer"
            />
          </div>

          <p className="text-3xs leading-relaxed text-ink-dim">
            Ingested items become market events with status REVIEW and the
            source URL stored, so machine classifications never become permanent
            without an analyst confirming them. Feeds are fetched politely and
            only when robots.txt allows it.
          </p>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              Save feed 保存
            </Button>
            <Result state={state} />
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}
