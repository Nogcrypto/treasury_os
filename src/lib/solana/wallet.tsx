"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

// ── Phantom window type ───────────────────────────────────────────────────────

interface PhantomSolana {
  isPhantom: boolean;
  publicKey: { toBase58(): string } | null;
  isConnected: boolean;
  connect(): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, encoding: string): Promise<{ signature: Uint8Array }>;
}

function getPhantom(): PhantomSolana | null {
  if (typeof window === "undefined") return null;
  const p = (window as { phantom?: { solana?: PhantomSolana } }).phantom?.solana;
  return p?.isPhantom ? p : null;
}

// ── SolanaProvider (passthrough — kept for import compatibility) ───────────────

export function SolanaProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// ── SIWS helpers ──────────────────────────────────────────────────────────────

interface SiwsMessage {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: string;
  nonce: string;
  issuedAt: string;
}

function buildSiwsMessage(address: string, nonce: string): SiwsMessage {
  return {
    domain: window.location.host,
    address,
    statement: "Sign in to TreasuryOS. This request will not trigger a blockchain transaction or cost any gas fees.",
    uri: window.location.origin,
    version: "1",
    chainId: "devnet",
    nonce,
    issuedAt: new Date().toISOString(),
  };
}

function siwsMessageToString(msg: SiwsMessage): string {
  return [
    `${msg.domain} wants you to sign in with your Solana account:`,
    msg.address,
    "",
    msg.statement,
    "",
    `URI: ${msg.uri}`,
    `Version: ${msg.version}`,
    `Chain ID: ${msg.chainId}`,
    `Nonce: ${msg.nonce}`,
    `Issued At: ${msg.issuedAt}`,
  ].join("\n");
}

// ── useSolana hook ────────────────────────────────────────────────────────────

interface SolanaContextValue {
  publicKey: { toBase58(): string } | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signInWithSolana: (nonce: string) => Promise<{ address: string; signature: string; message: string } | null>;
}

const SolanaContext = createContext<SolanaContextValue | null>(null);

export function SolanaContextProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<{ toBase58(): string } | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const connect = useCallback(async () => {
    const phantom = getPhantom();
    if (!phantom) {
      console.warn("Phantom not installed");
      return;
    }
    setConnecting(true);
    try {
      const resp = await phantom.connect();
      setPublicKey(resp.publicKey);
      setConnected(true);
    } catch (err) {
      console.warn("Wallet connect failed:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const phantom = getPhantom();
    if (phantom) await phantom.disconnect().catch(() => {});
    setPublicKey(null);
    setConnected(false);
  }, []);

  const signInWithSolana = useCallback(
    async (nonce: string): Promise<{ address: string; signature: string; message: string } | null> => {
      const phantom = getPhantom();
      if (!phantom || !publicKey) return null;

      const address = publicKey.toBase58();
      const msg = buildSiwsMessage(address, nonce);
      const msgStr = siwsMessageToString(msg);
      const encoded = new TextEncoder().encode(msgStr);

      try {
        const { signature } = await phantom.signMessage(encoded, "utf8");
        return {
          address,
          signature: Buffer.from(signature).toString("base64"),
          message: msgStr,
        };
      } catch {
        return null;
      }
    },
    [publicKey]
  );

  const value = useMemo(
    () => ({ publicKey, connected, connecting, connect, disconnect, signInWithSolana }),
    [publicKey, connected, connecting, connect, disconnect, signInWithSolana]
  );

  return <SolanaContext.Provider value={value}>{children}</SolanaContext.Provider>;
}

export function useSolana(): SolanaContextValue {
  const ctx = useContext(SolanaContext);
  if (!ctx) throw new Error("useSolana must be used inside SolanaContextProvider");
  return ctx;
}
