"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/field";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { createIndicator } from "@/server/actions";
import type { Frequency, IndicatorType } from "@/types/db";

const TYPES: IndicatorType[] = [
  "PRICE",
  "INVENTORY",
  "SUPPLY",
  "DEMAND",
  "FREIGHT",
  "PRODUCTION",
  "IMPORT",
  "EXPORT",
  "POLICY",
  "UTILIZATION",
  "FX",
  "MACRO",
  "SPREAD",
];

const FREQUENCIES: Frequency[] = [
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "IRREGULAR",
];

/** Creates a tracked indicator without touching the commodity config file. */
export function NewIndicatorForm({ commodityId }: { commodityId: string }) {
  const [state, formAction, pending] = useActionState(createIndicator, null);

  return (
    <Panel>
      <PanelHeader title="Create Indicator" titleZh="新建指标" />
      <PanelBody className="p-2.5">
        <form action={formAction} className="grid gap-2 sm:grid-cols-3">
          <input type="hidden" name="commodityId" value={commodityId} />

          <div className="flex flex-col gap-1">
            <Label htmlFor="code" zh="代码">
              Code
            </Label>
            <Input id="code" name="code" required placeholder="INDIA_FOB" />
          </div>

          <div className="flex flex-col gap-1 sm:col-span-2">
            <Label htmlFor="name" zh="名称">
              Name
            </Label>
            <Input
              id="name"
              name="name"
              required
              className="font-sans"
              placeholder="India FOB"
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="nameZh" zh="中文名称">
              Chinese name
            </Label>
            <Input id="nameZh" name="nameZh" className="font-sans" />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="unit" zh="单位">
              Unit
            </Label>
            <Input id="unit" name="unit" required placeholder="USD/t" />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="indicatorType" zh="类型">
              Type
            </Label>
            <NativeSelect id="indicatorType" name="indicatorType">
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="frequency" zh="频率">
              Frequency
            </Label>
            <NativeSelect
              id="frequency"
              name="frequency"
              defaultValue="WEEKLY"
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency} value={frequency}>
                  {frequency}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="prefix" zh="前缀">
              Prefix
            </Label>
            <Input id="prefix" name="prefix" placeholder="$" />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="precision" zh="小数位">
              Precision
            </Label>
            <Input
              id="precision"
              name="precision"
              type="number"
              min={0}
              max={4}
              defaultValue={0}
            />
          </div>

          <div className="flex items-center gap-2 sm:col-span-3">
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? "Creating…" : "Create indicator 创建"}
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
        </form>
      </PanelBody>
    </Panel>
  );
}
