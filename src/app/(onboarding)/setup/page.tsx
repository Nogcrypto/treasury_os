import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupWizardClient } from "@/components/onboarding/SetupWizardClient";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <SetupWizardClient />;
}
