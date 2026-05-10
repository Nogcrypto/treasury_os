import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, policies } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { parsePolicy } from "@/lib/rules-engine/policy";
import { POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { PolicyBuilder } from "@/components/PolicyBuilder";
import type { PolicyRule } from "@/lib/rules-engine/types";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) redirect("/setup");

  const [activePolicy, allVersions] = await Promise.all([
    db.query.policies.findFirst({
      where: and(eq(policies.orgId, membership.orgId), eq(policies.status, "active")),
    }),
    db.query.policies.findMany({
      where: eq(policies.orgId, membership.orgId),
      orderBy: [desc(policies.version)],
      limit: 10,
    }),
  ]);

  const rules: PolicyRule[] = activePolicy
    ? (parsePolicy({
        id: activePolicy.id,
        version: activePolicy.version,
        orgId: activePolicy.orgId,
        status: activePolicy.status,
        preset: activePolicy.preset,
        rules: activePolicy.jsonSpec,
        activatedAt: activePolicy.activatedAt?.toISOString() ?? null,
      }).rules as PolicyRule[])
    : (POLICY_PRESETS.balanced.rules as PolicyRule[]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="text-xs text-fg-3 font-mono tracking-wider uppercase mb-1">
          Tesouraria / Política
        </div>
        <h1 className="text-xl font-semibold text-fg">Policy Builder</h1>
        <p className="text-sm text-fg-3 mt-1">
          Configure as regras que governam alocações e alertas da sua tesouraria.
        </p>
      </div>

      <PolicyBuilder
        activeRules={rules}
        activePreset={activePolicy?.preset ?? "balanced"}
        activeVersion={activePolicy?.version ?? 1}
      />

      {/* Version history */}
      {allVersions.length > 1 && (
        <div className="mt-8">
          <div className="text-xs font-mono text-fg-3 uppercase tracking-wider mb-3">
            Histórico de versões
          </div>
          <div className="rounded-xl border border-line overflow-hidden divide-y divide-line">
            {allVersions.map((v) => (
              <div key={v.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm text-fg font-mono">v{v.version}</span>
                  <span className="ml-2 text-xs text-fg-3">{v.preset}</span>
                </div>
                <div className="flex items-center gap-3">
                  {v.activatedAt && (
                    <span className="text-xs text-fg-3 font-mono">
                      {new Date(v.activatedAt).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  <span
                    className={`text-xs font-mono px-2 py-0.5 rounded-full border ${
                      v.status === "active"
                        ? "text-accent border-accent/30 bg-accent/5"
                        : v.status === "draft"
                        ? "text-fg-3 border-line"
                        : "text-fg-3 border-line opacity-50"
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
