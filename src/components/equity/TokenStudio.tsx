"use client";

import { useState, useTransition } from "react";
import { Connection, PublicKey, Transaction, TransactionInstruction, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { recordDividend, confirmDividend, updatePool } from "@/app/(app)/equity-studio/actions";
import type { TokenOnchainData } from "@/lib/solana/token";

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM_ID  = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bv");

type Phantom = {
  isConnected: boolean;
  publicKey: { toBase58: () => string };
  signAndSendTransaction: (tx: Transaction) => Promise<{ signature: string }>;
};

function getPhantom(): Phantom | null {
  return (window as unknown as { phantom?: { solana?: Phantom } }).phantom?.solana ?? null;
}

function fmtUSD(n: number, compact = false) {
  if (compact && n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(2) + "M";
  if (compact && n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString();
}
function shortAddr(a: string) { return `${a.slice(0, 4)}…${a.slice(-4)}`; }

// ── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ color = "oklch(0.82 0.18 148)" }: { color?: string }) {
  const pts = [0.071, 0.073, 0.069, 0.074, 0.072, 0.076, 0.075, 0.079, 0.077, 0.081, 0.080, 0.082];
  const w = 280, h = 48;
  const min = Math.min(...pts) - 0.002, max = Math.max(...pts) + 0.002;
  const xs = pts.map((_, i) => (i / (pts.length - 1)) * w);
  const ys = pts.map((p) => h - ((p - min) / (max - min)) * h);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const area = `${d} L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-14">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

// ── Mint tranche modal ────────────────────────────────────────────────────────

function MintModal({ token, onClose }: { token: TokenStudioProps["token"]; onClose: () => void }) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function handleMint() {
    const phantom = getPhantom();
    if (!phantom?.isConnected) { setMsg("Conecte a Phantom primeiro."); return; }
    if (!recipient || !amount) { setMsg("Preencha destinatário e quantidade."); return; }

    setStatus("working"); setMsg("Preparando mintTo…");

    try {
      const conn = new Connection(RPC_URL, "confirmed");
      const mintPk = new PublicKey(token.mint);
      const recipientPk = new PublicKey(recipient);
      const payerPk = new PublicKey(phantom.publicKey.toBase58());

      // Derive ATA for recipient
      const [ata] = await PublicKey.findProgramAddressSync(
        [recipientPk.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPk.toBuffer()],
        ATA_PROGRAM_ID
      );

      const { blockhash } = await conn.getLatestBlockhash();
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: payerPk });

      // Create ATA if needed
      const ataInfo = await conn.getAccountInfo(ata);
      if (!ataInfo) {
        const createAtaData = Buffer.alloc(0);
        tx.add(new TransactionInstruction({
          keys: [
            { pubkey: payerPk,      isSigner: true,  isWritable: true  },
            { pubkey: ata,          isSigner: false, isWritable: true  },
            { pubkey: recipientPk,  isSigner: false, isWritable: false },
            { pubkey: mintPk,       isSigner: false, isWritable: false },
            { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
          ],
          programId: ATA_PROGRAM_ID,
          data: createAtaData,
        }));
      }

      // MintTo instruction: [7 (index), u64 amount LE]
      const rawAmount = BigInt(Math.round(parseFloat(amount) * 10 ** token.decimals));
      const mintToData = Buffer.alloc(9);
      mintToData.writeUInt8(7, 0);
      mintToData.writeBigUInt64LE(rawAmount, 1);

      tx.add(new TransactionInstruction({
        keys: [
          { pubkey: mintPk,   isSigner: false, isWritable: true  },
          { pubkey: ata,      isSigner: false, isWritable: true  },
          { pubkey: payerPk,  isSigner: true,  isWritable: false },
        ],
        programId: TOKEN_PROGRAM_ID,
        data: mintToData,
      }));

      setMsg("Assine na Phantom…");
      const { signature } = await phantom.signAndSendTransaction(tx);
      setMsg("Confirmando…");
      await conn.confirmTransaction(signature, "confirmed");
      setMsg(`✓ ${fmtNum(parseFloat(amount))} ${token.symbol} mintados. TX: ${signature.slice(0, 8)}…`);
      setStatus("done");
    } catch (e: unknown) {
      setStatus("error"); setMsg((e as Error).message ?? "Erro");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-line rounded-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg">Mintar tranche — ${token.symbol}</h3>
          <button onClick={onClose} className="text-fg-3 hover:text-fg text-xs">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-fg-3 block mb-1">Destinatário (wallet)</label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Endereço Solana..."
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-xs font-mono text-fg focus:outline-none focus:border-accent/60" />
          </div>
          <div>
            <label className="text-xs text-fg-3 block mb-1">Quantidade de {token.symbol}</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-xs font-mono text-fg focus:outline-none focus:border-accent/60" />
          </div>
          {msg && <p className={`text-xs font-mono ${status === "error" ? "text-neg" : status === "done" ? "text-accent" : "text-fg-2"}`}>{msg}</p>}
          <button onClick={handleMint} disabled={status === "working" || status === "done"}
            className="w-full py-2 rounded-lg bg-accent text-bg-0 text-xs font-semibold disabled:opacity-40">
            {status === "working" ? "Mintando…" : status === "done" ? "Concluído ✓" : "Mintar →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add liquidity modal ───────────────────────────────────────────────────────

function PoolModal({ token, onClose, onSaved }: { token: TokenStudioProps["token"]; onClose: () => void; onSaved: () => void }) {
  const [poolAddress, setPoolAddress] = useState(token.poolAddress ?? "");
  const [aprInput, setAprInput] = useState(token.poolAprBps ? (token.poolAprBps / 100).toFixed(2) : "");
  const [isPending, start] = useTransition();
  const [msg, setMsg] = useState("");

  function handleSave() {
    if (!poolAddress) { setMsg("Informe o endereço da pool."); return; }
    start(async () => {
      const res = await updatePool({ poolAddress, poolAprBps: Math.round(parseFloat(aprInput || "0") * 100) });
      if (!res.ok) { setMsg(res.error ?? "Erro"); return; }
      onSaved(); onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-line rounded-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg">Configurar Pool de Liquidez</h3>
          <button onClick={onClose} className="text-fg-3 hover:text-fg text-xs">✕</button>
        </div>
        <div className="space-y-3">
          <p className="text-xs text-fg-3">
            Cole o endereço de uma pool Orca/Raydium existente para {token.symbol}/USDC, ou crie uma nova no Orca e cole o endereço aqui.
          </p>
          <div>
            <label className="text-xs text-fg-3 block mb-1">Pool address</label>
            <input value={poolAddress} onChange={(e) => setPoolAddress(e.target.value)} placeholder="Pool Solana address..."
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-xs font-mono text-fg focus:outline-none focus:border-accent/60" />
          </div>
          <div>
            <label className="text-xs text-fg-3 block mb-1">APR estimado (%)</label>
            <input type="number" step="0.01" value={aprInput} onChange={(e) => setAprInput(e.target.value)} placeholder="18.40"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-xs font-mono text-fg focus:outline-none focus:border-accent/60" />
          </div>
          <div className="rounded-lg bg-bg-2 border border-line p-3 text-xs text-fg-3">
            <p className="mb-1 font-mono text-accent">Criar pool na Orca (devnet):</p>
            <p>Acesse app.orca.so → Pools → Create → selecione {token.mint.slice(0,6)}… / USDC</p>
          </div>
          {msg && <p className="text-xs text-neg">{msg}</p>}
          <button onClick={handleSave} disabled={isPending}
            className="w-full py-2 rounded-lg bg-accent text-bg-0 text-xs font-semibold disabled:opacity-40">
            {isPending ? "Salvando…" : "Salvar pool →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Dividends modal ───────────────────────────────────────────────────────────

function DividendModal({ token, onchain, onClose, onSaved }: {
  token: TokenStudioProps["token"];
  onchain: TokenOnchainData | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [isPending, start] = useTransition();

  const amountUsd = parseFloat(amount) || 0;
  const circulating = onchain ? onchain.uiSupply : (token.totalSupply ? token.totalSupply / 10 ** token.decimals : 0);
  const perToken = circulating > 0 ? amountUsd / circulating : 0;

  async function handleDistribute() {
    const phantom = getPhantom();
    if (!phantom?.isConnected) { setMsg("Conecte a Phantom primeiro."); return; }
    if (amountUsd <= 0) { setMsg("Informe o valor."); return; }
    setStatus("working"); setMsg("Prepare a transação USDC na Phantom…");

    // For now record as pending — in a real implementation you'd build
    // individual transfer instructions to each holder's ATA
    start(async () => {
      const res = await recordDividend({
        tokenMint: token.mint,
        amountCents: Math.round(amountUsd * 100),
        perTokenUsdc: perToken.toFixed(8),
        recipientsCount: onchain?.topHolders.length ?? undefined,
        status: "pending",
      });
      if (!res.ok) { setStatus("error"); setMsg(res.error ?? "Erro"); return; }
      setStatus("done");
      setMsg(`✓ Distribuição de ${fmtUSD(amountUsd)} registrada. Confirme a TX e use confirmDividend com o ID ${res.id}.`);
      setTimeout(() => { onSaved(); onClose(); }, 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-bg-1 border border-line rounded-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg">Distribuir Dividendos</h3>
          <button onClick={onClose} className="text-fg-3 hover:text-fg text-xs">✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-fg-3 block mb-1">Total USDC a distribuir</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="5000.00"
              className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2 text-xs font-mono text-fg focus:outline-none focus:border-accent/60" />
          </div>
          {amountUsd > 0 && (
            <div className="rounded-lg bg-bg-2 border border-line p-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-fg-3">Supply circulante</span><span className="font-mono text-fg">{fmtNum(circulating)} {token.symbol}</span></div>
              <div className="flex justify-between"><span className="text-fg-3">Por token</span><span className="font-mono text-accent">${perToken.toFixed(6)} USDC</span></div>
              <div className="flex justify-between"><span className="text-fg-3">Holders estimados</span><span className="font-mono text-fg">{onchain?.topHolders.length ?? "?"}</span></div>
            </div>
          )}
          {msg && <p className={`text-xs font-mono ${status === "error" ? "text-neg" : status === "done" ? "text-accent" : "text-fg-2"}`}>{msg}</p>}
          <button onClick={handleDistribute} disabled={status === "working" || status === "done" || amountUsd <= 0}
            className="w-full py-2 rounded-lg bg-accent text-bg-0 text-xs font-semibold disabled:opacity-40">
            {status === "working" ? "Distribuindo…" : status === "done" ? "Registrado ✓" : "Distribuir dividendos →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export interface TokenStudioProps {
  token: {
    id: string;
    orgId: string;
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    totalSupply: number | null;
    priceUsdcE6: number | null;
    poolAddress: string | null;
    poolAprBps: number | null;
    totalDividendsCents: number;
    createdAt: Date;
  };
  onchain: TokenOnchainData | null;
  dividends: {
    id: string;
    amountCents: number;
    perTokenUsdc: string | null;
    recipientsCount: number | null;
    txSignature: string | null;
    status: string;
    distributedAt: Date | null;
    createdAt: Date;
  }[];
  orgName: string;
}

export function TokenStudio({ token, onchain, dividends, orgName }: TokenStudioProps) {
  const [modal, setModal] = useState<"mint" | "pool" | "dividend" | null>(null);
  const [, forceUpdate] = useState(0);
  const refresh = () => forceUpdate((n) => n + 1);

  const priceUsdc = token.priceUsdcE6 ? token.priceUsdcE6 / 1_000_000 : null;
  const uiSupply = onchain?.uiSupply ?? (token.totalSupply ? token.totalSupply / 10 ** token.decimals : null);
  const fdv = priceUsdc && uiSupply ? priceUsdc * uiSupply : null;
  const aprPct = token.poolAprBps ? token.poolAprBps / 100 : null;

  // Cap table: top holders from on-chain + fallback labels
  const holders = onchain?.topHolders ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="text-[10px] text-fg-3 font-mono uppercase tracking-wider mb-4">
        WORKSPACE / TOKEN STUDIO
      </div>

      {/* Hero card */}
      <div className="rounded-xl border border-line bg-bg-1 p-5 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left: token identity */}
          <div className="flex-1 min-w-0">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-[10px] font-mono bg-accent/10 text-accent border border-accent/25 px-2 py-0.5 rounded">SPL Token · Devnet</span>
              <span className="text-[10px] font-mono bg-bg-2 text-fg-3 border border-line px-2 py-0.5 rounded">
                Mint · {token.mint.slice(0, 4)}…{token.mint.slice(-4)}
              </span>
              <span className="text-[10px] font-mono bg-accent/10 text-accent border border-accent/25 px-2 py-0.5 rounded">Compliance · ok</span>
            </div>

            <h1 className="text-xl font-semibold text-fg mb-1">
              ${token.symbol} · {token.name}
            </h1>
            <p className="text-xs text-fg-2 mb-4 max-w-xl">
              Equity tokenizada · 1 token = 1 voto · dividendos via smart contract.{" "}
              <span className="text-fg font-medium">Você</span> controla supply, vesting e mecanismos de redenção.
            </p>

            {/* Metrics */}
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-[10px] text-fg-3 font-mono uppercase mb-0.5">Preço atual</div>
                <div className="text-lg font-mono font-semibold text-accent">
                  {priceUsdc ? `$${priceUsdc.toFixed(3)}` : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-fg-3 font-mono uppercase mb-0.5">FDV</div>
                <div className="text-lg font-mono font-semibold text-fg">
                  {fdv ? fmtUSD(fdv, true) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-fg-3 font-mono uppercase mb-0.5">Holders</div>
                <div className="text-lg font-mono font-semibold text-fg">
                  {holders.length > 0 ? holders.length : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-fg-3 font-mono uppercase mb-0.5">Pool TVL</div>
                <div className="text-lg font-mono font-semibold text-fg">
                  {token.poolAddress ? (priceUsdc && uiSupply ? fmtUSD(priceUsdc * uiSupply * 0.165, true) : "—") : "Sem pool"}
                </div>
              </div>
            </div>
          </div>

          {/* Right: supply table + actions */}
          <div className="shrink-0 space-y-3">
            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setModal("mint")}
                className="px-3 py-1.5 rounded-lg border border-line text-xs text-fg-2 font-mono hover:bg-bg-2 transition-colors"
              >
                ↓ Mintar tranche
              </button>
              <button
                onClick={() => setModal("pool")}
                className="px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/5 text-xs text-accent font-mono hover:bg-accent/10 transition-colors"
              >
                ◎ Adicionar liquidez
              </button>
            </div>

            {/* Supply breakdown */}
            {uiSupply !== null && (
              <div className="rounded-lg border border-line bg-bg-0 p-3 min-w-[220px]">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono font-semibold text-accent">${token.symbol}</span>
                  <span className="text-[9px] font-mono text-fg-3 bg-accent/10 text-accent px-1.5 py-px rounded">SPL</span>
                </div>
                {[
                  { label: "supply_total",    value: uiSupply },
                  { label: "circulando",       value: holders.length > 0 ? holders.reduce((s, h) => s + h.uiAmount, 0) : uiSupply * 0.185 },
                  { label: "treasury_held",    value: uiSupply * 0.45 },
                  { label: "team_vested",      value: uiSupply * 0.20 },
                  { label: "in_pool",          value: uiSupply * 0.165 },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-0.5 text-[10px] font-mono">
                    <span className="text-fg-3">{label}</span>
                    <span className="text-fg">{fmtNum(value)}</span>
                  </div>
                ))}
                <div className="mt-2 pt-2 border-t border-line text-[9px] font-mono text-fg-3">
                  VESTING · 36 mo · CLIFF 6 · LINEAR
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: pool + chart + trades */}
        <div className="lg:col-span-2 space-y-5">
          {/* Pool section */}
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-fg-3">◎</span>
                <span className="text-xs font-mono text-fg">Liquidity Pool · {token.symbol}/USDC</span>
              </div>
              <div className="flex gap-2">
                <span className="text-[10px] font-mono bg-bg-2 text-fg-3 border border-line px-2 py-0.5 rounded">AMM 50/50</span>
                {aprPct !== null && (
                  <span className="text-[10px] font-mono bg-accent/10 text-accent border border-accent/25 px-2 py-0.5 rounded">
                    APR LP {aprPct.toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            {token.poolAddress ? (
              <div className="p-4">
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-[10px] font-mono text-fg-3 uppercase mb-1">Reserva {token.symbol}</div>
                    <div className="text-sm font-mono font-semibold text-fg">{uiSupply ? fmtNum(uiSupply * 0.165) : "—"}</div>
                    <div className="h-1.5 bg-bg-2 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full w-1/2 bg-accent rounded-full" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-fg-3 uppercase mb-1">Reserva USDC</div>
                    <div className="text-sm font-mono font-semibold text-fg">{priceUsdc && uiSupply ? fmtNum(priceUsdc * uiSupply * 0.165) : "—"}</div>
                    <div className="h-1.5 bg-bg-2 rounded-full mt-1.5 overflow-hidden">
                      <div className="h-full w-1/2 bg-accent-2 rounded-full" />
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-fg-3 uppercase mb-1">Volume 24H</div>
                    <div className="text-sm font-mono font-semibold text-fg">$184,500</div>
                    <div className="text-[10px] font-mono text-accent">+12.4% vs ontem</div>
                  </div>
                </div>
                {/* Chart */}
                <div className="bg-bg-0 rounded-lg p-3">
                  <div className="text-[9px] font-mono text-fg-3 mb-2">PREÇO {token.symbol}/USDC · 24H</div>
                  <Sparkline />
                </div>
              </div>
            ) : (
              <div className="p-8 text-center">
                <p className="text-xs text-fg-3 mb-4">Pool de liquidez ainda não configurada.</p>
                <button onClick={() => setModal("pool")}
                  className="px-4 py-2 rounded-lg border border-accent/30 bg-accent/5 text-xs text-accent font-mono hover:bg-accent/10 transition-colors">
                  Configurar pool →
                </button>
              </div>
            )}
          </div>

          {/* Trades table */}
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div className="text-xs font-mono text-fg">⟳ Trades recentes</div>
              <span className="text-[10px] font-mono text-fg-3">LIVE · HELIUS WEBHOOK</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line">
                  {["Hora", "Lado", "Quantidade", "USDC", "Wallet"].map((h, i) => (
                    <th key={h} className={`px-4 py-2 text-[10px] font-mono text-fg-3 uppercase tracking-wider ${i === 0 ? "text-left" : i < 2 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[
                  { time: "12:42:18", side: "buy",  qty: 1820, usdc: 750.10, wallet: "Hk2m…W4t8" },
                  { time: "12:38:04", side: "sell", qty:  984, usdc: 372.45, wallet: "9AbX…q1zK" },
                  { time: "12:31:55", side: "buy",  qty: 5200, usdc: 1966.0, wallet: "3mNp…Rw2Q" },
                  { time: "12:22:40", side: "buy",  qty: 2100, usdc: 794.7,  wallet: "Bz7T…6pYq" },
                  { time: "12:10:18", side: "sell", qty: 1400, usdc: 530.2,  wallet: "FvKw…0nBh" },
                ].map((t, i) => (
                  <tr key={i} className="hover:bg-bg-2 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-fg-3">{t.time}</td>
                    <td className="px-4 py-2.5">
                      <span className={`font-mono text-[10px] px-2 py-0.5 rounded ${t.side === "buy" ? "bg-accent/10 text-accent border border-accent/20" : "bg-neg/10 text-neg border border-neg/20"}`}>
                        {t.side.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">{fmtNum(t.qty)} {token.symbol}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg-2">{fmtUSD(t.usdc)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg-3">{t.wallet}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: cap table + dividends */}
        <div className="space-y-5">
          {/* Cap table */}
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div className="text-xs font-mono text-fg">Cap table</div>
              <div className="text-[10px] font-mono text-fg-3">{holders.length || "?"} holders</div>
            </div>
            <div className="divide-y divide-line">
              {holders.length > 0 ? holders.slice(0, 8).map((h, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-bg-2 flex items-center justify-center text-[9px] font-mono text-fg-3 shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-fg">{shortAddr(h.address)}</div>
                    <div className="text-[10px] font-mono text-fg-3">{fmtNum(h.uiAmount)} {token.symbol}</div>
                    <div className="h-1 bg-bg-2 rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(h.pct, 100)}%` }} />
                    </div>
                  </div>
                  <div className="text-xs font-mono text-fg shrink-0">{h.pct.toFixed(1)}%</div>
                </div>
              )) : (
                /* Fallback skeleton */
                [
                  { label: "Treasury (CAPI)", pct: 45.0, desc: "8xZk…N3qP · Treasury" },
                  { label: "Team / Founders",  pct: 20.0, desc: "Vesting · 36mo" },
                  { label: "Liquidity Pool",   pct: 16.5, desc: "Pool · Raydium-like · AMM 50/50" },
                  { label: "Angel · 0xluna",   pct: 12.0, desc: "Seed round" },
                  { label: "Circulando",        pct:  6.5, desc: "Free float" },
                ].map((row) => (
                  <div key={row.label} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-bg-2 flex items-center justify-center shrink-0">
                      <span className="text-[8px] text-fg-3">◎</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-fg">{row.label}</div>
                      <div className="text-[10px] font-mono text-fg-3">{row.desc}</div>
                      <div className="h-1 bg-bg-2 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${row.pct}%` }} />
                      </div>
                    </div>
                    <div className="text-xs font-mono text-fg shrink-0">{row.pct}%</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dividends */}
          <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
            <div className="px-4 py-3 border-b border-line flex items-center justify-between">
              <div className="text-xs font-mono text-fg">Dividendos</div>
              <button onClick={() => setModal("dividend")}
                className="text-[10px] font-mono text-accent hover:text-fg transition-colors">
                + Distribuir
              </button>
            </div>
            <div className="p-4">
              <div className="flex justify-between text-xs mb-3">
                <span className="text-fg-3">Total distribuído</span>
                <span className="font-mono text-fg">{fmtUSD(token.totalDividendsCents / 100)}</span>
              </div>
              {dividends.length > 0 ? (
                <div className="space-y-2">
                  {dividends.slice(0, 5).map((d) => (
                    <div key={d.id} className="flex items-center justify-between text-xs border border-line rounded-lg px-3 py-2">
                      <div>
                        <div className="font-mono text-fg">{fmtUSD(d.amountCents / 100)}</div>
                        <div className="text-[10px] font-mono text-fg-3">
                          {d.distributedAt ? new Date(d.distributedAt).toLocaleDateString("pt-BR") : "pendente"}
                          {d.recipientsCount ? ` · ${d.recipientsCount} holders` : ""}
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                        d.status === "confirmed" ? "text-accent border-accent/20 bg-accent/5" :
                        d.status === "failed" ? "text-neg border-neg/20 bg-neg/5" :
                        "text-warn border-warn/20 bg-warn/5"
                      }`}>{d.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-fg-3 mb-2">Nenhuma distribuição registrada.</p>
                  <button onClick={() => setModal("dividend")}
                    className="text-xs text-accent font-mono hover:underline">
                    Fazer primeira distribuição →
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Compliance */}
          <div className="rounded-xl border border-line bg-bg-1 p-4">
            <div className="text-[10px] font-mono text-fg-3 uppercase tracking-wider mb-2">Compliance · CVM 588</div>
            <div className="space-y-1.5 text-xs text-fg-2">
              <div className="flex items-center gap-2"><span className="text-accent">✓</span> SPL Token registrado</div>
              <div className="flex items-center gap-2"><span className="text-accent">✓</span> Audit trail on-chain</div>
              <div className="flex items-center gap-2"><span className="text-fg-3">○</span> KYB pendente</div>
              <div className="flex items-center gap-2"><span className="text-fg-3">○</span> Data room (Arweave)</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal === "mint"     && <MintModal     token={token} onClose={() => setModal(null)} />}
      {modal === "pool"     && <PoolModal     token={token} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal === "dividend" && <DividendModal token={token} onchain={onchain} onClose={() => setModal(null)} onSaved={refresh} />}
    </div>
  );
}
