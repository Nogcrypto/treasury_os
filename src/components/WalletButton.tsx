"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

type Phantom = {
  isPhantom: boolean;
  isConnected: boolean;
  publicKey: { toBase58(): string } | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
};

function getPhantom(): Phantom | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { phantom?: { solana?: Phantom } }).phantom?.solana ?? null;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

interface WalletButtonProps {
  /** Server-known wallet address (from DB). Used as fallback display when Phantom not yet connected. */
  serverWalletAddress?: string;
}

export function WalletButton({ serverWalletAddress }: WalletButtonProps) {
  const t = useTranslations("wallet");
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [installed, setInstalled] = useState(true);

  // On mount: detect Phantom state
  useEffect(() => {
    const phantom = getPhantom();
    if (!phantom) { setInstalled(false); return; }
    // Already connected (e.g. page reload with trusted connection)
    if (phantom.isConnected && phantom.publicKey) {
      setAddress(phantom.publicKey.toBase58());
      return;
    }
    // Try silent reconnect
    phantom.connect({ onlyIfTrusted: true }).then((res) => {
      setAddress(res.publicKey.toBase58());
    }).catch(() => { /* not previously trusted — no-op */ });
  }, []);

  async function connect() {
    const phantom = getPhantom();
    if (!phantom) { window.open("https://phantom.app", "_blank"); return; }
    setConnecting(true);
    try {
      const res = await phantom.connect();
      setAddress(res.publicKey.toBase58());
    } catch { /* user rejected */ } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    const phantom = getPhantom();
    setMenuOpen(false);
    if (!phantom) return;
    try { await phantom.disconnect(); } catch { /* ignore */ }
    setAddress(null);
  }

  const display = address ?? serverWalletAddress ?? null;

  if (display) {
    return (
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-accent/30 bg-accent/5 text-[10px] font-mono text-accent hover:bg-accent/10 transition-colors"
        >
          {/* Phantom "P" logo proxy */}
          <span className="w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center text-[8px] font-bold text-accent shrink-0">P</span>
          {shortAddr(display)}
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-9 z-50 bg-bg-1 border border-line rounded-xl shadow-lg p-1 min-w-40">
              <button
                onClick={() => { navigator.clipboard.writeText(display); setMenuOpen(false); }}
                className="w-full text-left px-3 py-2 text-xs text-fg-2 hover:bg-bg-2 rounded-lg transition-colors font-mono"
              >
                {t("copy_address")}
              </button>
              <button
                onClick={disconnect}
                className="w-full text-left px-3 py-2 text-xs text-neg hover:bg-bg-2 rounded-lg transition-colors"
              >
                {t("disconnect")}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (!installed) {
    return (
      <a
        href="https://phantom.app"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line text-[10px] font-mono text-fg-3 hover:border-accent/30 hover:text-fg transition-colors"
      >
        {t("install_phantom")}
      </a>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-line bg-bg-2 text-[10px] font-mono text-fg-2 hover:border-accent/40 hover:text-fg disabled:opacity-50 transition-colors"
    >
      {connecting ? t("connecting") : t("connect_wallet")}
    </button>
  );
}
