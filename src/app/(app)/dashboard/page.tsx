import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots, policies, buckets, obligations } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { projectRunway } from "@/lib/rules-engine/projections";
import { parsePolicy } from "@/lib/rules-engine/policy";
import type { TreasurySnapshot, Policy } from "@/lib/rules-engine/types";
import Link from "next/link";
import { signOut } from "@/app/(auth)/login/actions";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { BucketCard } from "@/components/dashboard/BucketCard";
import { PositionsTable } from "@/components/dashboard/PositionsTable";
import { SnapshotButton } from "@/components/dashboard/SnapshotButton";
import { AlertsBanner } from "@/components/AlertsBanner";
import { computeAlerts } from "@/lib/rules-engine/alerts";
import { isDemoUser, getDemoDashboardData } from "@/lib/demo";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  if (isDemoUser(user.email)) {
    return <DemoDashboard />;
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { org: true },
  });

  if (!membership) {
    return <OnboardingPrompt />;
  }

  const orgId = membership.orgId;

  const [latestSnapshot, activePolicy, orgBuckets, orgObligations] = await Promise.all([
    db.query.snapshots.findFirst({
      where: eq(snapshots.orgId, orgId),
      orderBy: [desc(snapshots.takenAt)],
    }),
    db.query.policies.findFirst({
      where: and(eq(policies.orgId, orgId), eq(policies.status, "active")),
    }),
    db.query.buckets.findMany({ where: eq(buckets.orgId, orgId) }),
    db.query.obligations.findMany({ where: eq(obligations.orgId, orgId) }),
  ]);

  let projection = null;
  let alerts: import("@/lib/rules-engine/alerts").TreasuryAlert[] = [];
  if (latestSnapshot && activePolicy) {
    const snap = buildSnapshot(orgId, latestSnapshot, orgBuckets, orgObligations);
    const policy = buildPolicy(activePolicy);
    projection = projectRunway(snap, policy);
    alerts = computeAlerts(snap, policy);
  }

  const totals = latestSnapshot
    ? (latestSnapshot.totalsJson as { totalUsd: number; liquidUsd: number })
    : null;

  const positions = latestSnapshot
    ? ((latestSnapshot.positionsJson as unknown[]) as TreasurySnapshot["positions"])
    : [];

  const snapshotAge = latestSnapshot
    ? Math.floor((Date.now() - latestSnapshot.takenAt.getTime()) / 60_000)
    : null;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
        <div>
          <div className="text-xs text-fg-3 font-mono tracking-wider uppercase mb-1">
            {membership.org.name} / Dashboard
          </div>
          <h1 className="text-xl font-semibold text-fg">Tesouraria</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SnapshotButton />
        </div>
      </div>

      {/* Snapshot metadata */}
      {snapshotAge !== null && (
        <div className="text-xs text-fg-3 font-mono mb-4">
          último snapshot há {snapshotAge === 0 ? "menos de 1" : snapshotAge} min
        </div>
      )}

      {/* Alerts */}
      <AlertsBanner alerts={alerts} />

      {/* KPI grid */}
      <div className="mb-6">
        <KpiGrid
          totalUsd={totals?.totalUsd ?? null}
          liquidUsd={totals?.liquidUsd ?? null}
          projection={projection}
          policyVersion={activePolicy?.version ?? null}
        />
      </div>

      {/* No snapshot yet */}
      {!latestSnapshot && (
        <div className="rounded-xl border border-line bg-bg-1 p-8 text-center text-fg-3 text-sm mb-6">
          <p className="font-mono text-xs tracking-wider uppercase mb-2">Aguardando snapshot</p>
          <p className="mb-4">Conecte sua wallet e clique em Snapshot para carregar os dados.</p>
        </div>
      )}


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Buckets */}
        {orgBuckets.length > 0 && (
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
              Buckets
            </div>
            <div className="divide-y divide-line">
              {orgBuckets.map((b) => (
                <BucketCard key={b.id} bucket={b} />
              ))}
            </div>
          </div>
        )}

        {/* Obligations */}
        {orgObligations.length > 0 && (
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
              Obrigações
            </div>
            <div className="divide-y divide-line">
              {orgObligations.map((o) => (
                <ObligationRow key={o.id} obligation={o} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Positions */}
      {positions.length > 0 && (
        <div className="rounded-xl border border-line bg-bg-1 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
            Posições alocadas
          </div>
          <PositionsTable positions={positions} />
        </div>
      )}

      {/* Module navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { href: "/policy",    label: "Policy Engine", desc: "Regras e compliance",      icon: "⚖" },
          { href: "/copilot",   label: "AI Copilot",    desc: "Análise e recomendações",   icon: "✦" },
          { href: "/simulator", label: "Simulador",     desc: "Projeções e cenários",       icon: "◈" },
          { href: "/execution", label: "Execução",      desc: "Intents e transações",       icon: "▶" },
          { href: "/reports",   label: "Relatórios",    desc: "Histórico e exportações",    icon: "↗" },
        ].map(({ href, label, desc, icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-line bg-bg-1 p-4 hover:bg-bg-2 hover:border-accent/30 transition-all group"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="font-mono text-xs text-fg-3">{icon}</span>
              <div className="text-xs font-mono text-fg-2 uppercase tracking-wider truncate">{label}</div>
            </div>
            <div className="text-xs text-fg-3 group-hover:text-fg-2 transition-colors leading-snug">{desc}</div>
            <div className="text-xs text-accent mt-2 opacity-0 group-hover:opacity-100 transition-opacity">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ObligationRow({ obligation }: { obligation: typeof obligations.$inferSelect }) {
  const amountUsd = obligation.amountCents / 100;
  const due = new Date(obligation.dueDate);
  const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 7;

  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-fg">{obligation.label}</div>
        <div className="text-xs text-fg-3 font-mono">
          {obligation.recurrence !== "once" ? obligation.recurrence : "única"}
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-mono text-fg">
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amountUsd)}
        </div>
        <div className={`text-xs font-mono ${isOverdue ? "text-neg" : isUrgent ? "text-warn" : "text-fg-3"}`}>
          {isOverdue ? `atrasado ${Math.abs(daysLeft)}d` : `em ${daysLeft}d`}
        </div>
      </div>
    </div>
  );
}

function DemoDashboard() {
  const { snap, projection, alerts, totals, positions, snapshotAge, orgName } = getDemoDashboardData();

  const demoBuckets = snap.buckets.map((b, i) => ({
    id: `demo-b-${i}`,
    kind: b.kind,
    label: ({ operating: "Operacional", payroll: "Folha", tax: "Impostos", emergency: "Reserva", yield: "Excedente", custom: "Outros" } as Record<string, string>)[b.kind] ?? b.kind,
    targetAmountCents: b.targetUsd * 100,
    currency: "USD",
    balanceUsd: b.balanceUsd,
  }));

  const demoObligations = snap.obligations.map((o) => ({
    id: o.id,
    label: o.label,
    amountCents: o.amountUsd * 100,
    dueDate: new Date(o.dueDateIso),
    recurrence: o.recurrence,
  }));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-start sm:items-center justify-between mb-6 sm:mb-8 gap-3">
        <div>
          <div className="text-xs text-fg-3 font-mono tracking-wider uppercase mb-1">
            {orgName} / Dashboard
          </div>
          <h1 className="text-xl font-semibold text-fg">Tesouraria</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SnapshotButton />
        </div>
      </div>

      <div className="text-xs text-fg-3 font-mono mb-4">
        último snapshot há {snapshotAge} min
      </div>

      <AlertsBanner alerts={alerts} />

      <div className="mb-6">
        <KpiGrid
          totalUsd={totals.totalUsd}
          liquidUsd={totals.liquidUsd}
          projection={projection}
          policyVersion={3}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
            Buckets
          </div>
          <div className="divide-y divide-line">
            {demoBuckets.map((b) => (
              <BucketCard key={b.id} bucket={b} balanceUsd={b.balanceUsd} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
            Obrigações
          </div>
          <div className="divide-y divide-line">
            {demoObligations.map((o) => (
              <ObligationRow key={o.id} obligation={o as typeof obligations.$inferSelect} />
            ))}
          </div>
        </div>
      </div>

      {positions.length > 0 && (
        <div className="rounded-xl border border-line bg-bg-1 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-line text-xs font-mono text-fg-3 uppercase tracking-wider">
            Posições alocadas
          </div>
          <PositionsTable positions={positions} />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { href: "/policy",    label: "Policy Engine", desc: "Regras e compliance",      icon: "⚖" },
          { href: "/copilot",   label: "AI Copilot",    desc: "Análise e recomendações",   icon: "✦" },
          { href: "/simulator", label: "Simulador",     desc: "Projeções e cenários",       icon: "◈" },
          { href: "/execution", label: "Execução",      desc: "Intents e transações",       icon: "▶" },
          { href: "/reports",   label: "Relatórios",    desc: "Histórico e exportações",    icon: "↗" },
        ].map(({ href, label, desc, icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-line bg-bg-1 p-4 hover:bg-bg-2 hover:border-accent/30 transition-all group"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="font-mono text-xs text-fg-3">{icon}</span>
              <div className="text-xs font-mono text-fg-2 uppercase tracking-wider truncate">{label}</div>
            </div>
            <div className="text-xs text-fg-3 group-hover:text-fg-2 transition-colors leading-snug">{desc}</div>
            <div className="text-xs text-accent mt-2 opacity-0 group-hover:opacity-100 transition-opacity">→</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function OnboardingPrompt() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div className="text-sm text-fg-2 mb-4">Você ainda não tem uma organização.</div>
        <a href="/setup" className="text-sm text-accent hover:underline">
          Iniciar onboarding →
        </a>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSnapshot(
  orgId: string,
  row: typeof snapshots.$inferSelect,
  orgBuckets: (typeof buckets.$inferSelect)[],
  orgObs: (typeof obligations.$inferSelect)[]
): TreasurySnapshot {
  const totals = row.totalsJson as { totalUsd: number; liquidUsd: number };
  const positions = (row.positionsJson as unknown[]) as TreasurySnapshot["positions"];
  return {
    id: row.id,
    orgId,
    takenAt: row.takenAt.toISOString(),
    totalUsd: totals.totalUsd ?? 0,
    liquidUsd: totals.liquidUsd ?? 0,
    positions,
    buckets: orgBuckets.map((b) => ({
      kind: b.kind as TreasurySnapshot["buckets"][number]["kind"],
      balanceUsd: 0,
      targetUsd: b.targetAmountCents / 100,
    })),
    obligations: orgObs.map((o) => ({
      id: o.id,
      label: o.label,
      amountUsd: o.amountCents / 100,
      dueDateIso: o.dueDate.toISOString(),
      bucketKind: "operating" as const,
      recurrence: o.recurrence as TreasurySnapshot["obligations"][number]["recurrence"],
    })),
  };
}

function buildPolicy(row: typeof policies.$inferSelect): Policy {
  return parsePolicy({
    id: row.id,
    version: row.version,
    orgId: row.orgId,
    status: row.status,
    preset: row.preset,
    rules: row.jsonSpec,
    activatedAt: row.activatedAt?.toISOString() ?? null,
  });
}
