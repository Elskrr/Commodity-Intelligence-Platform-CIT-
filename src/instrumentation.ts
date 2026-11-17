/**
 * Next.js instrumentation hook.
 *
 * Runs once per server process: initialises SQLite, seeds reference data and
 * starts the local refresh scheduler. Guarded to the Node.js runtime so the
 * edge runtime never tries to open a database file.
 *
 * Public demo deployments skip the scheduler — there is no durable SQLite and
 * anonymous traffic must not trigger ingestion or AI jobs.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (
    process.env.CIT_PUBLIC_DEMO === "1" ||
    process.env.CIT_PUBLIC_DEMO === "true"
  ) {
    console.log("[instrumentation] CIT_PUBLIC_DEMO — scheduler not started");
    return;
  }

  const { startScheduler } = await import("@/lib/scheduler");
  startScheduler();
}
