/**
 * BaseAdapter — shared validation / schedule / provenance defaults.
 *
 * Concrete adapters remain plain objects registered in `src/adapters/index.ts`
 * for compatibility, but new adapters should extend this class.
 */

import type {
  AdapterPriority,
  AdapterSchedule,
  RegisteredAdapter,
} from "@/adapters/types";
import {
  defaultPersist,
  defaultValidate,
  type DataSourceAdapter,
  type NormalizedObservation,
  type RawDataRecord,
  type ValidationResult,
} from "@/lib/data-sources/base-source";
import type { SourceRow } from "@/types/db";

export type AdapterRange = { min?: number; max?: number };

export type BaseAdapterOptions = {
  id: string;
  name: string;
  accessLabel: RegisteredAdapter["accessLabel"];
  schedule: AdapterSchedule;
  license?: string;
  defaultConfidence?: number;
  range?: AdapterRange;
};

export abstract class BaseAdapter implements RegisteredAdapter {
  readonly id: string;
  readonly name: string;
  readonly accessLabel: RegisteredAdapter["accessLabel"];
  readonly schedule: AdapterSchedule;
  readonly license: string;
  readonly defaultConfidence: number;
  readonly range?: AdapterRange;

  constructor(opts: BaseAdapterOptions) {
    this.id = opts.id;
    this.name = opts.name;
    this.accessLabel = opts.accessLabel;
    this.schedule = opts.schedule;
    this.license = opts.license ?? "Public data — verify upstream terms";
    this.defaultConfidence = opts.defaultConfidence ?? 85;
    this.range = opts.range;
  }

  abstract fetch(source: SourceRow): Promise<RawDataRecord[]>;
  abstract normalize(
    records: RawDataRecord[],
    source: SourceRow,
  ): Promise<NormalizedObservation[]>;

  validate(records: NormalizedObservation[]): ValidationResult {
    const ranged: NormalizedObservation[] = [];
    const issues: ValidationResult["issues"] = [];

    for (const record of records) {
      if (this.range?.min !== undefined && record.value < this.range.min) {
        issues.push({
          record,
          reason: `Value ${record.value} below minimum ${this.range.min}`,
          reasonZh: `数值低于下限 ${this.range.min}`,
          fatal: true,
        });
        continue;
      }
      if (this.range?.max !== undefined && record.value > this.range.max) {
        issues.push({
          record,
          reason: `Value ${record.value} above maximum ${this.range.max}`,
          reasonZh: `数值高于上限 ${this.range.max}`,
          fatal: true,
        });
        continue;
      }
      ranged.push({
        ...record,
        confidence: record.confidence ?? this.defaultConfidence,
        license: record.license ?? this.license,
        validationResult: record.validationResult ?? "ok",
      });
    }

    const base = defaultValidate(ranged);
    return {
      valid: base.valid,
      issues: [...issues, ...base.issues],
    };
  }

  persist(
    records: NormalizedObservation[],
    source: SourceRow,
  ): Promise<number> {
    return defaultPersist(records, source);
  }
}

export function schedule(
  refreshIntervalMinutes: number,
  opts?: Partial<AdapterSchedule> & { priority?: AdapterPriority },
): AdapterSchedule {
  return {
    refreshIntervalMinutes,
    priority: opts?.priority ?? "normal",
    timeoutMs: opts?.timeoutMs ?? 15_000,
    maxRetries: opts?.maxRetries ?? 3,
    backoffMinutes: opts?.backoffMinutes ?? 30,
  };
}

/** Convert a BaseAdapter instance into the registry object shape. */
export function asRegistered(adapter: BaseAdapter): RegisteredAdapter {
  return adapter;
}

export type { DataSourceAdapter };
