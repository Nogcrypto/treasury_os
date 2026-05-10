import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import dynamic from "next/dynamic";

export const dynamic = "force-dynamic";

// Solana wallet-adapter uses rpc-websockets which requires uuid as CJS,
// but uuid v9+ is ESM-only. Loading with ssr:false prevents the server
// from ever touching these packages.
const SetupWizard = dynamic(
  () => import("@/components/onboarding/SetupWizard").then((m) => ({ default: m.SetupWizard })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[oklch(0.14_0.006_240)] flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-[oklch(0.82_0.18_148)] animate-pulse" />
      </div>
    ),
  }
);

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return <SetupWizard />;
}
