import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
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

  return (
    <div className="min-h-screen bg-bg-0 text-fg">
      <AppShell
        email={user.email}
        orgName={membership?.org?.name}
      >
        {children}
      </AppShell>
    </div>
  );
}
