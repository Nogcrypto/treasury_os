import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Copilot } from "@/components/Copilot";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) redirect("/setup");

  const latestSnapshot = await db.query.snapshots.findFirst({
    where: eq(snapshots.orgId, membership.orgId),
    orderBy: [desc(snapshots.takenAt)],
  });

  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-line shrink-0">
        <div className="text-xs text-fg-3 font-mono tracking-wider uppercase mb-0.5">
          Tesouraria / Copilot
        </div>
        <h1 className="text-sm font-semibold text-fg">AI Copilot ✦</h1>
      </div>
      <div className="flex-1 min-h-0">
        <Copilot hasSnapshot={!!latestSnapshot} />
      </div>
    </div>
  );
}
