"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  SolanaProvider,
  SolanaContextProvider,
  useSolana,
} from "@/lib/solana/wallet";

// ── API helper ────────────────────────────────────────────────────────────────

async function callSetup(
  action: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; orgId?: string; error?: string }> {
  const res = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepDots({ current }: { current: number }) {
  const t = useTranslations("onboarding");
  const stepLabels = [
    t("step_labels.org" as never),
    t("step_labels.wallet" as never),
    t("step_labels.policy" as never),
    t("step_labels.buckets" as never),
  ];

  return (
    <div className="flex items-start mb-8">
      {stepLabels.map((label, i) => (
        <div key={i} className={`flex items-start ${i < stepLabels.length - 1 ? "flex-1" : ""}`}>
          <div className="flex flex-col items-center gap-1 shrink-0">
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
              className={`text-xs font-mono text-center leading-tight transition-colors ${
                i === current ? "text-fg" : i < current ? "text-fg-3" : "text-fg-3/40"
              }`}
            >
              {label}
            </span>
          </div>
          {i < stepLabels.length - 1 && (
            <div className={`flex-1 h-px mt-3 mx-1.5 ${i < current ? "bg-accent" : "bg-line"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 1: Org ───────────────────────────────────────────────────────────────

function StepOrg({ onComplete }: { onComplete: (orgId: string) => void }) {
  const t = useTranslations("onboarding");
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<"startup" | "dao" | "fund">("startup");
  const [burnUsd, setBurnUsd] = useState("");
  const [simulated, setSimulated] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const PROFILES = [
    { value: "startup", label: t("profiles.startup" as never) },
    { value: "dao", label: t("profiles.dao" as never) },
    { value: "fund", label: t("profiles.fund" as never) },
  ] as const;

  async function handleSubmit() {
    if (!name.trim()) return setError(t("name_required" as never));
    setError(null);
    setIsPending(true);
    try {
      const result = await callSetup("createOrg", {
        name: name.trim(),
        profile,
        monthlyBurnUsd: Number(burnUsd) || 0,
        simulatedMode: simulated,
      });
      if (!result.ok) setError(result.error ?? t("error_create_org" as never));
      else onComplete(result.orgId!);
    } catch {
      setError(t("error_connection" as never));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-mono text-fg-3 uppercase tracking-wider mb-1.5">
          {t("org_name_label" as never)}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("org_name_placeholder" as never)}
          className="w-full rounded-lg border border-line bg-bg-2 px-3 py-2.5 text-sm text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 transition-all"
        />
      </div>

      <div>
        <label className="block text-xs font-mono text-fg-3 uppercase tracking-wider mb-1.5">
          {t("profile_label" as never)}
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
          {t("monthly_burn_label" as never)}
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
          <div className="text-sm text-fg">{t("simulated_mode_label" as never)}</div>
          <div className="text-xs text-fg-3">{t("simulated_mode_desc" as never)}</div>
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
        {isPending ? t("creating" as never) : t("continue" as never)}
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
  const t = useTranslations("onboarding");
  const { publicKey, connected, connecting, connect, signInWithSolana } = useSolana();
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSign() {
    if (!connected) return;
    setStatus("signing");
    setError(null);

    const nonce = crypto.randomUUID();
    const result = await signInWithSolana(nonce);
    if (!result) {
      setStatus("error");
      setError(t("signature_cancelled" as never));
      return;
    }

    setIsPending(true);
    try {
      const res = await callSetup("linkWallet", {
        address: result.address,
        signature: result.signature,
        message: result.message,
        orgId,
      });
      if (!res.ok) {
        setStatus("error");
        setError(res.error ?? t("error_link_wallet" as never));
      } else {
        setStatus("done");
        setTimeout(onComplete, 600);
      }
    } catch {
      setStatus("error");
      setError(t("error_connection" as never));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-fg-2">{t("wallet_desc" as never)}</p>

      {!connected ? (
        <button
          onClick={connect}
          disabled={connecting}
          className="w-full py-2.5 rounded-lg border border-line text-sm text-fg hover:border-accent/50 hover:bg-accent/5 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
        >
          <PhantomIcon />
          {connecting ? t("connecting" as never) : t("connect_wallet" as never)}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-xs font-mono text-fg-2 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent" />
            {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-6)}
          </div>

          {status === "done" ? (
            <div className="text-center text-sm text-accent font-mono">{t("wallet_linked" as never)}</div>
          ) : (
            <button
              onClick={handleSign}
              disabled={status === "signing" || isPending}
              className="w-full py-2.5 rounded-lg bg-accent text-bg-0 text-sm font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {status === "signing" || isPending ? t("signing" as never) : t("sign_btn" as never)}
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-neg">{error}</p>}

      <button
        onClick={onSkip}
        className="w-full py-2 text-xs text-fg-3 hover:text-fg transition-colors"
      >
        {t("skip_now" as never)}
      </button>
    </div>
  );
}

function StepWallet(props: { orgId: string; onComplete: () => void; onSkip: () => void }) {
  return <StepWalletInner {...props} />;
}

// ── Step 3: Policy ────────────────────────────────────────────────────────────

const PRESET_COLORS = {
  conservative: { color: "border-blue-400 text-blue-400", bg: "bg-blue-400/5", emoji: "🛡️" },
  balanced:     { color: "border-accent text-accent",     bg: "bg-accent/5",    emoji: "⚖️" },
  aggressive:   { color: "border-purple-400 text-purple-400", bg: "bg-purple-400/5", emoji: "🚀" },
} as const;

function StepPolicy({
  orgId,
  onComplete,
}: {
  orgId: string;
  onComplete: () => void;
}) {
  const t = useTranslations("onboarding");
  const [selected, setSelected] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const PRESETS = (["conservative", "balanced", "aggressive"] as const).map((key) => ({
    value: key,
    label: t(`presets.${key}.label` as never),
    desc: t(`presets.${key}.desc` as never),
    ...PRESET_COLORS[key],
  }));

  async function handleSubmit() {
    setError(null);
    setIsPending(true);
    try {
      const result = await callSetup("setOrgPreset", { orgId, preset: selected });
      if (!result.ok) setError(result.error ?? t("error_set_policy" as never));
      else onComplete();
    } catch {
      setError(t("error_connection" as never));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-2">{t("policy_desc" as never)}</p>

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
        {isPending ? t("saving" as never) : t("continue" as never)}
      </button>
    </div>
  );
}

// ── Step 4: Buckets ───────────────────────────────────────────────────────────

const BUCKET_KEYS = ["operating", "payroll", "tax", "emergency", "yield"] as const;

function StepBuckets({ orgId }: { orgId: string }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(BUCKET_KEYS.map((b) => [b, ""]))
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const bucketKinds = BUCKET_KEYS.map((key) => ({
    kind: key,
    label: t(`bucket_kinds.${key}.label` as never),
    desc: t(`bucket_kinds.${key}.desc` as never),
  }));

  async function handleFinish() {
    setError(null);
    setIsPending(true);
    try {
      const targets = bucketKinds.map((b) => ({
        kind: b.kind,
        amountCents: Math.round((Number(amounts[b.kind]) || 0) * 100),
      }));
      const result = await callSetup("updateBucketTargets", { orgId, targets });
      if (!result.ok) setError(result.error ?? t("error_save_buckets" as never));
      else router.push("/dashboard");
    } catch {
      setError(t("error_connection" as never));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-2">{t("buckets_desc" as never)}</p>

      <div className="space-y-3">
        {bucketKinds.map((b) => (
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
        {isPending ? t("saving" as never) : t("go_to_dashboard" as never)}
      </button>

      <button
        onClick={() => router.push("/dashboard")}
        className="w-full py-2 text-xs text-fg-3 hover:text-fg transition-colors"
      >
        {t("skip_targets" as never)}
      </button>
    </div>
  );
}

// ── Wizard shell ──────────────────────────────────────────────────────────────

function WizardInner() {
  const t = useTranslations("onboarding");
  const [step, setStep] = useState(0);
  const [orgId, setOrgId] = useState<string | null>(null);

  const TITLES = [
    t("step1_title" as never),
    t("step2_title" as never),
    t("step3_title" as never),
    t("step4_title" as never),
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / branding */}
        <div className="text-center mb-8">
          <div className="text-xs font-mono text-fg-3 uppercase tracking-widest mb-1">
            TreasuryOS
          </div>
          <div className="text-xs text-fg-3">{t("initial_setup" as never)}</div>
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
