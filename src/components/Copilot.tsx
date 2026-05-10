"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Analise minha tesouraria e me dê um diagnóstico.",
  "Quanto devo alocar em yield mantendo 90 dias de runway?",
  "Explique as regras da minha política ativa.",
  "Simule o impacto de depositar $50k no Kamino.",
];

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-xs lg:max-w-md bg-accent/15 border border-accent/20 text-fg text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 whitespace-pre-wrap">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-accent text-xs font-mono">AI</span>
      </div>
      <div className="flex-1 min-w-0 text-sm text-fg-2 whitespace-pre-wrap leading-relaxed">
        {text}
        {streaming && (
          <span className="inline-block w-1.5 h-3.5 bg-accent ml-0.5 animate-pulse" />
        )}
      </div>
    </div>
  );
}

export function Copilot({ hasSnapshot }: { hasSnapshot: boolean }) {
  const [history, setHistory] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [streamText, setStreamText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streamText]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setInput("");
      setError(null);
      const userMsg: CopilotMessage = { role: "user", content: trimmed };
      setHistory((h) => [...h, userMsg]);
      setIsStreaming(true);
      setStreamText("");

      abortRef.current = new AbortController();

      try {
        const res = await fetch("/api/copilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortRef.current.signal,
          body: JSON.stringify({ message: trimmed, history }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setStreamText(accumulated);
        }

        setHistory((h) => [
          ...h,
          { role: "assistant", content: accumulated },
        ]);
        setStreamText("");
      } catch (err: unknown) {
        if ((err as Error).name !== "AbortError") {
          setError("Falha ao comunicar com o Copilot.");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        textareaRef.current?.focus();
      }
    },
    [history, isStreaming]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  const isEmpty = history.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col h-screen">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {isEmpty && (
          <div className="text-center py-16">
            <div className="text-2xl mb-2">✦</div>
            <div className="text-sm font-semibold text-fg mb-1">TreasuryOS Copilot</div>
            <div className="text-xs text-fg-3 mb-8">
              Seu assistente de tesouraria com IA. Pergunte sobre alocação, política, runway.
            </div>
            {!hasSnapshot && (
              <div className="inline-block rounded-lg border border-warn/30 bg-warn/5 px-4 py-2 text-xs text-warn mb-6">
                Nenhum snapshot encontrado — tire um snapshot no dashboard para análises mais precisas.
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-xs text-fg-3 border border-line rounded-xl px-3 py-2.5 hover:border-accent/40 hover:text-fg hover:bg-accent/5 transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, i) =>
          msg.role === "user" ? (
            <UserBubble key={i} text={msg.content} />
          ) : (
            <AssistantBubble key={i} text={msg.content} />
          )
        )}

        {isStreaming && streamText && (
          <AssistantBubble text={streamText} streaming />
        )}

        {error && (
          <div className="text-xs text-neg text-center">{error}</div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-line px-6 py-4">
        <div className="relative flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre sua tesouraria… (⌘+Enter para enviar)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 resize-none rounded-xl border border-line bg-bg-2 px-4 py-3 text-sm text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/20 disabled:opacity-50 transition-all min-h-11 max-h-36 overflow-auto"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          {isStreaming ? (
            <button
              onClick={stop}
              className="shrink-0 w-10 h-10 rounded-xl border border-neg/40 text-neg hover:bg-neg/10 transition-all flex items-center justify-center"
            >
              <span className="text-xs">■</span>
            </button>
          ) : (
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim()}
              className="shrink-0 w-10 h-10 rounded-xl bg-accent text-bg-0 hover:opacity-90 disabled:opacity-30 transition-all flex items-center justify-center"
            >
              <span className="text-sm">↑</span>
            </button>
          )}
        </div>
        <div className="text-xs text-fg-3 mt-1.5 text-right">⌘+Enter para enviar</div>
      </div>
    </div>
  );
}
