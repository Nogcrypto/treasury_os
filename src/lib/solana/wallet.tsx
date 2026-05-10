"use client";

import React, { createContext, useContext, useMemo, useCallback } from "react";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, PublicKey } from "@solana/web3.js";

// ── Provider ──────────────────────────────────────────────────────────────────

interface SolanaProviderProps {
  children: React.ReactNode;
}

export function SolanaProvider({ children }: SolanaProviderProps) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? clusterApiUrl(network);

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}

// ── SIWS (Sign In With Solana) ─────────────────────────────────────────────

export interface SiwsMessage {
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
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signInWithSolana: (nonce: string) => Promise<{ address: string; signature: string; message: string } | null>;
}

const SolanaContext = createContext<SolanaContextValue | null>(null);

export function SolanaContextProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, connecting, connect: walletConnect, disconnect: walletDisconnect, signMessage } = useWallet();

  const connect = useCallback(async () => {
    try {
      await walletConnect();
    } catch (err) {
      // User rejected or Phantom not installed
      console.warn("Wallet connect failed:", err);
    }
  }, [walletConnect]);

  const disconnect = useCallback(async () => {
    await walletDisconnect();
  }, [walletDisconnect]);

  const signInWithSolana = useCallback(
    async (nonce: string): Promise<{ address: string; signature: string; message: string } | null> => {
      if (!publicKey || !signMessage) return null;

      const msg = buildSiwsMessage(publicKey.toBase58(), nonce);
      const msgStr = siwsMessageToString(msg);
      const encoded = new TextEncoder().encode(msgStr);

      try {
        const signatureBytes = await signMessage(encoded);
        return {
          address: publicKey.toBase58(),
          signature: Buffer.from(signatureBytes).toString("base64"),
          message: msgStr,
        };
      } catch {
        return null;
      }
    },
    [publicKey, signMessage]
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

// Re-export for convenience
export { useConnection };
