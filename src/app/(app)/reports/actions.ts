"use server";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots, policies, obligations, buckets } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { projectRunway } from "@/lib/rules-engine/projections";
import { parsePolicy, POLICY_PRESETS } from "@/lib/rules-engine/policy";
import type { TreasurySnapshot, Policy } from "@/lib/rules-engine/types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SONNET = "claude-sonnet-4-6";

export async function generateExecutiveSummary(): Promise<{
  ok: boolean;
  summary?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "não autenticado" };

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { org: true },
  });
  if (!membership) return { ok: false, error: "org não encontrada" };

  const orgId = membership.orgId;

  const [latestSnapshot, activePolicy, orgBuckets, orgObs] = await Promise.all([
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

  const totals = latestSnapshot?.totalsJson as
    | { totalUsd: number; liquidUsd: number }
    | undefined;

  const snapshot: TreasurySnapshot = latestSnapshot
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
    ? parsePolicy({ id: activePolicy.id, version: activePolicy.version, orgId, status: activePolicy.status, preset: activePolicy.preset, rules: activePolicy.jsonSpec, activatedAt: activePolicy.activatedAt?.toISOString() ?? null })
    : { ...POLICY_PRESETS.balanced, id: "fallback", version: 1, orgId, status: "active", activatedAt: null };

  const projection = projectRunway(snapshot, policy);

  const positions = snapshot.positions
    .map((p) => `${p.protocol} ${p.asset}: $${p.amountUsd.toLocaleString()} (${p.aprPct}% APR)`)
    .join(", ") || "nenhuma posição alocada";

  const violations = projection.violations.length > 0
    ? projection.violations.map((v) => `- ${v.message}`).join("\n")
    : "nenhuma violação";

  const prompt = `Você é o CFO operacional do TreasuryOS para a organização "${membership.org.name}".

Com base nos dados abaixo, gere um resumo executivo conciso (máximo 150 palavras) dos últimos 7 dias, incluindo estado do caixa, riscos identificados, yield gerado e recomendações imediatas. Responda em português, diretamente para um founder.

DADOS DA TESOURARIA:
- Total em caixa: $${projection.deployedCapitalUsd + snapshot.liquidUsd > 0 ? (snapshot.totalUsd).toLocaleString() : 0}
- Caixa líquido: $${snapshot.liquidUsd.toLocaleString()}
- Runway líquido: ${projection.liquidRunwayMonths.toFixed(1)} meses
- Capital alocado: $${projection.deployedCapitalUsd.toLocaleString()} (${projection.deployedPct.toFixed(1)}%)
- APR médio: ${projection.blendedAprPct.toFixed(2)}%
- Yield estimado/ano: $${projection.estimatedYieldYearUsd.toFixed(0)}
- Compliance: ${projection.complianceScore}/100
- Posições: ${positions}
- Violações: ${violations}`;

  try {
    const response = await anthropic.messages.create({
      model: SONNET,
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");

    return { ok: true, summary: text };
  } catch (err) {
    console.error("generateExecutiveSummary error:", err);
    return { ok: false, error: "Falha ao gerar resumo." };
  }
}
