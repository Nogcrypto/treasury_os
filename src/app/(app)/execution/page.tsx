import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, intents, recommendations } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ExecutionClient } from "./ExecutionClient";

export const dynamic = "force-dynamic";

export default async function ExecutionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) redirect("/setup");

  const orgId = membership.orgId;

  const [orgIntents, pendingRecs] = await Promise.all([
    db.query.intents.findMany({
      where: eq(intents.orgId, orgId),
      orderBy: [desc(intents.createdAt)],
      limit: 50,
    }),
    db.query.recommendations.findMany({
      where: eq(recommendations.orgId, orgId),
      orderBy: [desc(recommendations.createdAt)],
      limit: 5,
    }),
  ]);

  const pendingRecsData = pendingRecs.filter((r) => r.status === "pending");

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <div className="text-xs text-fg-3 font-mono tracking-wider uppercase mb-1">
          Tesouraria / Execução
        </div>
        <h1 className="text-xl font-semibold text-fg">Execução de intents</h1>
        <p className="text-sm text-fg-3 mt-1">
          Aprove, execute ou rejeite movimentos propostos pelo Simulador ou Copilot.
        </p>
      </div>

      {/* Pending recommendations */}
      {pendingRecsData.length > 0 && (
        <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 mb-6">
          <div className="text-xs font-mono text-accent uppercase tracking-wider mb-2">
            {pendingRecsData.length} recomendação{pendingRecsData.length > 1 ? "ões" : ""} pendente{pendingRecsData.length > 1 ? "s" : ""}
          </div>
          {pendingRecsData.map((r) => (
            <div key={r.id} className="text-sm text-fg-2 flex gap-2 items-start">
              <span className="text-accent mt-0.5 shrink-0">▸</span>
              <span>{r.rationale ?? "Recomendação sem descrição"}</span>
            </div>
          ))}
          <p className="text-xs text-fg-3 mt-2">
            Aprove uma recomendação no Simulador para criar intents automaticamente.
          </p>
        </div>
      )}

      <ExecutionClient intents={orgIntents} />
    </div>
  );
}
