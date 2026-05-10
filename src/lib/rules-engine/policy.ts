import { z } from "zod";
import type { Policy } from "./types";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const RuleIdSchema = z.enum([
  "MIN_RUNWAY_DAYS",
  "MAX_CONCENTRATION_PCT",
  "MIN_LIQUID_PCT",
  "BUCKET_TARGET",
  "ALLOCATION_WHITELIST",
  "YIELD_ONLY_EXCESS",
  "REBALANCE_TRIGGER",
]);

const PolicyRuleSchema = z.object({
  id: RuleIdSchema,
  enabled: z.boolean(),
  params: z.record(z.string(), z.unknown()),
});

export const PolicySchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().positive(),
  orgId: z.string().uuid(),
  status: z.enum(["draft", "active", "archived"]),
  preset: z.enum(["conservative", "balanced", "aggressive", "custom"]),
  rules: z.array(PolicyRuleSchema).min(1),
  activatedAt: z.string().datetime().nullable(),
});

export type PolicyInput = z.infer<typeof PolicySchema>;

// ── Presets ───────────────────────────────────────────────────────────────────

export const POLICY_PRESETS: Record<
  "conservative" | "balanced" | "aggressive",
  Omit<Policy, "id" | "version" | "orgId" | "activatedAt">
> = {
  conservative: {
    status: "draft",
    preset: "conservative",
    rules: [
      { id: "MIN_RUNWAY_DAYS",       enabled: true,  params: { days: 120 } },
      { id: "MAX_CONCENTRATION_PCT", enabled: true,  params: { pct: 30 } },
      { id: "MIN_LIQUID_PCT",        enabled: true,  params: { pct: 70 } },
      { id: "ALLOCATION_WHITELIST",  enabled: true,  params: { adapters: ["kamino-usdc-devnet"] } },
      { id: "YIELD_ONLY_EXCESS",     enabled: true,  params: {} },
      { id: "REBALANCE_TRIGGER",     enabled: false, params: { deviationPct: 15 } },
      { id: "BUCKET_TARGET",         enabled: true,  params: {} },
    ],
  },
  balanced: {
    status: "draft",
    preset: "balanced",
    rules: [
      { id: "MIN_RUNWAY_DAYS",       enabled: true,  params: { days: 90 } },
      { id: "MAX_CONCENTRATION_PCT", enabled: true,  params: { pct: 45 } },
      { id: "MIN_LIQUID_PCT",        enabled: true,  params: { pct: 50 } },
      { id: "ALLOCATION_WHITELIST",  enabled: true,  params: { adapters: ["kamino-usdc-devnet", "mock-rwa-usdy"] } },
      { id: "YIELD_ONLY_EXCESS",     enabled: true,  params: {} },
      { id: "REBALANCE_TRIGGER",     enabled: true,  params: { deviationPct: 10 } },
      { id: "BUCKET_TARGET",         enabled: true,  params: {} },
    ],
  },
  aggressive: {
    status: "draft",
    preset: "aggressive",
    rules: [
      { id: "MIN_RUNWAY_DAYS",       enabled: true,  params: { days: 60 } },
      { id: "MAX_CONCENTRATION_PCT", enabled: true,  params: { pct: 60 } },
      { id: "MIN_LIQUID_PCT",        enabled: true,  params: { pct: 35 } },
      { id: "ALLOCATION_WHITELIST",  enabled: false, params: { adapters: [] } },
      { id: "YIELD_ONLY_EXCESS",     enabled: false, params: {} },
      { id: "REBALANCE_TRIGGER",     enabled: true,  params: { deviationPct: 5 } },
      { id: "BUCKET_TARGET",         enabled: true,  params: {} },
    ],
  },
};

// ── Validation ────────────────────────────────────────────────────────────────

export function parsePolicy(raw: unknown): Policy {
  return PolicySchema.parse(raw) as Policy;
}

export function safeParsePolicyUpdate(raw: unknown) {
  return PolicySchema.partial({ id: true, version: true, activatedAt: true }).safeParse(raw);
}
