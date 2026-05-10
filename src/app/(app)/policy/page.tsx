import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, policies } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { parsePolicy, POLICY_PRESETS } from "@/lib/rules-engine/policy";
import { PolicyBuilder } from "@/components/PolicyBuilder";
import { isDemoUser, getDemoPolicy, getDemoPolicyVersions } from "@/lib/demo";
import type { PolicyRule } from "@/lib/rules-engine/types";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isDemoUser(user.email)) {
    const demoPolicy = getDemoPolicy();
    const demoVersions = getDemoPolicyVersions();
    return (
      <PolicyBuilder
        activeRules={demoPolicy.rules as PolicyRule[]}
        activePreset={demoPolicy.preset}
        activeVersion={demoPolicy.version}
        versions={demoVersions}
      />
    );
  }

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

  const versions = allVersions.map((v) => ({
    id: v.id,
    version: v.version,
    status: v.status as "draft" | "active" | "archived",
    preset: v.preset,
    activatedAt: v.activatedAt?.toISOString() ?? null,
    authorLabel: undefined as string | undefined,
  }));

  return (
    <PolicyBuilder
      activeRules={rules}
      activePreset={activePolicy?.preset ?? "balanced"}
      activeVersion={activePolicy?.version ?? 1}
      versions={versions}
    />
  );
}
