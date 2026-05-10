"use client";

import { SolanaProvider, SolanaContextProvider } from "@/lib/solana/wallet";
import { SetupWizard } from "./SetupWizard";

export function SetupWizardWithProviders() {
  return (
    <SolanaProvider>
      <SolanaContextProvider>
        <SetupWizard />
      </SolanaContextProvider>
    </SolanaProvider>
  );
}
