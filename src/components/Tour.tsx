"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

interface TourStep {
  href: string;
  label: string;
  icon: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "⬡",
    title: "Cockpit · visão geral do caixa",
    body: "Painel principal com o estado do caixa em tempo real: total, runway, capital alocado e score de compliance. Cada número responde uma pergunta crítica da tesouraria.",
  },
  {
    href: "/policy",
    label: "Policy Engine",
    icon: "⚖",
    title: "Policy Engine · as regras da casa",
    body: "Defina a política da tesouraria: runway mínimo, concentração máxima por protocolo e whitelist de ativos. A IA propõe; estas regras validam deterministicamente antes de qualquer execução.",
  },
  {
    href: "/copilot",
    label: "AI Copilot",
    icon: "✦",
    title: "AI Copilot · advisor financeiro",
    body: "O Copilot analisa o caixa, propõe alocações respeitando a política ativa e explica o raciocínio em linguagem natural. Cada recomendação vira um intent que você aprova.",
  },
  {
    href: "/simulator",
    label: "Simulador",
    icon: "◈",
    title: "Simulador · teste antes de executar",
    body: "Simule qualquer alocação antes de confirmar. Veja o impacto no runway, yield estimado e compliance da política. Só siga para execução quando os números fizerem sentido.",
  },
  {
    href: "/execution",
    label: "Execução",
    icon: "▶",
    title: "Execução · do intent à blockchain",
    body: "Intents aprovados viram transações Solana. Depósitos em protocolos de yield, retiradas e rebalanceamentos — tudo auditável com hash onchain e histórico completo.",
  },
  {
    href: "/equity-studio",
    label: "Equity Studio",
    icon: "◎",
    title: "Equity Studio · distribuição para holders",
    body: "Distribua dividendos em USDC para holders do token da empresa. Configure snapshots de holders, valores e datas de pagamento. Tudo onchain e auditável.",
  },
];

const STORAGE_KEY = "treasury-os-tour";

interface TourState {
  done: boolean;
  step: number;
}

function loadTourState(): TourState {
  if (typeof window === "undefined") return { done: false, step: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TourState;
  } catch {}
  return { done: false, step: 0 };
}

function saveTourState(state: TourState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function TourButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-[11px] font-mono text-fg-3 hover:text-fg hover:border-fg-3 transition-all"
    >
      <span className="text-xs">☆</span> Tour
    </button>
  );
}

export function Tour({ autoStart = false }: { autoStart?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [navigating, setNavigating] = useState(false);

  // Auto-start on first visit for demo users
  useEffect(() => {
    if (!autoStart) return;
    const state = loadTourState();
    if (!state.done) {
      setStep(state.step);
      setOpen(true);
      const targetHref = STEPS[state.step]?.href;
      if (targetHref && pathname !== targetHref) {
        setNavigating(true);
        router.push(targetHref);
      }
    }
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear navigating flag once we arrive at the target page
  useEffect(() => {
    if (navigating && pathname === STEPS[step]?.href) {
      setNavigating(false);
    }
  }, [pathname, navigating, step]);

  // Persist step whenever it changes while tour is open
  useEffect(() => {
    if (open) saveTourState({ done: false, step });
  }, [step, open]);

  function handleOpen() {
    const state = loadTourState();
    const resumeStep = state.done ? 0 : state.step;
    setStep(resumeStep);
    setOpen(true);
    const targetHref = STEPS[resumeStep]?.href;
    if (targetHref && pathname !== targetHref) {
      setNavigating(true);
      router.push(targetHref);
    }
  }

  function handleNext() {
    if (step === STEPS.length - 1) {
      handleFinish();
      return;
    }
    const nextStep = step + 1;
    setStep(nextStep);
    if (pathname !== STEPS[nextStep].href) {
      setNavigating(true);
      router.push(STEPS[nextStep].href);
    }
  }

  function handleBack() {
    if (step === 0) return;
    const prevStep = step - 1;
    setStep(prevStep);
    if (pathname !== STEPS[prevStep].href) {
      setNavigating(true);
      router.push(STEPS[prevStep].href);
    }
  }

  function handleFinish() {
    saveTourState({ done: true, step: 0 });
    setOpen(false);
  }

  function handleSkip() {
    saveTourState({ done: true, step: 0 });
    setOpen(false);
  }

  if (!open) {
    return <TourButton onOpen={handleOpen} />;
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const nextStep = STEPS[step + 1];

  return (
    <>
      <TourButton onOpen={handleOpen} />

      {/* Subtle backdrop — pointer-events-none so page stays interactive */}
      <div className="fixed inset-0 z-40 pointer-events-none bg-black/25" />

      {/* Tour card — fixed bottom-right, above backdrop */}
      <div className="fixed z-50 bottom-6 right-6 w-95 pointer-events-auto">
        <div className="rounded-xl border-2 border-accent bg-bg-1 shadow-2xl shadow-black/60 p-5">
          {/* Step header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono text-accent tracking-widest uppercase">
              Tour · {step + 1}/{STEPS.length}
            </span>
            <span className="text-[10px] text-fg-3">·</span>
            <span className="text-[10px] font-mono text-accent/80">
              {current.icon} {current.label}
            </span>
            {navigating && (
              <span className="ml-auto text-[10px] font-mono text-fg-3 animate-pulse">
                navegando…
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex gap-1 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < step ? "bg-accent/50" : i === step ? "bg-accent" : "bg-line"
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <h3 className="text-sm font-bold text-fg mb-2 leading-snug">{current.title}</h3>
          <p className="text-xs text-fg-2 leading-relaxed mb-4">{current.body}</p>

          {/* Page chips — shows overall journey */}
          <div className="flex flex-wrap gap-1 mb-5">
            {STEPS.map((s, i) => (
              <span
                key={i}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                  i === step
                    ? "bg-accent/15 text-accent border-accent/40"
                    : i < step
                    ? "bg-bg-2 text-fg-3 border-line"
                    : "text-fg-3/30 border-line/30"
                }`}
              >
                {s.icon} {s.label}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-[11px] text-fg-3 hover:text-fg transition-colors"
            >
              Pular tour
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={handleBack}
                  disabled={navigating}
                  className="text-[11px] text-fg-3 border border-line px-3 py-1.5 rounded-lg hover:border-fg-3 transition-all disabled:opacity-40"
                >
                  ← Voltar
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={navigating}
                className="text-[11px] font-medium border border-accent/50 bg-accent/10 text-accent px-4 py-1.5 rounded-lg hover:bg-accent/20 transition-all disabled:opacity-40"
              >
                {isLast
                  ? "Concluir ✓"
                  : navigating
                  ? "Navegando…"
                  : `${nextStep.icon} ${nextStep.label} →`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
