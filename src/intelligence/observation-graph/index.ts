import type {
  DriverRanking,
  IntelligenceRisk,
  ObservationGraph,
  ScenarioCase,
} from "@/intelligence/types";

/**
 * Observation Graph — internal lineage for traceability (not a UI surface).
 */

export function buildObservationGraph(input: {
  commodityId: string;
  ranking: DriverRanking;
  risks: IntelligenceRisk[];
  scenarios: ScenarioCase[];
  reportId: string;
}): ObservationGraph {
  const nodes: ObservationGraph["nodes"] = [];
  const edges: ObservationGraph["edges"] = [];
  const seen = new Set<string>();

  const addNode = (
    id: string,
    kind: ObservationGraph["nodes"][0]["kind"],
    label: string,
  ) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, kind, label });
  };

  const addEdge = (from: string, to: string, relation: string) => {
    edges.push({ from, to, relation });
  };

  const reportNode = `report:${input.reportId}`;
  addNode(reportNode, "report", `Report ${input.reportId}`);

  for (const scenario of input.scenarios) {
    const sid = `scenario:${scenario.id}`;
    addNode(sid, "scenario", scenario.label);
    addEdge(sid, reportNode, "feeds");
    for (const driverId of scenario.keyDriverIds) {
      addEdge(driverId, sid, "assumes");
    }
  }

  for (const risk of input.risks.slice(0, 8)) {
    const rid = risk.id;
    addNode(rid, "risk", risk.name);
    addEdge(rid, reportNode, "informs");
    for (const driverId of risk.relatedDriverIds) {
      addEdge(driverId, rid, "elevates");
    }
  }

  for (const driver of input.ranking.all.slice(0, 20)) {
    addNode(driver.id, "driver", driver.label);
    addEdge(driver.id, reportNode, "explains");
    for (const obs of driver.supportingObservations) {
      const indId = `indicator:${obs.indicatorCode}`;
      addNode(indId, "indicator", obs.indicatorName);
      addEdge(indId, driver.id, "supports");
      if (obs.observedAt) {
        const oid = `observation:${obs.indicatorCode}:${obs.observedAt}`;
        addNode(
          oid,
          "observation",
          `${obs.indicatorCode}=${obs.value ?? "n/a"} @ ${obs.observedAt}`,
        );
        addEdge(oid, indId, "measures");
      }
    }
  }

  return { nodes, edges };
}
