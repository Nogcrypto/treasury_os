// Pure alert computation — no I/O
import type { TreasurySnapshot, Policy } from "./types";
import { projectRunway } from "./projections";

export type AlertType = "runway" | "concentration" | "obligation" | "policy";

export interface TreasuryAlert {
  type: AlertType;
  severity: "warn" | "block";
  title: string;
  message: string;
}

export function computeAlerts(
  snapshot: TreasurySnapshot,
  policy: Policy
): TreasuryAlert[] {
  const projection = projectRunway(snapshot, policy);
  const alerts: TreasuryAlert[] = [];

  for (const v of projection.violations) {
    const type: AlertType =
      v.ruleId === "MIN_RUNWAY_DAYS"
        ? "runway"
        : v.ruleId === "MAX_CONCENTRATION_PCT"
        ? "concentration"
        : "policy";
    alerts.push({ type, severity: v.severity, title: alertTitle(type), message: v.message });
  }

  // Upcoming obligations in < 7 days
  const now = Date.now();
  for (const obl of snapshot.obligations) {
    const daysLeft = Math.ceil(
      (new Date(obl.dueDateIso).getTime() - now) / 86_400_000
    );
    if (daysLeft > 0 && daysLeft <= 7) {
      alerts.push({
        type: "obligation",
        severity: daysLeft <= 2 ? "block" : "warn",
        title: "Obrigação próxima",
        message: `"${obl.label}" de $${obl.amountUsd.toLocaleString()} vence em ${daysLeft} dia${daysLeft > 1 ? "s" : ""}`,
      });
    }
  }

  return alerts;
}

function alertTitle(type: AlertType): string {
  switch (type) {
    case "runway":        return "Runway abaixo da meta";
    case "concentration": return "Concentração de risco";
    case "obligation":    return "Obrigação próxima";
    case "policy":        return "Violação de política";
  }
}
