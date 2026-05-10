import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db/client";
import { memberships } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SetupWizard } from "@/components/onboarding/SetupWizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const existing = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  });
  if (existing) redirect("/dashboard");

  return <SetupWizard />;
}
