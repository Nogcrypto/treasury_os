"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

type StepKey = "dashboard" | "policy" | "copilot" | "simulator" | "execution" | "equity_studio";

const STEP_HREFS: Record<StepKey, string> = {
  dashboard: "/dashboard",
  policy: "/policy",
  copilot: "/copilot",
  simulator: "/simulator",
  execution: "/execution",
  equity_studio: "/equity-studio",
};

const STEP_KEYS: StepKey[] = ["dashboard", "policy", "copilot", "simulator", "execution", "equity_studio"];

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

export function TourButton({ onOpen, label }: { onOpen: () => void; label: string }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-line text-[11px] font-mono text-fg-3 hover:text-fg hover:border-fg-3 transition-all"
    >
      <span className="text-xs">☆</span> {label}
    </button>
  );
}

export function Tour({ autoStart = false }: { autoStart?: boolean }) {
  const t = useTranslations("tour");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [navigating, setNavigating] = useState(false);

  const currentKey = STEP_KEYS[step];
  const currentHref = STEP_HREFS[currentKey];

  // Auto-start on first visit for demo users
  useEffect(() => {
    if (!autoStart) return;
    const state = loadTourState();
    if (!state.done) {
      setStep(state.step);
      setOpen(true);
      const targetHref = STEP_HREFS[STEP_KEYS[state.step]];
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
    if (navigating && pathname === currentHref) {
      setNavigating(false);
    }
  }, [pathname, navigating, currentHref]);

  // Persist step whenever it changes while tour is open
  useEffect(() => {
    if (open) saveTourState({ done: false, step });
  }, [step, open]);

  function handleOpen() {
    const state = loadTourState();
    const resumeStep = state.done ? 0 : state.step;
    setStep(resumeStep);
    setOpen(true);
    const targetHref = STEP_HREFS[STEP_KEYS[resumeStep]];
    if (targetHref && pathname !== targetHref) {
      setNavigating(true);
      router.push(targetHref);
    }
  }

  function handleNext() {
    if (step === STEP_KEYS.length - 1) {
      handleFinish();
      return;
    }
    const nextStep = step + 1;
    setStep(nextStep);
    const nextHref = STEP_HREFS[STEP_KEYS[nextStep]];
    if (pathname !== nextHref) {
      setNavigating(true);
      router.push(nextHref);
    }
  }

  function handleBack() {
    if (step === 0) return;
    const prevStep = step - 1;
    setStep(prevStep);
    const prevHref = STEP_HREFS[STEP_KEYS[prevStep]];
    if (pathname !== prevHref) {
      setNavigating(true);
      router.push(prevHref);
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

  const tourBtnLabel = tNav("tour_btn");

  if (!open) {
    return <TourButton onOpen={handleOpen} label={tourBtnLabel} />;
  }

  const isLast = step === STEP_KEYS.length - 1;
  const nextKey = STEP_KEYS[step + 1];

  return (
    <>
      <TourButton onOpen={handleOpen} label={tourBtnLabel} />

      {/* Subtle backdrop — pointer-events-none so page stays interactive */}
      <div className="fixed inset-0 z-40 pointer-events-none bg-black/25" />

      {/* Tour card — fixed bottom-right, above backdrop */}
      <div className="fixed z-50 bottom-6 right-6 w-95 pointer-events-auto">
        <div className="rounded-xl border-2 border-accent bg-bg-1 shadow-2xl shadow-black/60 p-5">
          {/* Step header */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono text-accent tracking-widest uppercase">
              {t("label", { step: step + 1, total: STEP_KEYS.length })}
            </span>
            <span className="text-[10px] text-fg-3">·</span>
            <span className="text-[10px] font-mono text-accent/80">
              {t(`steps.${currentKey}.icon` as never)} {t(`steps.${currentKey}.label` as never)}
            </span>
            {navigating && (
              <span className="ml-auto text-[10px] font-mono text-fg-3 animate-pulse">
                {t("navigating")}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="flex gap-1 mb-4">
            {STEP_KEYS.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < step ? "bg-accent/50" : i === step ? "bg-accent" : "bg-line"
                }`}
              />
            ))}
          </div>

          {/* Content */}
          <h3 className="text-sm font-bold text-fg mb-2 leading-snug">
            {t(`steps.${currentKey}.title` as never)}
          </h3>
          <p className="text-xs text-fg-2 leading-relaxed mb-4">
            {t(`steps.${currentKey}.body` as never)}
          </p>

          {/* Page chips — shows overall journey */}
          <div className="flex flex-wrap gap-1 mb-5">
            {STEP_KEYS.map((key, i) => (
              <span
                key={key}
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                  i === step
                    ? "bg-accent/15 text-accent border-accent/40"
                    : i < step
                    ? "bg-bg-2 text-fg-3 border-line"
                    : "text-fg-3/30 border-line/30"
                }`}
              >
                {t(`steps.${key}.icon` as never)} {t(`steps.${key}.label` as never)}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-[11px] text-fg-3 hover:text-fg transition-colors"
            >
              {t("skip")}
            </button>
            <div className="flex gap-2">
              {step > 0 && (
                <button
                  onClick={handleBack}
                  disabled={navigating}
                  className="text-[11px] text-fg-3 border border-line px-3 py-1.5 rounded-lg hover:border-fg-3 transition-all disabled:opacity-40"
                >
                  {t("back")}
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={navigating}
                className="text-[11px] font-medium border border-accent/50 bg-accent/10 text-accent px-4 py-1.5 rounded-lg hover:bg-accent/20 transition-all disabled:opacity-40"
              >
                {isLast
                  ? t("finish")
                  : navigating
                  ? t("navigating_btn")
                  : `${t(`steps.${nextKey}.icon` as never)} ${t(`steps.${nextKey}.label` as never)} →`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
