import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupWizard } from "@/components/onboarding/SetupWizard";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <SetupWizard />;
}
