"use client";

import { useState, useEffect } from "react";

const STEPS = [
  {
    title: "Bem-vindo ao TreasuryOS",
    body: "Este é o cockpit. Cada bloco aqui responde uma pergunta: quanto tem, por quanto tempo dura, o que está rendendo e onde há risco. Vamos passar por cada parte da plataforma em 60 segundos.",
  },
  {
    title: "KPIs · 8 números essenciais",
    body: 'Total de caixa, runway (quantos meses sua empresa opera com o que tem), runway protegido (quanto está fora de risco), capital alocado, yield estimado, próximas obrigações, concentração e compliance da política. Passe o mouse no "?" para entender cada termo.',
  },
  {
    title: "Policy Engine · regras da casa",
    body: "Aqui você define a política da tesouraria: runway mínimo, concentração máxima, whitelist de protocolos. A IA propõe; estas regras determinísticas validam antes de virar transação onchain.",
  },
  {
    title: "AI Copilot · seu advisor financeiro",
    body: "O Copilot analisa sua tesouraria, propõe alocações que respeitam a política e explica o raciocínio. Cada recomendação vira um intent que pode ser aprovado e executado onchain.",
  },
  {
    title: "Simulador · antes de executar",
    body: "Simule qualquer alocação antes de confirmar. Veja o impacto no runway, yield e compliance da política. Só siga para execução quando os números fizerem sentido.",
  },
  {
    title: "Execução · do intent à blockchain",
    body: "Intents aprovados viram transações Solana. Depósitos em Kamino e Ondo, retiradas, rebalanceamentos — tudo auditável e rastreável com hash onchain.",
  },
  {
    title: "Buckets · categorias de caixa",
    body: "Separe seu caixa em categorias: Operacional, Folha, Impostos, Reserva e Excedente. Só o excedente é alocado em yield. O restante fica protegido conforme a política.",
  },
  {
    title: "Equity Studio · distribuição para holders",
    body: "Distribua dividendos em USDC para holders do token da empresa. Configure snapshots de holders, valores e datas. Tudo onchain e auditável.",
  },
];

const STORAGE_KEY = "treasury-os-tour-done";

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

export function TourOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isOpen) setStep(0);
  }, [isOpen]);

  if (!isOpen) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const total = STEPS.length;

  function handleNext() {
    if (isLast) {
      localStorage.setItem(STORAGE_KEY, "1");
      onClose();
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  function handleSkip() {
    localStorage.setItem(STORAGE_KEY, "1");
    onClose();
  }

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ top: "72px", left: "220px" }}
    >
      <div className="pointer-events-auto w-[360px] rounded-xl border-2 border-accent bg-bg-1 shadow-2xl shadow-black/60 p-5">
        {/* Step header */}
        <div className="text-[10px] font-mono text-accent tracking-widest uppercase mb-2">
          Tour · {step + 1} / {total}
        </div>

        {/* Content */}
        <h3 className="text-sm font-bold text-fg mb-2">{current.title}</h3>
        <p className="text-xs text-fg-2 leading-relaxed mb-4">{current.body}</p>

        {/* Progress bar */}
        <div className="flex gap-1 mb-4">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex-1 h-1 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-line"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
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
                className="text-[11px] text-fg-3 border border-line px-3 py-1.5 rounded-lg hover:border-fg-3 transition-all"
              >
                Voltar
              </button>
            )}
            <button
              onClick={handleNext}
              className="text-[11px] font-medium border border-accent/50 bg-accent/10 text-accent px-4 py-1.5 rounded-lg hover:bg-accent/20 transition-all"
            >
              {isLast ? "Concluir" : "Próximo →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Tour({ autoStart = false }: { autoStart?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (autoStart && typeof window !== "undefined") {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) setOpen(true);
    }
  }, [autoStart]);

  return (
    <>
      <TourButton onOpen={() => setOpen(true)} />
      <TourOverlay isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
