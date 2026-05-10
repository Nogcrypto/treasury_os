"use client";

import { useState, useTransition } from "react";
import { Connection, PublicKey, SystemProgram, Keypair, Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { configureEquityToken } from "@/app/(app)/equity-studio/actions";

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const MINT_SPACE = 82;

function buildInitializeMintIx(
  mint: PublicKey,
  mintAuthority: PublicKey,
  decimals: number
): TransactionInstruction {
  const data = Buffer.alloc(67);
  data.writeUInt8(0, 0);                       // InitializeMint
  data.writeUInt8(decimals, 1);
  mintAuthority.toBuffer().copy(data, 2);      // mint_authority
  data.writeUInt8(0, 34);                      // freeze_authority = None
  Buffer.alloc(32).copy(data, 35);
  return new TransactionInstruction({
    keys: [
      { pubkey: mint,              isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data,
  });
}

// ── Tab: Import existing token ────────────────────────────────────────────────

function ImportTab({ onSuccess }: { onSuccess: () => void }) {
  const [mint, setMint] = useState("");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState(6);
  const [price, setPrice] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function fetchOnchain() {
    if (mint.length < 32) return;
    setFetching(true);
    setFetchError("");
    try {
      const conn = new Connection(RPC_URL, "confirmed");
      const pk = new PublicKey(mint);
      const supply = await conn.getTokenSupply(pk);
      setDecimals(supply.value.decimals);
      setFetchError("");
    } catch {
      setFetchError("Mint não encontrado na devnet. Verifique o endereço.");
    } finally {
      setFetching(false);
    }
  }

  function handleSubmit() {
    if (!mint || !symbol || !name) { setError("Preencha mint, símbolo e nome."); return; }
    setError("");
    const priceUsdcE6 = price ? Math.round(parseFloat(price) * 1_000_000) : undefined;
    startTransition(async () => {
      const res = await configureEquityToken({ mint, symbol: symbol.toUpperCase(), name, decimals, priceUsdcE6 });
      if (!res.ok) { setError(res.error ?? "Erro ao salvar."); return; }
      onSuccess();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-fg-3">
        Cole o endereço do mint SPL Token da sua empresa. Buscaremos os dados on-chain automaticamente.
      </p>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-fg-3 mb-1">Mint address *</label>
          <div className="flex gap-2">
            <input
              value={mint}
              onChange={(e) => { setMint(e.target.value); setFetchError(""); }}
              onBlur={fetchOnchain}
              placeholder="TokenMintAddressHere..."
              className="flex-1 bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors"
            />
            <button
              onClick={fetchOnchain}
              disabled={fetching || mint.length < 32}
              className="px-3 py-2 rounded-lg border border-line text-xs text-fg-2 hover:bg-bg-2 disabled:opacity-40 transition-all shrink-0"
            >
              {fetching ? "…" : "Verificar"}
            </button>
          </div>
          {fetchError && <p className="text-[11px] text-neg mt-1">{fetchError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-3 mb-1">Símbolo *</label>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={12}
              placeholder="CAPI"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-fg-3 mb-1">Decimais</label>
            <input type="number" value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} min={0} max={9}
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-fg-3 mb-1">Nome do token *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Capivara Ventures Equity Token"
            className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors" />
        </div>

        <div>
          <label className="block text-xs text-fg-3 mb-1">Preço inicial USDC (opcional)</label>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} step="0.001" placeholder="0.082"
            className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors" />
        </div>
      </div>

      {error && <p className="text-xs text-neg">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending || !mint || !symbol || !name}
        className="w-full px-4 py-2.5 rounded-lg bg-accent text-bg-0 text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {isPending ? "Salvando…" : "Conectar token →"}
      </button>
    </div>
  );
}

// ── Tab: Create new token on devnet ──────────────────────────────────────────

function CreateTab({ onSuccess }: { onSuccess: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [decimals, setDecimals] = useState(6);
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<"idle" | "creating" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function handleCreate() {
    if (!symbol || !name) { setMessage("Preencha símbolo e nome."); return; }

    const phantom = (window as unknown as { phantom?: { solana?: { isConnected: boolean; publicKey: { toBase58: () => string; toBuffer: () => Buffer }; signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }> } } }).phantom?.solana;
    if (!phantom?.isConnected) {
      setMessage("Conecte a Phantom primeiro (botão no topo direito).");
      return;
    }

    setStatus("creating");
    setMessage("Preparando transação…");

    try {
      const conn = new Connection(RPC_URL, "confirmed");
      const payerPk = new PublicKey(phantom.publicKey.toBase58());

      // Generate a new keypair for the mint
      const mintKeypair = Keypair.generate();
      const lamports = await conn.getMinimumBalanceForRentExemption(MINT_SPACE);
      const { blockhash } = await conn.getLatestBlockhash();

      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: payerPk,
      });

      tx.add(
        SystemProgram.createAccount({
          fromPubkey: payerPk,
          newAccountPubkey: mintKeypair.publicKey,
          lamports,
          space: MINT_SPACE,
          programId: TOKEN_PROGRAM_ID,
        }),
        buildInitializeMintIx(mintKeypair.publicKey, payerPk, decimals)
      );

      // Partial sign with mint keypair (required since it's a new account)
      tx.partialSign(mintKeypair);

      setMessage("Assine a transação na Phantom…");

      const { signature } = await phantom.signAndSendTransaction(tx);

      setMessage("Confirmando on-chain…");
      await conn.confirmTransaction(signature, "confirmed");

      const mintAddress = mintKeypair.publicKey.toBase58();
      setMessage(`Token criado! Mint: ${mintAddress.slice(0, 8)}…${mintAddress.slice(-4)}`);

      // Save to DB
      const priceUsdcE6 = price ? Math.round(parseFloat(price) * 1_000_000) : undefined;
      startTransition(async () => {
        const res = await configureEquityToken({
          mint: mintAddress,
          symbol: symbol.toUpperCase(),
          name,
          decimals,
          priceUsdcE6,
        });
        if (!res.ok) { setStatus("error"); setMessage(res.error ?? "Erro ao salvar."); return; }
        setStatus("done");
        setTimeout(onSuccess, 1200);
      });
    } catch (e: unknown) {
      setStatus("error");
      setMessage((e as Error).message ?? "Erro desconhecido");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-fg-3">
        Cria um novo mint SPL Token na Solana devnet. Sua Phantom wallet será definida como mint authority.
      </p>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-fg-3 mb-1">Símbolo *</label>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} maxLength={12} placeholder="CAPI"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors" />
          </div>
          <div>
            <label className="block text-xs text-fg-3 mb-1">Decimais</label>
            <input type="number" value={decimals} onChange={(e) => setDecimals(Number(e.target.value))} min={0} max={9}
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-fg-3 mb-1">Nome do token *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Empresa Equity Token"
            className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors" />
        </div>

        <div>
          <label className="block text-xs text-fg-3 mb-1">Preço inicial USDC (opcional)</label>
          <input type="number" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.050"
            className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-sm font-mono text-fg focus:outline-none focus:border-accent/60 transition-colors" />
        </div>
      </div>

      <div className="rounded-lg bg-bg-2 border border-line p-3 text-xs text-fg-3">
        <p className="font-mono text-warn mb-1">Requer ~0.0015 SOL na Phantom (rent exemption)</p>
        <p>Você precisará de SOL na devnet. Use <code className="text-accent">solana airdrop 1</code> ou o faucet.solana.com</p>
      </div>

      {message && (
        <div className={`rounded-lg p-3 text-xs font-mono ${status === "error" ? "bg-neg/10 text-neg" : status === "done" ? "bg-accent/10 text-accent" : "bg-bg-2 text-fg-2"}`}>
          {status === "creating" && <span className="animate-pulse">⟳ </span>}
          {status === "done" && "✓ "}
          {message}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={status === "creating" || status === "done" || !symbol || !name}
        className="w-full px-4 py-2.5 rounded-lg bg-accent text-bg-0 text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {status === "creating" ? "Criando…" : status === "done" ? "Criado ✓" : "Criar token na Devnet →"}
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function TokenSetupClient({ onSuccess }: { onSuccess: () => void }) {
  const [tab, setTab] = useState<"import" | "create">("import");

  return (
    <div className="max-w-lg mx-auto">
      <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
        <div className="px-6 py-5 border-b border-line">
          <h2 className="text-base font-semibold text-fg mb-1">Configurar Token de Equity</h2>
          <p className="text-xs text-fg-3">
            Emita ou conecte um SPL Token para representar participação da empresa.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-line">
          {(["import", "create"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-mono transition-colors ${
                tab === t ? "text-fg border-b-2 border-accent -mb-px" : "text-fg-3 hover:text-fg"
              }`}
            >
              {t === "import" ? "Importar token existente" : "Criar novo token"}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "import"
            ? <ImportTab onSuccess={onSuccess} />
            : <CreateTab onSuccess={onSuccess} />
          }
        </div>
      </div>

      {/* Phase context */}
      <div className="mt-4 rounded-xl border border-line bg-bg-1 p-4">
        <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider mb-2">
          Jornada da empresa
        </div>
        <div className="flex items-center gap-2 text-xs overflow-x-auto">
          {[
            { label: "Tesouraria", active: true },
            { label: "Equity Token", active: true, current: true },
            { label: "Investidor Anjo", active: false },
            { label: "Token IPO", active: false },
            { label: "Mercado Aberto", active: false },
          ].map((step, i, arr) => (
            <div key={step.label} className="flex items-center gap-2 shrink-0">
              <div className={`px-2 py-1 rounded font-mono text-[10px] ${
                step.current ? "bg-accent text-bg-0 font-semibold" :
                step.active ? "bg-bg-2 text-fg-2" : "bg-bg-2 text-fg-3 opacity-50"
              }`}>
                {step.label}
              </div>
              {i < arr.length - 1 && <span className="text-fg-3">→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
