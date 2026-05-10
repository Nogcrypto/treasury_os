"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSolana } from "@/lib/solana/wallet";

interface Props {
  orgId: string;
  orgName?: string;
  userName?: string;
  email?: string;
  walletAddress?: string;
  onClose: () => void;
}

async function callLinkWallet(data: {
  orgId: string;
  address: string;
  signature: string;
  message: string;
}) {
  const res = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "linkWallet", ...data }),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

function WalletSection({ orgId, initialAddress }: { orgId: string; initialAddress?: string }) {
  const { publicKey, connected, connecting, connect, signInWithSolana } = useSolana();
  const [address, setAddress] = useState(initialAddress);
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  if (address) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-[oklch(0.6_0.02_240)] font-mono uppercase tracking-wider">
          Wallet Solana
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[oklch(0.82_0.18_148)/30] bg-[oklch(0.82_0.18_148)/8] px-3 py-2.5">
          <span className="w-2 h-2 rounded-full bg-[oklch(0.82_0.18_148)] shrink-0" />
          <span className="text-xs font-mono text-[oklch(0.75_0.02_240)] truncate">
            {address.slice(0, 8)}…{address.slice(-6)}
          </span>
          <span className="ml-auto text-xs text-[oklch(0.82_0.18_148)]">✓</span>
        </div>
      </div>
    );
  }

  async function handleSign() {
    if (!connected) return;
    setStatus("signing");
    setError(null);
    const nonce = crypto.randomUUID();
    const result = await signInWithSolana(nonce);
    if (!result) {
      setStatus("error");
      setError("Assinatura cancelada.");
      return;
    }
    setPending(true);
    try {
      const res = await callLinkWallet({ orgId, ...result });
      if (!res.ok) {
        setStatus("error");
        setError(res.error ?? "Falha ao vincular.");
      } else {
        setStatus("done");
        setAddress(result.address);
        router.refresh();
      }
    } catch {
      setStatus("error");
      setError("Erro de conexão.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-[oklch(0.6_0.02_240)] font-mono uppercase tracking-wider">
        Wallet Solana
      </div>
      <p className="text-xs text-[oklch(0.5_0.02_240)]">
        Nenhuma wallet vinculada. Conecte seu Phantom para assinar transações na devnet.
      </p>

      {!connected ? (
        <button
          onClick={connect}
          disabled={connecting}
          className="w-full py-2 rounded-lg border border-[oklch(0.28_0.006_240)] text-sm text-white hover:border-[oklch(0.82_0.18_148)/50] hover:bg-[oklch(0.82_0.18_148)/5] disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          <PhantomIcon />
          {connecting ? "Conectando…" : "Conectar Phantom"}
        </button>
      ) : status === "done" ? (
        <div className="text-center text-sm text-[oklch(0.82_0.18_148)] font-mono py-1">
          Wallet vinculada ✓
        </div>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg border border-[oklch(0.28_0.006_240)] bg-[oklch(0.22_0.006_240)] px-3 py-2 text-xs font-mono text-[oklch(0.6_0.02_240)] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[oklch(0.82_0.18_148)]" />
            {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-6)}
          </div>
          <button
            onClick={handleSign}
            disabled={status === "signing" || pending}
            className="w-full py-2 rounded-lg bg-[oklch(0.82_0.18_148)] text-[oklch(0.14_0.006_240)] text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-all"
          >
            {status === "signing" || pending ? "Assinando…" : "Assinar com Phantom →"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function PhantomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="24" fill="#AB9FF2" />
      <path
        d="M110.584 64.456c0 27.804-22.53 50.334-50.334 50.334-27.803 0-50.334-22.53-50.334-50.334 0-27.803 22.531-50.334 50.334-50.334 27.804 0 50.334 22.531 50.334 50.334z"
        fill="white"
      />
      <path
        d="M64 38c-14.359 0-26 11.641-26 26s11.641 26 26 26 26-11.641 26-26-11.641-26-26-26zm0 8c9.941 0 18 8.059 18 18s-8.059 18-18 18-18-8.059-18-18 8.059-18 18-18z"
        fill="#AB9FF2"
      />
    </svg>
  );
}

function initials(name?: string, email?: string) {
  if (name) {
    const parts = name.trim().split(" ");
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export function ProfilePanel({ orgId, orgName, userName, email, walletAddress, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-start sm:justify-start p-0 sm:p-4 sm:pl-[220px]"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:w-72 bg-[oklch(0.18_0.006_240)] border border-[oklch(0.25_0.006_240)] rounded-t-2xl sm:rounded-xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Perfil</span>
          <button
            onClick={onClose}
            className="text-[oklch(0.5_0.02_240)] hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[oklch(0.82_0.18_148)/20] border border-[oklch(0.82_0.18_148)/30] flex items-center justify-center text-sm font-semibold text-[oklch(0.82_0.18_148)]">
            {initials(userName, email)}
          </div>
          <div className="min-w-0">
            {userName && (
              <div className="text-sm font-medium text-white truncate">{userName}</div>
            )}
            <div className="text-xs text-[oklch(0.5_0.02_240)] truncate">{email}</div>
          </div>
        </div>

        {/* Org */}
        {orgName && (
          <div className="rounded-lg bg-[oklch(0.22_0.006_240)] border border-[oklch(0.28_0.006_240)] px-3 py-2 flex items-center gap-2">
            <span className="text-xs text-[oklch(0.5_0.02_240)]">Organização</span>
            <span className="ml-auto text-xs font-medium text-white truncate">{orgName}</span>
          </div>
        )}

        <div className="h-px bg-[oklch(0.25_0.006_240)]" />

        {/* Wallet */}
        <WalletSection orgId={orgId} initialAddress={walletAddress} />
      </div>
    </div>
  );
}
