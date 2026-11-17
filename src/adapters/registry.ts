/**
 * Adapters package — data-source-first ingestion.
 *
 * Flow: DataSource → Adapter → Normalize → SQLite → Indicators → Score → …
 */

export {
  ADAPTER_REGISTRY,
  getAdapter,
  getRegisteredAdapter,
  listAdapters,
  listRegisteredAdapters,
} from "@/adapters/index";

export type {
  AdapterPriority,
  AdapterSchedule,
  IndicatorTarget,
  RegisteredAdapter,
} from "@/adapters/types";
