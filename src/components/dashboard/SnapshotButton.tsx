"use client";

import { useState, useTransition } from "react";
import { takeSnapshot } from "@/app/(app)/dashboard/actions";

export function SnapshotButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleClick() {
    setStatus("idle");
    setErrorMsg(null);
    startTransition(async () => {
      const result = await takeSnapshot();
      if (result.ok) {
        setStatus("ok");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Erro desconhecido");
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {status === "error" && errorMsg && (
        <span className="text-xs text-neg">{errorMsg}</span>
      )}
      {status === "ok" && (
        <span className="text-xs text-accent">Snapshot capturado!</span>
      )}
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs text-fg-2 hover:text-fg hover:border-accent/40 hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? (
          <>
            <span className="inline-block w-3 h-3 border border-fg-3 border-t-transparent rounded-full animate-spin" />
            Capturando…
          </>
        ) : (
          <>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-fg-3">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="6" cy="6" r="2" fill="currentColor" />
            </svg>
            Snapshot
          </>
        )}
      </button>
    </div>
  );
}
