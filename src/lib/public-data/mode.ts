/**
 * Public demo mode flag.
 *
 * When enabled, the app serves a sanitized read-only snapshot and refuses every
 * write path (Server Actions, scheduler, SQLite bootstrap). Local development
 * leaves this unset so the full SQLite + scheduler terminal keeps working.
 */
export function isPublicDemo(): boolean {
  return process.env.CIT_PUBLIC_DEMO === "1" || process.env.CIT_PUBLIC_DEMO === "true";
}

export const PUBLIC_DEMO_DENIED: {
  ok: false;
  message: string;
  messageZh: string;
} = {
  ok: false,
  message: "This action is disabled on the public read-only demo.",
  messageZh: "公共只读演示环境已禁用此操作。",
};
