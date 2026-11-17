import {
  Activity,
  BarChart3,
  Database,
  FileText,
  Gauge,
  LayoutGrid,
  PenSquare,
  Settings,
  Ship,
  Shield,
  TrendingUp,
} from "lucide-react";

import type { BilingualLabel } from "@/types";

export type NavItem = {
  /** Route segment appended after the commodity id. */
  segment: string;
  label: BilingualLabel;
  icon: typeof LayoutGrid;
  /** Absolute route for system-wide screens that are not commodity-scoped. */
  href?: string;
};

/** Primary workspace tabs rendered in the header. */
export const PRIMARY_TABS: NavItem[] = [
  { segment: "overview", label: { en: "Overview", zh: "市场总览" }, icon: LayoutGrid },
  { segment: "prices", label: { en: "Prices", zh: "价格" }, icon: TrendingUp },
  { segment: "supply", label: { en: "Supply", zh: "供应" }, icon: Gauge },
  { segment: "demand", label: { en: "Demand", zh: "需求" }, icon: BarChart3 },
  { segment: "shipping", label: { en: "Shipping", zh: "航运" }, icon: Ship },
  { segment: "policy", label: { en: "Policy & Events", zh: "政策与事件" }, icon: Shield },
  { segment: "reports", label: { en: "Reports", zh: "研究报告" }, icon: FileText },
];

/** Utility links pinned to the bottom of the sidebar. */
export const UTILITY_NAV: NavItem[] = [
  {
    segment: "manual-input",
    label: { en: "Manual Input", zh: "手工录入" },
    icon: PenSquare,
  },
  {
    segment: "data-sources",
    label: { en: "Data Sources", zh: "数据源" },
    icon: Database,
    href: "/system/data-sources",
  },
  {
    segment: "health",
    label: { en: "System Health", zh: "系统健康" },
    icon: Activity,
    href: "/system/health",
  },
  {
    segment: "settings",
    label: { en: "Settings", zh: "系统设置" },
    icon: Settings,
    href: "/system/settings",
  },
];

export const ALL_SEGMENTS = [...PRIMARY_TABS, ...UTILITY_NAV].map(
  (item) => item.segment,
);

export const APP_NAME = "Commodity Intelligence Terminal";
export const APP_NAME_ZH = "大宗商品情报终端";
export const APP_SHORT_NAME = "CIT";

export { Activity };
