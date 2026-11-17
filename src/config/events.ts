import type { BilingualLabel } from "@/types";
import type { EventCategory } from "@/types/db";

/** Display metadata for event categories, shared by every commodity. */
export const EVENT_CATEGORY_LABELS: Record<EventCategory, BilingualLabel> = {
  EXPORT_BAN: { en: "Export Ban", zh: "出口禁令" },
  EXPORT_RESTRICTION: { en: "Export Restriction", zh: "出口限制" },
  SANCTIONS: { en: "Sanctions", zh: "制裁" },
  PLANT_OUTAGE: { en: "Plant Outage", zh: "装置检修" },
  PRODUCTION_CHANGE: { en: "Production", zh: "生产变动" },
  SHIPPING_DISRUPTION: { en: "Shipping Disruption", zh: "航运中断" },
  SHIPPING_RECOVERY: { en: "Shipping Recovery", zh: "航运恢复" },
  GOVERNMENT_POLICY: { en: "Government Policy", zh: "政府政策" },
  IMPORT_POLICY: { en: "Import Policy", zh: "进口政策" },
  EXPORT_POLICY: { en: "Export Policy", zh: "出口政策" },
  INVENTORY_EVENT: { en: "Inventory", zh: "库存" },
  DEMAND_EVENT: { en: "Demand", zh: "需求" },
};

export const EVENT_CATEGORIES = Object.keys(
  EVENT_CATEGORY_LABELS,
) as EventCategory[];

/** Coarse filter groups used on the Overview and Policy pages. */
export const EVENT_GROUPS: {
  id: string;
  label: BilingualLabel;
  categories: EventCategory[];
}[] = [
  { id: "all", label: { en: "All", zh: "全部" }, categories: [] },
  {
    id: "supply",
    label: { en: "Supply", zh: "供应" },
    categories: ["PRODUCTION_CHANGE", "PLANT_OUTAGE", "EXPORT_BAN"],
  },
  {
    id: "policy",
    label: { en: "Policy", zh: "政策" },
    categories: [
      "GOVERNMENT_POLICY",
      "SANCTIONS",
      "EXPORT_RESTRICTION",
      "IMPORT_POLICY",
      "EXPORT_POLICY",
    ],
  },
  {
    id: "shipping",
    label: { en: "Shipping", zh: "航运" },
    categories: ["SHIPPING_DISRUPTION", "SHIPPING_RECOVERY"],
  },
  {
    id: "demand",
    label: { en: "Demand", zh: "需求" },
    categories: ["DEMAND_EVENT", "INVENTORY_EVENT"],
  },
];
