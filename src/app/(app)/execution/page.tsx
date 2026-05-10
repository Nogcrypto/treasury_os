import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, intents, wallets } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isDemoUser, getDemoIntents } from "@/lib/demo";
import { ExecutionClient } from "./ExecutionClient";

export const dynamic = "force-dynamic";

export default async function ExecutionPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (isDemoUser(user.email)) {
    return <ExecutionClient intents={getDemoIntents()} walletAddress={undefined} />;
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (!membership) redirect("/setup");

  const orgId = membership.orgId;

  const [orgIntents, walletRow] = await Promise.all([
    db.query.intents.findMany({
      where: eq(intents.orgId, orgId),
      orderBy: [desc(intents.createdAt)],
      limit: 50,
      with: { executions: true },
    }),
    db.query.wallets.findFirst({
      where: eq(wallets.orgId, orgId),
    }),
  ]);

  const intentRows = orgIntents.map((intent) => {
    const exec = intent.executions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    return {
      ...intent,
      txSignature: exec?.txSignature ?? null,
      onchainAt: exec?.onchainAt ?? null,
    };
  });

  return <ExecutionClient intents={intentRows} walletAddress={walletRow?.address} />;
}
