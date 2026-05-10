// Deterministic action validation — called before any intent is created.
// AI proposals MUST pass through validateAction before becoming intents.

import { projectScenario } from "./projections";
import type { TreasurySnapshot, Policy, ScenarioAction, PolicyViolation } from "./types";

export interface ValidationResult {
  ok: boolean;
  violations: PolicyViolation[];
  blockers: PolicyViolation[];
}

// Validate a single action against current snapshot + active policy.
// Returns ok:true only when there are no "block" severity violations.
export function validateAction(
  snapshot: TreasurySnapshot,
  policy: Policy,
  action: ScenarioAction
): ValidationResult {
  const projection = projectScenario(snapshot, policy, [action]);
  const blockers = projection.violations.filter((v) => v.severity === "block");
  return {
    ok: blockers.length === 0,
    violations: projection.violations,
    blockers,
  };
}

// Validate a batch of actions atomically.
export function validateActions(
  snapshot: TreasurySnapshot,
  policy: Policy,
  actions: ScenarioAction[]
): ValidationResult {
  const projection = projectScenario(snapshot, policy, actions);
  const blockers = projection.violations.filter((v) => v.severity === "block");
  return {
    ok: blockers.length === 0,
    violations: projection.violations,
    blockers,
  };
}

// Build a human-readable rejection reason for the AI reprompt.
export function formatViolationsForAgent(violations: PolicyViolation[]): string {
  if (violations.length === 0) return "No violations.";
  return violations
    .map((v) => `[${v.severity.toUpperCase()}] ${v.ruleId}: ${v.message}`)
    .join("\n");
}

// Validate a policy JSON spec itself (structural + cross-rule consistency).
export function validatePolicySpec(policy: Policy): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  const ruleIds = policy.rules.map((r) => r.id);
  const dupes = ruleIds.filter((id, i) => ruleIds.indexOf(id) !== i);
  if (dupes.length > 0) errors.push(`Duplicate rule IDs: ${dupes.join(", ")}`);

  const runwayRule = policy.rules.find((r) => r.id === "MIN_RUNWAY_DAYS");
  if (runwayRule?.enabled) {
    const days = runwayRule.params.days as number;
    if (typeof days !== "number" || days < 0 || days > 3650)
      errors.push("MIN_RUNWAY_DAYS.days must be between 0 and 3650");
  }

  const concRule = policy.rules.find((r) => r.id === "MAX_CONCENTRATION_PCT");
  if (concRule?.enabled) {
    const pct = concRule.params.pct as number;
    if (typeof pct !== "number" || pct <= 0 || pct > 100)
      errors.push("MAX_CONCENTRATION_PCT.pct must be between 0 and 100");
  }

  const liquidRule = policy.rules.find((r) => r.id === "MIN_LIQUID_PCT");
  if (liquidRule?.enabled) {
    const pct = liquidRule.params.pct as number;
    if (typeof pct !== "number" || pct < 0 || pct > 100)
      errors.push("MIN_LIQUID_PCT.pct must be between 0 and 100");
  }

  const whitelistRule = policy.rules.find((r) => r.id === "ALLOCATION_WHITELIST");
  if (whitelistRule?.enabled) {
    const adapters = whitelistRule.params.adapters;
    if (!Array.isArray(adapters))
      errors.push("ALLOCATION_WHITELIST.adapters must be an array");
  }

  return { ok: errors.length === 0, errors };
}
