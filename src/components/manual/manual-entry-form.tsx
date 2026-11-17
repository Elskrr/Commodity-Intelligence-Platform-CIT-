"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect, Textarea } from "@/components/ui/field";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { submitManualObservation } from "@/server/actions";

type IndicatorOption = {
  id: string;
  code: string;
  name: string;
  nameZh: string;
  unit: string;
  isDerived: boolean;
};

/**
 * Manual observation entry. Values are written straight to SQLite and marked
 * MANUAL; existing automatic history is never overwritten.
 */
export function ManualEntryForm({
  commodityId,
  commodities,
  indicators,
  sources,
}: {
  commodityId: string;
  commodities: { id: string; name: string; nameZh: string }[];
  indicators: IndicatorOption[];
  sources: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    submitManualObservation,
    null,
  );

  const entryable = indicators.filter((indicator) => !indicator.isDerived);
  const [selected, setSelected] = useState(entryable[0]?.id ?? "");
  const unit = entryable.find((item) => item.id === selected)?.unit ?? "";

  return (
    <Panel className="panel-primary">
      <PanelHeader title="Manual Observation" titleZh="手工观测录入" />
      <PanelBody className="p-2.5">
        <form action={formAction} className="grid gap-2 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="commodityId" zh="品种">
              Commodity
            </Label>
            <NativeSelect
              id="commodityId"
              name="commodityId"
              defaultValue={commodityId}
              onChange={(event) =>
                router.push(`/${event.target.value}/manual-input`)
              }
            >
              {commodities.map((commodity) => (
                <option key={commodity.id} value={commodity.id}>
                  {commodity.name} {commodity.nameZh}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="indicatorId" zh="指标">
              Indicator
            </Label>
            <NativeSelect
              id="indicatorId"
              name="indicatorId"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {entryable.map((indicator) => (
                <option key={indicator.id} value={indicator.id}>
                  {indicator.name} · {indicator.code}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="timestamp" zh="观测日期">
              Observation date
            </Label>
            <Input
              id="timestamp"
              name="timestamp"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="value" zh="数值">
              Value {unit ? `(${unit})` : ""}
            </Label>
            <Input
              id="value"
              name="value"
              inputMode="decimal"
              required
              placeholder="1025"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="sourceId" zh="来源">
              Source
            </Label>
            <NativeSelect
              id="sourceId"
              name="sourceId"
              defaultValue="src-manual"
            >
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="sourceUrl" zh="来源链接">
              Source URL
            </Label>
            <Input
              id="sourceUrl"
              name="sourceUrl"
              placeholder="https://"
              className="font-sans"
            />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="notes" zh="备注">
              Notes
            </Label>
            <Textarea
              id="notes"
              name="notes"
              className="font-sans"
              placeholder="Weekly market assessment"
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save observation 保存"}
            </Button>
            {state ? (
              <span
                className={
                  state.ok ? "text-2xs text-bull" : "text-2xs text-bear"
                }
              >
                {state.message}
              </span>
            ) : null}
          </div>

          {state?.warning ? (
            <p className="sm:col-span-2 rounded-[3px] border border-warn/40 bg-warn-soft px-2 py-1 text-2xs text-warn">
              {state.warning}
            </p>
          ) : null}
        </form>
      </PanelBody>
    </Panel>
  );
}
