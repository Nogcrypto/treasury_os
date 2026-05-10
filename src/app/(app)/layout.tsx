import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AppShell } from "@/components/AppShell";
import { isDemoUser, DEMO_ORG_ID, DEMO_ORG_NAME } from "@/lib/demo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userName = (user.user_metadata?.full_name as string | undefined) ?? undefined;

  if (isDemoUser(user.email)) {
    return (
      <div className="min-h-screen bg-bg-0 text-fg">
        <AppShell
          email={user.email}
          orgName={DEMO_ORG_NAME}
          orgId={DEMO_ORG_ID}
          walletAddress={undefined}
          userName={userName ?? "Demo User"}
        >
          {children}
        </AppShell>
      </div>
    );
  }

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { org: true },
  });

  const orgId = membership?.orgId;

  const wallet = orgId
    ? await db.query.wallets.findFirst({ where: eq(wallets.orgId, orgId) })
    : undefined;

  return (
    <div className="min-h-screen bg-bg-0 text-fg">
      <AppShell
        email={user.email}
        orgName={membership?.org?.name}
        orgId={orgId}
        walletAddress={wallet?.address}
        userName={userName}
      >
        {children}
      </AppShell>
    </div>
  );
}
