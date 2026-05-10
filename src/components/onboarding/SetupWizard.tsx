"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  SolanaProvider,
  SolanaContextProvider,
  useSolana,
} from "@/lib/solana/wallet";
import {
  createOrg,
  linkWallet,
  setOrgPreset,
  updateBucketTargets,
} from "@/app/(onboarding)/setup/actions";

// ── Step indicator ────────────────────────────────────────────────────────────

const STEP_LABELS = ["Organização", "Wallet", "Política", "Buckets"];

function StepDots({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono font-semibold transition-all ${
              i < current
                ? "bg-accent text-bg-0"
                : i === current
                ? "border-2 border-accent text-accent"
                : "border border-line text-fg-3"
            }`}
          >
            {i < current ? "✓" : i + 1}
          </div>
          <span
            className={`text-xs font-mono transition-colors ${
              i === current ? "text-fg" : "text-fg-3"
            }`}
          >
            {label}
          </span>
          {i < STEP_LABELS.length - 1 && (
            <div className={`h-px w-8 ${i < current ? "bg-accent" : "bg-line"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Org ───────────────────────────────────────────────────────────────

function StepOrg({ onComplete }: { onComplete: (orgId: string) => void }) {
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<"startup" | "dao" | "fund">("startup");
  const [burnUsd, setBurnUsd] = useState("");
  const [simulated, setSimulated] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const PROFILES = [
    { value: "startup", label: "Startup" },
    { value: "dao", label: "DAO" },
    { value: "fund", label: "Fundo" },
  ] as const;

  function handleSubmit() {
    if (!name.trim()) return setError("Nome é obrigatório.");
    setError(null);
    startTransition(async () => {
      const result = await createOrg({
        name: name.trim(),
        profile,
        monthlyBurnUsd: Number(burnUsd) || 0,
        simulatedMode: simulated,
      });
      if (!result.ok) return setError(result.error ?? "Erro ao criar org.");
      onComplete(result.orgId!);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-mono text-fg-3 uppercase tracking-wider mb-1.5">
          Nome da organização
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Capivara Labs"
          className="w-full rounded-lg border border-line bg-bg-2 px-3 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-fg-3 uppercase tracking-wider mb-1.5">
          Perfil
        </label>
        <div className="flex gap-2">
          {PROFILES.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setProfile(p.value)}
              className={`flex-1 py-2 rounded-lg border text-sm font-mono transition-all ${
                profile === p.value
                  ? "border-accent text-accent bg-accent/5"
                  : "border-line text-fg-3 hover:border-fg-3 hover:text-fg"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-mono text-fg-3 uppercase tracking-wider mb-1.5">
          Queima mensal (USD)
        </label>
        <input
          type="number"
          value={burnUsd}
          onChange={(e) => setBurnUsd(e.target.value)}
          placeholder="50000"
          min="0"
          className="w-full rounded-lg border border-line bg-bg-2 px-3 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all"
        />
      </div>

      <div className="flex items-center justify-between py-2">
        <div>
          <div className="text-sm text-fg">Modo simulado</div>
          <div className="text-xs text-fg-3">Transações simuladas, sem carteira real</div>
        </div>
        <button
          type="button"
          onClick={() => setSimulated((v) => !v)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            simulated ? "bg-accent" : "bg-line"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-bg-0 transition-transform ${
              simulated ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {error && <p className="text-xs text-neg">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending || !name.trim()}
        className="w-full py-2.5 rounded-lg bg-accent text-bg-0 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? "Criando…" : "Continuar →"}
      </button>
    </div>
  );
}

// ── Step 2: Wallet ────────────────────────────────────────────────────────────

function StepWalletInner({
  orgId,
  onComplete,
  onSkip,
}: {
  orgId: string;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const { publicKey, connected, connecting, connect, signInWithSolana } = useSolana();
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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

    startTransition(async () => {
      const res = await linkWallet({
        address: result.address,
        signature: result.signature,
        message: result.message,
        orgId,
      });
      if (!res.ok) {
        setStatus("error");
        setError(res.error ?? "Falha ao vincular wallet.");
      } else {
        setStatus("done");
        setTimeout(onComplete, 600);
      }
    });
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-fg-2">
        Conecte seu Phantom para assinar transações na Solana devnet. Você pode pular e configurar depois.
      </p>

      {!connected ? (
        <button
          onClick={connect}
          disabled={connecting}
          className="w-full py-2.5 rounded-lg border border-line text-sm text-fg hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          <PhantomIcon />
          {connecting ? "Conectando…" : "Conectar Phantom"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-xs font-mono text-fg-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent" />
            {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-6)}
          </div>

          {status === "done" ? (
            <div className="text-center text-sm text-accent font-mono">Wallet vinculada ✓</div>
          ) : (
            <button
              onClick={handleSign}
              disabled={status === "signing" || isPending}
              className="w-full py-2.5 rounded-lg bg-accent text-bg-0 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {status === "signing" || isPending ? "Assinando…" : "Assinar com Phantom →"}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-neg">{error}</p>}

      <button
        onClick={onSkip}
        className="w-full py-2 text-xs text-fg-3 hover:text-fg transition-colors"
      >
        Pular por agora
      </button>
    </div>
  );
}

function StepWallet(props: { orgId: string; onComplete: () => void; onSkip: () => void }) {
  return <StepWalletInner {...props} />;
}

// ── Step 3: Policy ────────────────────────────────────────────────────────────

const PRESETS = [
  {
    value: "conservative",
    label: "Conservador",
    emoji: "🛡️",
    desc: "120 dias de runway · concentração ≤ 30% · somente Kamino",
    color: "border-blue-400 text-blue-400",
    bg: "bg-blue-400/5",
  },
  {
    value: "balanced",
    label: "Equilibrado",
    emoji: "⚖️",
    desc: "90 dias de runway · concentração ≤ 45% · Kamino + RWA",
    color: "border-accent text-accent",
    bg: "bg-accent/5",
  },
  {
    value: "aggressive",
    label: "Agressivo",
    emoji: "🚀",
    desc: "60 dias de runway · concentração ≤ 60% · qualquer protocolo",
    color: "border-purple-400 text-purple-400",
    bg: "bg-purple-400/5",
  },
] as const;

function StepPolicy({
  orgId,
  onComplete,
}: {
  orgId: string;
  onComplete: () => void;
}) {
  const [selected, setSelected] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await setOrgPreset(orgId, selected);
      if (!result.ok) return setError(result.error ?? "Erro ao definir política.");
      onComplete();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-2">Escolha o perfil de risco da sua tesouraria.</p>

      <div className="space-y-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setSelected(p.value)}
            className={`w-full text-left rounded-xl border p-4 transition-all ${
              selected === p.value
                ? `${p.color} ${p.bg}`
                : "border-line hover:border-fg-3"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{p.emoji}</span>
              <span
                className={`text-sm font-semibold ${
                  selected === p.value ? p.color.split(" ")[1] : "text-fg"
                }`}
              >
                {p.label}
              </span>
            </div>
            <div className="text-xs text-fg-3">{p.desc}</div>
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-neg">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={isPending}
        className="w-full py-2.5 rounded-lg bg-accent text-bg-0 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? "Salvando…" : "Continuar →"}
      </button>
    </div>
  );
}

// ── Step 4: Buckets ───────────────────────────────────────────────────────────

const BUCKET_KINDS = [
  { kind: "operating", label: "Operacional", desc: "Gastos do dia a dia" },
  { kind: "payroll", label: "Folha", desc: "Salários e benefícios" },
  { kind: "tax", label: "Impostos", desc: "Tributos e obrigações fiscais" },
  { kind: "emergency", label: "Reserva", desc: "Buffer de segurança" },
  { kind: "yield", label: "Excedente", desc: "Capital para alocação em yield" },
];

function StepBuckets({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(BUCKET_KINDS.map((b) => [b.kind, ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFinish() {
    setError(null);
    startTransition(async () => {
      const targets = BUCKET_KINDS.map((b) => ({
        kind: b.kind,
        amountCents: Math.round((Number(amounts[b.kind]) || 0) * 100),
      }));
      const result = await updateBucketTargets(orgId, targets);
      if (!result.ok) return setError(result.error ?? "Erro ao salvar.");
      router.push("/dashboard");
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-2">
        Defina quanto quer reservar em cada bucket. Pode ajustar depois.
      </p>

      <div className="space-y-3">
        {BUCKET_KINDS.map((b) => (
          <div key={b.kind} className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-fg">{b.label}</div>
              <div className="text-xs text-fg-3">{b.desc}</div>
            </div>
            <div className="relative w-36 shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-fg-3 font-mono">
                $
              </span>
              <input
                type="number"
                value={amounts[b.kind]}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [b.kind]: e.target.value }))
                }
                placeholder="0"
                min="0"
                className="w-full rounded-lg border border-line bg-bg-2 pl-6 pr-3 py-2 text-sm text-fg text-right font-mono placeholder:text-fg-3 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-neg">{error}</p>}

      <button
        onClick={handleFinish}
        disabled={isPending}
        className="w-full py-2.5 rounded-lg bg-accent text-bg-0 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
      >
        {isPending ? "Salvando…" : "Acessar dashboard →"}
      </button>

      <button
        onClick={() => router.push("/dashboard")}
        className="w-full py-2 text-xs text-fg-3 hover:text-fg transition-colors"
      >
        Pular configuração de targets
      </button>
    </div>
  );
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

function WizardInner() {
  const [step, setStep] = useState(0);
  const [orgId, setOrgId] = useState<string | null>(null);

  const TITLES = [
    "Crie sua organização",
    "Conecte sua wallet",
    "Escolha sua política",
    "Configure os buckets",
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="text-xs font-mono text-fg-3 uppercase tracking-widest mb-1">
            TreasuryOS
          </div>
          <div className="text-xs text-fg-3">Configuração inicial</div>
        </div>

        <div className="rounded-2xl border border-line bg-bg-1 p-6 shadow-lg shadow-bg-0/40">
          <StepDots current={step} />

          <h2 className="text-lg font-semibold text-fg mb-1">{TITLES[step]}</h2>
          <div className="h-px bg-line mb-5" />

          {step === 0 && (
            <StepOrg
              onComplete={(id) => {
                setOrgId(id);
                setStep(1);
              }}
            />
          )}
          {step === 1 && orgId && (
            <StepWallet
              orgId={orgId}
              onComplete={() => setStep(2)}
              onSkip={() => setStep(2)}
            />
          )}
          {step === 2 && orgId && (
            <StepPolicy orgId={orgId} onComplete={() => setStep(3)} />
          )}
          {step === 3 && orgId && <StepBuckets orgId={orgId} />}
        </div>
      </div>
    </div>
  );
}

// ── Phantom icon ──────────────────────────────────────────────────────────────

function PhantomIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 128 128" fill="none">
      <rect width="128" height="128" rx="32" fill="#AB9FF2" />
      <path
        d="M110 64c0 25.405-20.595 46-46 46S18 89.405 18 64 38.595 18 64 18s46 20.595 46 46z"
        fill="#fff"
        fillOpacity=".15"
      />
      <path
        d="M64 40c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24z"
        fill="#fff"
      />
    </svg>
  );
}

// ── Exported component (wraps Solana providers) ───────────────────────────────

export function SetupWizard() {
  return (
    <SolanaProvider>
      <SolanaContextProvider>
        <WizardInner />
      </SolanaContextProvider>
    </SolanaProvider>
  );
}
