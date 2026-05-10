import type { TreasuryAlert } from "@/lib/rules-engine/alerts";

const SEVERITY_STYLES: Record<string, Record<string, string>> = {
  runway:        { warn: "border-warn/30 bg-warn/5",  block: "border-neg/30 bg-neg/5" },
  concentration: { warn: "border-warn/30 bg-warn/5",  block: "border-neg/30 bg-neg/5" },
  obligation:    { warn: "border-blue-400/30 bg-blue-400/5", block: "border-neg/30 bg-neg/5" },
  policy:        { warn: "border-warn/30 bg-warn/5",  block: "border-neg/30 bg-neg/5" },
};

const SEVERITY_TEXT: Record<string, Record<string, string>> = {
  runway:        { warn: "text-warn",     block: "text-neg" },
  concentration: { warn: "text-warn",     block: "text-neg" },
  obligation:    { warn: "text-blue-400", block: "text-neg" },
  policy:        { warn: "text-warn",     block: "text-neg" },
};

const ICONS: Record<string, string> = {
  runway: "⏱",
  concentration: "⚡",
  obligation: "📅",
  policy: "⚖",
};

interface AlertsBannerProps {
  alerts: TreasuryAlert[];
}

export function AlertsBanner({ alerts }: AlertsBannerProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {alerts.map((alert, i) => {
        const containerCls = SEVERITY_STYLES[alert.type]?.[alert.severity] ?? "border-warn/30 bg-warn/5";
        const textCls = SEVERITY_TEXT[alert.type]?.[alert.severity] ?? "text-warn";
        return (
          <div
            key={i}
            className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${containerCls}`}
          >
            <span className={`text-base leading-none mt-0.5 ${textCls}`}>
              {ICONS[alert.type] ?? "▸"}
            </span>
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-mono font-semibold uppercase tracking-wider ${textCls}`}>
                {alert.title}
              </div>
              <div className="text-sm text-fg-2 mt-0.5">{alert.message}</div>
            </div>
            <div className={`text-xs font-mono px-1.5 py-0.5 rounded border ${textCls} border-current opacity-60 shrink-0`}>
              {alert.severity === "block" ? "BLOCK" : "WARN"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
