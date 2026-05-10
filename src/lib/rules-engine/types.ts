// Core domain types for the rules engine

export type RuleId =
  | "MIN_RUNWAY_DAYS"
  | "MAX_CONCENTRATION_PCT"
  | "MIN_LIQUID_PCT"
  | "BUCKET_TARGET"
  | "ALLOCATION_WHITELIST"
  | "YIELD_ONLY_EXCESS"
  | "REBALANCE_TRIGGER";

export type RiskTier = 1 | 2 | 3;

export interface PolicyRule {
  id: RuleId;
  enabled: boolean;
  params: Record<string, unknown>;
}

export interface Policy {
  id: string;
  version: number;
  orgId: string;
  status: "draft" | "active" | "archived";
  preset: "conservative" | "balanced" | "aggressive" | "custom";
  rules: PolicyRule[];
  activatedAt: string | null;
}

export interface BucketKind {
  kind: "operating" | "payroll" | "tax" | "emergency" | "yield" | "custom";
  targetAmountCents: number;
  targetPct: number | null;
  currency: string;
}

export interface Position {
  adapterId: string;
  protocol: string;
  asset: string;
  amountUsd: number;
  aprPct: number;
  accruedYieldUsd: number;
  riskTier: RiskTier;
  unlockDays: number;
}

export interface Obligation {
  id: string;
  label: string;
  amountUsd: number;
  dueDateIso: string;
  bucketKind: BucketKind["kind"];
  recurrence: "once" | "monthly" | "quarterly" | "annual";
}

export interface TreasurySnapshot {
  id: string;
  orgId: string;
  takenAt: string;
  totalUsd: number;
  liquidUsd: number;        // USDC in wallet + positions with unlockDays <= 1
  positions: Position[];
  buckets: { kind: BucketKind["kind"]; balanceUsd: number; targetUsd: number }[];
  obligations: Obligation[];
}

export interface ProjectionResult {
  liquidRunwayMonths: number;
  protectedRunwayMonths: number;
  deployedCapitalUsd: number;
  deployedPct: number;
  blendedAprPct: number;
  estimatedYieldYearUsd: number;
  topConcentrationPct: number;
  topConcentrationProtocol: string;
  complianceScore: number;        // 0–100
  upcomingObligations30dUsd: number;
  violations: PolicyViolation[];
}

export interface PolicyViolation {
  ruleId: RuleId;
  severity: "warn" | "block";
  message: string;
  actual: number;
  limit: number;
}

export interface ScenarioAction {
  kind: "deposit" | "withdraw" | "rebalance";
  adapterId: string;
  amountUsd: number;
}
