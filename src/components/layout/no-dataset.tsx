import Link from "next/link";

import { EmptyState } from "@/components/market/primitives";
import { Button } from "@/components/ui/button";
import { DEFAULT_COMMODITY_ID } from "@/config/commodities";

/**
 * Rendered for commodities that are in the watchlist but have no configuration
 * module yet. Adding one means creating `config/commodities/<id>.ts` — no
 * schema or engine changes are required.
 */
export function NoDataset({
  section = "workspace",
  sectionZh = "工作区",
}: {
  section?: string;
  sectionZh?: string;
} = {}) {
  return (
    <EmptyState
      title={`This ${section} has no commodity configuration yet`}
      titleZh={`该${sectionZh}尚未配置商品数据`}
      description="Create a config module under src/config/commodities and register it in the commodity registry to activate this workspace."
      descriptionZh="在 src/config/commodities 下创建配置模块并在商品注册表中登记后，此工作区将自动启用。"
      action={
        <Button asChild variant="outline" size="sm">
          <Link href={`/${DEFAULT_COMMODITY_ID}/overview`}>
            Open Sulphur 打开硫磺
          </Link>
        </Button>
      }
      className="mt-6"
    />
  );
}
