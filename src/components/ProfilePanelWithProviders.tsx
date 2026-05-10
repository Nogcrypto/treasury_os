"use client";

import { SolanaProvider, SolanaContextProvider } from "@/lib/solana/wallet";
import { ProfilePanel } from "./ProfilePanel";

interface Props {
  orgId: string;
  orgName?: string;
  userName?: string;
  email?: string;
  walletAddress?: string;
  onClose: () => void;
}

export function ProfilePanelWithProviders(props: Props) {
  return (
    <SolanaProvider>
      <SolanaContextProvider>
        <ProfilePanel {...props} />
      </SolanaContextProvider>
    </SolanaProvider>
  );
}
