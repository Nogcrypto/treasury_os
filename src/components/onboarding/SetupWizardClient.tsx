"use client";

import nextDynamic from "next/dynamic";

// ssr: false prevents the server from loading @solana/web3.js → rpc-websockets
// which does require(uuid) but uuid v9+ is ESM-only → ERR_REQUIRE_ESM.
// Must live in a Client Component — ssr:false is not allowed in Server Components.
const SetupWizardDynamic = nextDynamic(
  () => import("./SetupWizard").then((m) => ({ default: m.SetupWizard })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[oklch(0.14_0.006_240)] flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-[oklch(0.82_0.18_148)] animate-pulse" />
      </div>
    ),
  }
);

export function SetupWizardClient() {
  return <SetupWizardDynamic />;
}
