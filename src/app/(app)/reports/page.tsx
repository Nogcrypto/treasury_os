import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots, policies, buckets, obligations, auditLog, events } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { projectRunway } from "@/lib/rules-engine/projections";
import { parsePolicy, POLICY_PRESETS } from "@/lib/rules-engine/policy";
import type { TreasurySnapshot, Policy } from "@/lib/rules-engine/types";
import { ReportsClient } from "./ReportsClient";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { org: true },
  });
  if (!membership) return null;

  const orgId = membership.orgId;

  const [latestSnapshot, activePolicy, orgBuckets, orgObs, logEntries, orgEvents] = await Promise.all([
    db.query.snapshots.findFirst({
      where: eq(snapshots.orgId, orgId),
      orderBy: [desc(snapshots.takenAt)],
    }),
    db.query.policies.findFirst({
      where: and(eq(policies.orgId, orgId), eq(policies.status, "active")),
    }),
    db.query.buckets.findMany({ where: eq(buckets.orgId, orgId) }),
    db.query.obligations.findMany({ where: eq(obligations.orgId, orgId) }),
    db.select().from(auditLog).where(eq(auditLog.orgId, orgId)).orderBy(desc(auditLog.at)).limit(50),
    db.select().from(events).where(eq(events.orgId, orgId)).orderBy(desc(events.createdAt)).limit(50),
  ]);

  // Merge and sort timeline events
  const timeline: { at: Date; label: string; detail: string; kind: "audit" | "event" }[] = [
    ...logEntries.map((e) => ({
      at: e.at,
      label: e.action,
      detail: e.target,
      kind: "audit" as const,
    })),
    ...orgEvents.map((e) => ({
      at: e.createdAt,
      label: e.type,
      detail: JSON.stringify(e.payloadJson).slice(0, 80),
      kind: "event" as const,
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  // Build projection for PDF data
  const totals = latestSnapshot?.totalsJson as { totalUsd: number; liquidUsd: number } | undefined;

  const snap: TreasurySnapshot = latestSnapshot
    ? {
        id: latestSnapshot.id,
        orgId,
        takenAt: latestSnapshot.takenAt.toISOString(),
        totalUsd: totals?.totalUsd ?? 0,
        liquidUsd: totals?.liquidUsd ?? 0,
        positions: (latestSnapshot.positionsJson as unknown[]) as TreasurySnapshot["positions"],
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
      }
    : { id: "empty", orgId, takenAt: new Date().toISOString(), totalUsd: 0, liquidUsd: 0, positions: [], buckets: [], obligations: [] };

  const policy: Policy = activePolicy
    ? parsePolicy({
        id: activePolicy.id,
        version: activePolicy.version,
        orgId,
        status: activePolicy.status,
        preset: activePolicy.preset,
        rules: activePolicy.jsonSpec,
        activatedAt: activePolicy.activatedAt?.toISOString() ?? null,
      })
    : { ...POLICY_PRESETS.balanced, id: "fallback", version: 1, orgId, status: "active", activatedAt: null };

  const projection = projectRunway(snap, policy);

  const pdfData = {
    orgName: membership.org.name,
    reportDate: new Date().toLocaleDateString("pt-BR"),
    totalUsd: snap.totalUsd,
    liquidUsd: snap.liquidUsd,
    runwayMonths: projection.liquidRunwayMonths,
    deployedUsd: projection.deployedCapitalUsd,
    deployedPct: projection.deployedPct,
    blendedAprPct: projection.blendedAprPct,
    estimatedYieldYear: projection.estimatedYieldYearUsd,
    complianceScore: projection.complianceScore,
    policyPreset: policy.preset,
    policyVersion: policy.version,
    positions: snap.positions.map((p) => ({
      protocol: p.protocol,
      asset: p.asset,
      amountUsd: p.amountUsd,
      aprPct: p.aprPct,
    })),
    violations: projection.violations.map((v) => ({
      message: v.message,
      severity: v.severity,
    })),
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="text-xs text-fg-3 font-mono tracking-wider uppercase mb-1">
          {membership.org.name} / Relatórios
        </div>
        <h1 className="text-xl font-semibold text-fg">Relatórios & Decision Log</h1>
      </div>

      {/* Executive summary + PDF export */}
      <div className="rounded-xl border border-line bg-bg-1 p-5 mb-6">
        <div className="text-xs font-mono text-fg-3 uppercase tracking-wider mb-4">
          Resumo executivo
        </div>
        <ReportsClient pdfData={pdfData} />
      </div>

      {/* Decision log timeline */}
      <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
        <div className="px-5 py-3 border-b border-line flex items-center justify-between">
          <div className="text-xs font-mono text-fg-3 uppercase tracking-wider">
            Decision Log
          </div>
          <div className="text-xs text-fg-3 font-mono">{timeline.length} entradas</div>
        </div>

        {timeline.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-fg-3">
            Nenhuma ação registrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {timeline.map((entry, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-fg-3 mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-fg">{entry.label}</span>
                    <span
                      className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                        entry.kind === "audit"
                          ? "bg-accent/10 text-accent"
                          : "bg-fg-3/10 text-fg-3"
                      }`}
                    >
                      {entry.kind}
                    </span>
                  </div>
                  {entry.detail && (
                    <div className="text-xs text-fg-3 font-mono mt-0.5 truncate">{entry.detail}</div>
                  )}
                </div>
                <div className="text-xs text-fg-3 font-mono shrink-0 whitespace-nowrap">
                  {entry.at.toLocaleDateString("pt-BR")}{" "}
                  {entry.at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
