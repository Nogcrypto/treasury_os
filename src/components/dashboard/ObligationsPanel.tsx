"use client";

import { useState, useTransition } from "react";
import {
  createObligation,
  updateObligation,
  deleteObligation,
  type ObligationInput,
  type Recurrence,
} from "@/app/(app)/dashboard/actions";

export interface ObligationRow {
  id: string;
  label: string;
  amountCents: number;
  dueDate: string; // ISO string — serializable across server/client boundary
  recurrence: string;
}

interface ObligationsPanelProps {
  obligations: ObligationRow[];
  isDemo?: boolean;
}

const RECURRENCE_LABELS: Record<string, string> = {
  once:      "única",
  monthly:   "mensal",
  quarterly: "trimestral",
  annual:    "anual",
};

const FMT_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

type Horizon = "30" | "60" | "90";

function getDaysLeft(dueDate: string): number {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
}

function getHorizon(daysLeft: number): Horizon {
  if (daysLeft <= 30) return "30";
  if (daysLeft <= 60) return "60";
  return "90";
}

const BLANK: ObligationInput = {
  label: "",
  amountUsd: 0,
  dueDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  recurrence: "once",
};

function ObligationForm({
  initial,
  onSave,
  onCancel,
  error,
  isPending,
}: {
  initial: ObligationInput;
  onSave: (v: ObligationInput) => void;
  onCancel: () => void;
  error: string | null;
  isPending: boolean;
}) {
  const [form, setForm] = useState<ObligationInput>(initial);

  function set(key: keyof ObligationInput, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <div className="px-4 py-3 bg-bg-0 border-b border-line space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <input
            type="text"
            placeholder="Descrição da obrigação"
            value={form.label}
            onChange={(e) => set("label", e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-bg-1 border border-line rounded-lg text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div>
          <input
            type="number"
            placeholder="Valor (USD)"
            value={form.amountUsd || ""}
            onChange={(e) => set("amountUsd", Number(e.target.value))}
            min={1}
            className="w-full px-2.5 py-1.5 text-xs bg-bg-1 border border-line rounded-lg text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs bg-bg-1 border border-line rounded-lg text-fg focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div className="col-span-2">
          <select
            value={form.recurrence}
            onChange={(e) => set("recurrence", e.target.value as Recurrence)}
            className="w-full px-2.5 py-1.5 text-xs bg-bg-1 border border-line rounded-lg text-fg focus:outline-none focus:border-accent/50 transition-colors"
          >
            <option value="once">Única</option>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-neg">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-fg-3 hover:text-fg px-3 py-1.5 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSave(form)}
          className="text-xs font-medium text-accent border border-accent/40 bg-accent/5 hover:bg-accent/10 px-4 py-1.5 rounded-lg transition-all disabled:opacity-40"
        >
          {isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}

export function ObligationsPanel({ obligations, isDemo = false }: ObligationsPanelProps) {
  const [horizon, setHorizon] = useState<Horizon>("30");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const enriched = obligations.map((o) => ({
    ...o,
    daysLeft: getDaysLeft(o.dueDate),
    horizon: getHorizon(getDaysLeft(o.dueDate)),
  }));

  const filtered = enriched.filter((o) => {
    if (horizon === "30") return o.daysLeft <= 30;
    if (horizon === "60") return o.daysLeft > 30 && o.daysLeft <= 60;
    return o.daysLeft > 60 && o.daysLeft <= 90;
  });

  const totals: Record<Horizon, number> = {
    "30": enriched.filter((o) => o.daysLeft <= 30).reduce((s, o) => s + o.amountCents, 0),
    "60": enriched.filter((o) => o.daysLeft > 30 && o.daysLeft <= 60).reduce((s, o) => s + o.amountCents, 0),
    "90": enriched.filter((o) => o.daysLeft > 60 && o.daysLeft <= 90).reduce((s, o) => s + o.amountCents, 0),
  };

  function handleCreate(input: ObligationInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await createObligation(input);
      if (!result.ok) { setFormError(result.error ?? "Erro."); return; }
      setShowAdd(false);
    });
  }

  function handleUpdate(id: string, input: ObligationInput) {
    setFormError(null);
    startTransition(async () => {
      const result = await updateObligation(id, input);
      if (!result.ok) { setFormError(result.error ?? "Erro."); return; }
      setEditId(null);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteObligation(id);
    });
  }

  return (
    <div className="rounded-xl border border-line bg-bg-1 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-fg-3">◷</span>
          <span className="text-xs font-medium text-fg">Obrigações</span>
        </div>
        {!isDemo && (
          <button
            onClick={() => { setShowAdd(true); setEditId(null); }}
            className="text-[10px] font-mono text-accent hover:text-fg border border-accent/30 hover:border-accent/60 px-2 py-0.5 rounded transition-all"
          >
            + Adicionar
          </button>
        )}
      </div>

      {/* Add form */}
      {showAdd && !isDemo && (
        <ObligationForm
          initial={BLANK}
          onSave={handleCreate}
          onCancel={() => { setShowAdd(false); setFormError(null); }}
          error={formError}
          isPending={isPending}
        />
      )}

      {/* Horizon tabs */}
      <div className="flex border-b border-line">
        {(["30", "60", "90"] as Horizon[]).map((h) => {
          const count = enriched.filter((o) =>
            h === "30" ? o.daysLeft <= 30
            : h === "60" ? o.daysLeft > 30 && o.daysLeft <= 60
            : o.daysLeft > 60 && o.daysLeft <= 90
          ).length;
          const total = totals[h];
          return (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={`flex-1 px-3 py-2 text-center transition-colors ${
                horizon === h
                  ? "border-b-2 border-accent text-fg"
                  : "text-fg-3 hover:text-fg-2"
              }`}
            >
              <div className="text-[10px] font-mono">{h === "90" ? "90+ dias" : `${h} dias`}</div>
              <div className={`text-[11px] font-mono mt-0.5 ${count > 0 && h === "30" ? "text-warn" : "text-fg-3"}`}>
                {total > 0 ? FMT_USD.format(total / 100) : "—"}
              </div>
            </button>
          );
        })}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="px-4 py-5 text-center text-[11px] text-fg-3">
          Nenhuma obrigação nos próximos {horizon === "90" ? "61–90" : horizon} dias.
        </div>
      ) : (
        <div className="divide-y divide-line">
          {filtered.map((o) => (
            <div key={o.id}>
              {editId === o.id && !isDemo ? (
                <ObligationForm
                  initial={{
                    label: o.label,
                    amountUsd: o.amountCents / 100,
                    dueDate: o.dueDate.slice(0, 10),
                    recurrence: o.recurrence as Recurrence,
                  }}
                  onSave={(input) => handleUpdate(o.id, input)}
                  onCancel={() => { setEditId(null); setFormError(null); }}
                  error={editId === o.id ? formError : null}
                  isPending={isPending}
                />
              ) : (
                <div className="px-4 py-3 flex items-center justify-between gap-2 group">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-fg truncate">{o.label}</div>
                    <div className="text-[10px] text-fg-3 font-mono mt-0.5">
                      {RECURRENCE_LABELS[o.recurrence] ?? o.recurrence}
                      {" · "}
                      <span className={o.daysLeft <= 7 ? "text-neg" : o.daysLeft <= 30 ? "text-warn" : "text-fg-3"}>
                        em {o.daysLeft}d
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-fg">
                      {FMT_USD.format(o.amountCents / 100)}
                    </span>
                    {!isDemo && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditId(o.id); setShowAdd(false); setFormError(null); }}
                          className="text-[10px] text-fg-3 hover:text-fg p-1 rounded hover:bg-bg-2 transition-colors"
                          title="Editar"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDelete(o.id)}
                          className="text-[10px] text-fg-3 hover:text-neg p-1 rounded hover:bg-bg-2 transition-colors"
                          title="Excluir"
                          disabled={isPending}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
