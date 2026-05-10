"use client";

import { useRouter } from "next/navigation";
import { TokenSetupClient } from "./TokenSetupClient";

export function TokenSetupClientWrapper() {
  const router = useRouter();
  return <TokenSetupClient onSuccess={() => router.refresh()} />;
}
