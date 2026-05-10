"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ExecutionDrawer } from "@/components/ExecutionDrawer";
import { approveIntent, executeSimulated, rejectIntent } from "./actions";

interface Intent {
  id: string;
  kind: string;
  status: string;
  paramsJson: unknown;
  createdAt: Date | string;
}

export function ExecutionClient({ intents }: { intents: Intent[] }) {
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

  return (
    <ExecutionDrawer
      intents={intents as Parameters<typeof ExecutionDrawer>[0]["intents"]}
      onApprove={handleApprove}
      onExecute={handleExecute}
      onReject={handleReject}
    />
  );
}
