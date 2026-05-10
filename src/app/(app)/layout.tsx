import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { AppShell } from "@/components/AppShell";

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

  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
    with: { org: true },
  });

  const orgId = membership?.orgId;

  const wallet = orgId
    ? await db.query.wallets.findFirst({ where: eq(wallets.orgId, orgId) })
    : undefined;

  const userName = (user.user_metadata?.full_name as string | undefined) ?? undefined;

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
