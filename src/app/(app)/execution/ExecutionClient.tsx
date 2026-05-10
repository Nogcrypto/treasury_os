"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExecutionDrawer, type IntentRow } from "@/components/ExecutionDrawer";
import { approveIntent, executeSimulated, rejectIntent, createIntent } from "./actions";

export function ExecutionClient({
  intents,
  walletAddress,
}: {
  intents: IntentRow[];
  walletAddress?: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleApprove(intentId: string) {
    await approveIntent(intentId);
    refresh();
  }

  async function handleExecute(intentId: string) {
    await executeSimulated(intentId);
    refresh();
  }

  async function handleReject(intentId: string) {
    await rejectIntent(intentId);
    refresh();
  }

  async function handleCreate(data: { kind: string; adapterId: string; amountUsd: number }) {
    await createIntent(data);
    refresh();
  }

  return (
    <ExecutionDrawer
      intents={intents}
      walletAddress={walletAddress}
      onApprove={handleApprove}
      onExecute={handleExecute}
      onReject={handleReject}
      onCreate={handleCreate}
    />
  );
}
