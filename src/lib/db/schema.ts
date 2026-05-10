import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const orgProfileEnum = pgEnum("org_profile", ["startup", "dao", "fund"]);
export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "viewer"]);
export const policyStatusEnum = pgEnum("policy_status", ["draft", "active", "archived"]);
export const policyPresetEnum = pgEnum("policy_preset", ["conservative", "balanced", "aggressive", "custom"]);
export const bucketKindEnum = pgEnum("bucket_kind", ["operating", "payroll", "tax", "emergency", "yield", "custom"]);
export const recurrenceEnum = pgEnum("recurrence", ["once", "monthly", "quarterly", "annual"]);
export const intentKindEnum = pgEnum("intent_kind", ["deposit", "withdraw", "rebalance"]);
export const intentStatusEnum = pgEnum("intent_status", [
  "draft", "proposed", "approved", "queued", "signing", "broadcast", "confirmed", "rejected", "failed", "expired",
]);
export const executionStatusEnum = pgEnum("execution_status", [
  "pending", "confirmed", "failed",
]);

// ── Tables ────────────────────────────────────────────────────────────────────

export const organizations = pgTable("organizations", {
  id:             uuid("id").primaryKey().defaultRandom(),
  name:           text("name").notNull(),
  profile:        orgProfileEnum("profile").notNull().default("startup"),
  baseCurrency:   text("base_currency").notNull().default("USDC"),
  simulatedMode:  boolean("simulated_mode").notNull().default(true),
  monthlyBurnUsd: integer("monthly_burn_usd").notNull().default(0),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id:        uuid("id").primaryKey(),   // mirrors Supabase auth.users.id
  email:     text("email").notNull(),
  fullName:  text("full_name"),
  phone:     text("phone"),
  country:   text("country"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable("memberships", {
  id:     uuid("id").primaryKey().defaultRandom(),
  orgId:  uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role:   memberRoleEnum("role").notNull().default("owner"),
}, (t) => [unique().on(t.orgId, t.userId)]);

export const wallets = pgTable("wallets", {
  id:        uuid("id").primaryKey().defaultRandom(),
  orgId:     uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  address:   text("address").notNull(),
  label:     text("label"),
  isPrimary: boolean("is_primary").notNull().default(false),
}, (t) => [
  index("wallets_org_idx").on(t.orgId),
  unique().on(t.orgId, t.address),
]);

export const policies = pgTable("policies", {
  id:          uuid("id").primaryKey().defaultRandom(),
  orgId:       uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  version:     integer("version").notNull().default(1),
  status:      policyStatusEnum("status").notNull().default("draft"),
  preset:      policyPresetEnum("preset").notNull().default("balanced"),
  jsonSpec:    jsonb("json_spec").notNull(),   // full PolicyRule[] stored as JSONB
  createdBy:   uuid("created_by").references(() => users.id),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("policies_org_idx").on(t.orgId)]);

export const buckets = pgTable("buckets", {
  id:                uuid("id").primaryKey().defaultRandom(),
  orgId:             uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  kind:              bucketKindEnum("kind").notNull(),
  label:             text("label"),
  targetAmountCents: bigint("target_amount_cents", { mode: "number" }).notNull().default(0),
  targetPct:         integer("target_pct"),   // mutually exclusive with targetAmountCents
  currency:          text("currency").notNull().default("USDC"),
}, (t) => [index("buckets_org_idx").on(t.orgId)]);

export const obligations = pgTable("obligations", {
  id:         uuid("id").primaryKey().defaultRandom(),
  orgId:      uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  bucketId:   uuid("bucket_id").references(() => buckets.id, { onDelete: "set null" }),
  label:      text("label").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  dueDate:    timestamp("due_date", { withTimezone: true }).notNull(),
  recurrence: recurrenceEnum("recurrence").notNull().default("once"),
}, (t) => [index("obligations_org_idx").on(t.orgId)]);

export const snapshots = pgTable("snapshots", {
  id:           uuid("id").primaryKey().defaultRandom(),
  orgId:        uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  takenAt:      timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
  totalsJson:   jsonb("totals_json").notNull(),    // { totalUsd, liquidUsd }
  positionsJson: jsonb("positions_json").notNull(), // Position[]
  bucketsJson:  jsonb("buckets_json").notNull(),    // bucket balances
}, (t) => [index("snapshots_org_taken_idx").on(t.orgId, t.takenAt)]);

export const recommendations = pgTable("recommendations", {
  id:             uuid("id").primaryKey().defaultRandom(),
  orgId:          uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  policyVersion:  integer("policy_version").notNull(),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  rationale:      text("rationale"),
  actionsJson:    jsonb("actions_json").notNull(),  // ScenarioAction[]
  status:         text("status").notNull().default("pending"),  // pending | approved | dismissed
}, (t) => [index("reco_org_idx").on(t.orgId)]);

export const intents = pgTable("intents", {
  id:               uuid("id").primaryKey().defaultRandom(),
  orgId:            uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  recommendationId: uuid("recommendation_id").references(() => recommendations.id, { onDelete: "set null" }),
  kind:             intentKindEnum("kind").notNull(),
  paramsJson:       jsonb("params_json").notNull(),  // { adapterId, amountUsd, ... }
  status:           intentStatusEnum("status").notNull().default("draft"),
  idempotencyKey:   text("idempotency_key").notNull(),
  createdAt:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("intents_org_idx").on(t.orgId),
  unique().on(t.idempotencyKey),
]);

export const executions = pgTable("executions", {
  id:          uuid("id").primaryKey().defaultRandom(),
  intentId:    uuid("intent_id").notNull().references(() => intents.id, { onDelete: "cascade" }),
  txSignature: text("tx_signature"),
  status:      executionStatusEnum("status").notNull().default("pending"),
  onchainAt:   timestamp("onchain_at", { withTimezone: true }),
  error:       text("error"),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("executions_intent_idx").on(t.intentId),
  unique().on(t.txSignature),
]);

export const events = pgTable("events", {
  id:          uuid("id").primaryKey().defaultRandom(),
  orgId:       uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type:        text("type").notNull(),
  payloadJson: jsonb("payload_json").notNull(),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("events_org_type_idx").on(t.orgId, t.type)]);

export const auditLog = pgTable("audit_log", {
  id:       uuid("id").primaryKey().defaultRandom(),
  orgId:    uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  actor:    uuid("actor").references(() => users.id),
  action:   text("action").notNull(),
  target:   text("target").notNull(),
  diffJson: jsonb("diff_json"),
  at:       timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_org_idx").on(t.orgId)]);

export const equityTokens = pgTable("equity_tokens", {
  id:                  uuid("id").primaryKey().defaultRandom(),
  orgId:               uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  mint:                text("mint").notNull(),
  symbol:              text("symbol").notNull(),
  name:                text("name").notNull(),
  decimals:            integer("decimals").notNull().default(6),
  totalSupply:         bigint("total_supply", { mode: "number" }),
  priceUsdcE6:         bigint("price_usdc_e6", { mode: "number" }),   // price × 1_000_000
  poolAddress:         text("pool_address"),
  poolAprBps:          integer("pool_apr_bps"),                        // APR in basis points
  totalDividendsCents: bigint("total_dividends_cents", { mode: "number" }).notNull().default(0),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("equity_tokens_org_idx").on(t.orgId),
  unique().on(t.orgId),
]);

export const equityDividends = pgTable("equity_dividends", {
  id:              uuid("id").primaryKey().defaultRandom(),
  orgId:           uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  tokenMint:       text("token_mint").notNull(),
  amountCents:     bigint("amount_cents", { mode: "number" }).notNull(),
  perTokenUsdc:    text("per_token_usdc"),
  recipientsCount: integer("recipients_count"),
  txSignature:     text("tx_signature"),
  status:          text("status").notNull().default("pending"),
  distributedAt:   timestamp("distributed_at", { withTimezone: true }),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("equity_dividends_org_idx").on(t.orgId)]);

export const mockPositions = pgTable("mock_positions", {
  id:             uuid("id").primaryKey().defaultRandom(),
  orgId:          uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  adapterId:      text("adapter_id").notNull().default("mock-rwa-usdy"),
  amountUsd:      integer("amount_usd").notNull().default(0),
  accruedYieldUsd: integer("accrued_yield_usd").notNull().default(0),
  depositedAt:    timestamp("deposited_at", { withTimezone: true }).notNull().defaultNow(),
  redeemableAt:   timestamp("redeemable_at", { withTimezone: true }).notNull(),
}, (t) => [index("mock_positions_org_idx").on(t.orgId)]);

// ── Relations ─────────────────────────────────────────────────────────────────

export const membershipsRelations = relations(memberships, ({ one }) => ({
  org: one(organizations, { fields: [memberships.orgId], references: [organizations.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  memberships: many(memberships),
  wallets: many(wallets),
  policies: many(policies),
  buckets: many(buckets),
  obligations: many(obligations),
  snapshots: many(snapshots),
  recommendations: many(recommendations),
  intents: many(intents),
  events: many(events),
  auditLog: many(auditLog),
  equityToken: one(equityTokens, { fields: [organizations.id], references: [equityTokens.orgId] }),
  equityDividends: many(equityDividends),
}));

export const equityTokensRelations = relations(equityTokens, ({ one, many }) => ({
  org: one(organizations, { fields: [equityTokens.orgId], references: [organizations.id] }),
  dividends: many(equityDividends),
}));

export const equityDividendsRelations = relations(equityDividends, ({ one }) => ({
  org: one(organizations, { fields: [equityDividends.orgId], references: [organizations.id] }),
}));

export const intentsRelations = relations(intents, ({ one, many }) => ({
  org: one(organizations, { fields: [intents.orgId], references: [organizations.id] }),
  recommendation: one(recommendations, { fields: [intents.recommendationId], references: [recommendations.id] }),
  executions: many(executions),
}));

export const executionsRelations = relations(executions, ({ one }) => ({
  intent: one(intents, { fields: [executions.intentId], references: [intents.id] }),
}));
