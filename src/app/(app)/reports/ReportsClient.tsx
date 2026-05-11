"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { generateExecutiveSummary } from "./actions";
import { PdfExportButton } from "@/components/PdfExportButton";
import type { ComponentProps } from "react";

type PdfData = ComponentProps<typeof PdfExportButton>["data"];

interface ReportsClientProps {
  pdfData: PdfData;
}

export function ReportsClient({ pdfData }: ReportsClientProps) {
  const t = useTranslations("reports");
  const locale = useLocale();
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const res = await generateExecutiveSummary();
      if (res.ok && res.summary) {
        setSummary(res.summary);
      } else {
        setError(res.error ?? t("error_generate" as never));
      }
    });
  }

  const pdfDataWithSummary: PdfData = summary
    ? { ...pdfData, executiveSummary: summary }
    : pdfData;

  const dateLocale = locale === "en" ? "en-US" : "pt-BR";

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 text-xs text-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? (
            <>
              <span className="inline-block w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              {t("generating_btn" as never)}
            </>
          ) : (
            <>{t("generate_btn" as never)}</>
          )}
        </button>

        <PdfExportButton data={pdfDataWithSummary} />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-neg/30 bg-neg/5 px-4 py-3 text-sm text-neg">
          {error}
        </div>
      )}

      {/* Executive summary */}
      {summary && (
        <div className="rounded-xl border border-line bg-bg-1 p-5">
          <div className="text-xs font-mono text-fg-3 uppercase tracking-wider mb-3">
            {t("ai_generated_label" as never)}
          </div>
          <p className="text-sm text-fg-2 leading-relaxed whitespace-pre-wrap">{summary}</p>
          <div className="mt-3 text-xs text-fg-3 font-mono">
            claude-sonnet-4-6 · {new Date().toLocaleDateString(dateLocale)}
          </div>
        </div>
      )}
    </div>
  );
}
