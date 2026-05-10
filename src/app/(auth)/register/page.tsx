"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState } from "react";
import { registerUser } from "./actions";

const COUNTRIES = [
  "Brasil", "Estados Unidos", "Portugal", "Argentina", "México",
  "Colômbia", "Chile", "Espanha", "Reino Unido", "Alemanha", "Outro",
];

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerUser, null);

  return (
    <div className="min-h-screen bg-[oklch(0.14_0.006_240)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-6 text-center">
          <Image
            src="/logo.png"
            alt="TreasuryOS"
            width={200}
            height={80}
            className="w-auto h-16 object-contain mx-auto"
            priority
          />
        </div>

        <div className="bg-[oklch(0.18_0.006_240)] border border-[oklch(0.25_0.006_240)] rounded-xl p-6">
          <h1 className="text-white font-semibold text-lg mb-1">Criar conta</h1>
          <p className="text-[oklch(0.55_0.02_240)] text-sm mb-5">
            Preencha seus dados para começar.
          </p>

          {state?.error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-[oklch(0.35_0.18_25)/20] border border-[oklch(0.55_0.18_25)/30] text-[oklch(0.75_0.18_25)] text-sm">
              {state.error}
            </div>
          )}

          <form action={action} className="space-y-3.5">
            <Field id="fullName" label="Nome completo" type="text" placeholder="João Silva" required autoComplete="name" />
            <Field id="email" label="Email" type="email" placeholder="voce@empresa.com" required autoComplete="email" />
            <Field id="phone" label="Telefone" type="tel" placeholder="+55 11 99999-9999" autoComplete="tel" />

            <div>
              <label htmlFor="country" className="block text-xs text-[oklch(0.6_0.02_240)] mb-1.5 font-mono uppercase tracking-wider">
                País
              </label>
              <select
                id="country" name="country"
                className="w-full bg-[oklch(0.22_0.006_240)] border border-[oklch(0.28_0.006_240)] rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-[oklch(0.82_0.18_148)] transition-colors"
              >
                <option value="">Selecione...</option>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="h-px bg-[oklch(0.25_0.006_240)]" />

            <Field id="password" label="Senha" type="password" placeholder="Mín. 8 caracteres" required autoComplete="new-password" />
            <Field id="confirmPassword" label="Confirmar senha" type="password" placeholder="Repita a senha" required autoComplete="new-password" />

            <button
              type="submit"
              disabled={pending}
              className="w-full bg-[oklch(0.82_0.18_148)] hover:bg-[oklch(0.78_0.18_148)] disabled:opacity-50 text-[oklch(0.14_0.006_240)] font-semibold rounded-lg py-2.5 text-sm transition-colors mt-1"
            >
              {pending ? "Criando conta…" : "Criar conta"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-[oklch(0.45_0.02_240)]">
          Já tem conta?{" "}
          <Link href="/login" className="text-[oklch(0.82_0.18_148)] hover:opacity-80 transition-opacity font-medium">
            Entrar
          </Link>
        </p>

        <p className="mt-3 text-center text-xs text-[oklch(0.35_0.02_240)]">
          Solana Devnet · dados simulados
        </p>
      </div>
    </div>
  );
}

function Field({
  id, label, type, placeholder, required, autoComplete,
}: {
  id: string; label: string; type: string; placeholder: string;
  required?: boolean; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-[oklch(0.6_0.02_240)] mb-1.5 font-mono uppercase tracking-wider">
        {label}{!required && <span className="ml-1 normal-case text-[oklch(0.4_0.02_240)]">(opcional)</span>}
      </label>
      <input
        id={id} name={id} type={type} placeholder={placeholder}
        required={required} autoComplete={autoComplete}
        className="w-full bg-[oklch(0.22_0.006_240)] border border-[oklch(0.28_0.006_240)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[oklch(0.4_0.02_240)] outline-none focus:border-[oklch(0.82_0.18_148)] transition-colors"
      />
    </div>
  );
}
