import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, snapshots, policies } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isDemoUser } from "@/lib/demo";
import { Copilot } from "@/components/Copilot";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isDemoUser(user.email)) {
    return (
      <Copilot
        hasSnapshot
        policyVersion={3}
        snapshotCount={3}
        orgName="Capivara Ventures"
      />
    );
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { org: true },
  });
  if (!membership) redirect("/setup");

  const [latestSnapshot, activePolicy] = await Promise.all([
    db.query.snapshots.findFirst({
      where: eq(snapshots.orgId, membership.orgId),
      orderBy: [desc(snapshots.takenAt)],
    }),
    db.query.policies.findFirst({
      where: and(eq(policies.orgId, membership.orgId), eq(policies.status, "active")),
    }),
  ]);

  const snapshotCount = latestSnapshot ? 1 : 0;

  return (
    <Copilot
      hasSnapshot={!!latestSnapshot}
      policyVersion={activePolicy?.version}
      snapshotCount={snapshotCount}
      orgName={membership.org.name}
    />
  );
}
