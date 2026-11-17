import { redirect } from "next/navigation";

import { DEFAULT_COMMODITY_ID } from "@/data/commodities";

export default function RootPage() {
  redirect(`/${DEFAULT_COMMODITY_ID}/overview`);
}
