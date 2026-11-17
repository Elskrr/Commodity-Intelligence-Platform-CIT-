import {
  PUBLIC_DEMO_SNAPSHOT_VERSION,
  type PublicDemoSnapshot,
} from "@/lib/public-data/schema";

const SECRET_HINT =
  /(api[_-]?key|secret|password|token|authorization|bearer|private[_-]?key)/i;

export type ValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

function scanForSecrets(value: unknown, path: string, errors: string[]) {
  if (typeof value === "string") {
    if (SECRET_HINT.test(value) && value.length > 12) {
      errors.push(`Possible secret-like string at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForSecrets(item, `${path}[${index}]`, errors));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_HINT.test(key)) {
        errors.push(`Forbidden key ${path}.${key}`);
        continue;
      }
      scanForSecrets(child, `${path}.${key}`, errors);
    }
  }
}

/** Validates a public demo snapshot before write or load. */
export function validatePublicDemoSnapshot(
  snapshot: unknown,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!snapshot || typeof snapshot !== "object") {
    return { ok: false, errors: ["Snapshot is not an object"], warnings };
  }

  const snap = snapshot as PublicDemoSnapshot;

  if (snap.meta?.version !== PUBLIC_DEMO_SNAPSHOT_VERSION) {
    errors.push(
      `Unsupported snapshot version ${String(snap.meta?.version)} (expected ${PUBLIC_DEMO_SNAPSHOT_VERSION})`,
    );
  }
  if (snap.meta?.mode !== "public-demo") {
    errors.push("meta.mode must be public-demo");
  }
  if (!snap.meta?.generatedAt) {
    errors.push("meta.generatedAt is required");
  }
  if (!Array.isArray(snap.commodities)) {
    errors.push("commodities must be an array");
  }
  if (!snap.datasets || typeof snap.datasets !== "object") {
    errors.push("datasets must be an object");
  } else {
    const ids = Object.keys(snap.datasets);
    if (ids.length === 0) {
      errors.push("datasets is empty");
    }
    if (!snap.datasets.sulphur) {
      warnings.push("No sulphur dataset — primary demo commodity missing");
    }
    for (const [id, dataset] of Object.entries(snap.datasets)) {
      if (!dataset?.commodity?.id) {
        errors.push(`datasets.${id} missing commodity`);
        continue;
      }
      if (!dataset.marketScore) {
        warnings.push(`datasets.${id} has no marketScore (UI may show empty state)`);
      }
      for (const indicator of dataset.indicators ?? []) {
        if (!indicator.observedAt) {
          errors.push(`datasets.${id} indicator ${indicator.code} missing observedAt`);
        }
        if (!indicator.provenance) {
          errors.push(`datasets.${id} indicator ${indicator.code} missing provenance`);
        }
      }
    }
  }

  if (!snap.reports || typeof snap.reports !== "object") {
    errors.push("reports must be an object");
  }

  scanForSecrets(snap, "snapshot", errors);

  return { ok: errors.length === 0, errors, warnings };
}
