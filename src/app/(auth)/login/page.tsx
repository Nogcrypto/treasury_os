import Link from "next/link";
import { signInWithPassword } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-[oklch(0.14_0.006_240)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-[oklch(0.82_0.18_148)] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4V10L7 13L1 10V4L7 1Z" fill="oklch(0.14 0.006 240)" strokeWidth="0"/>
              </svg>
            </div>
            <span className="text-white font-semibold tracking-tight">TreasuryOS</span>
          </div>
          <p className="text-[oklch(0.55_0.02_240)] text-sm font-mono tracking-wider uppercase">
            CFO operacional onchain
          </p>
        </div>

        <div className="bg-[oklch(0.18_0.006_240)] border border-[oklch(0.25_0.006_240)] rounded-xl p-6">
          <h1 className="text-white font-semibold text-lg mb-1">Entrar</h1>
          <p className="text-[oklch(0.55_0.02_240)] text-sm mb-6">
            Acesse sua conta TreasuryOS.
          </p>

          {params.error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-[oklch(0.35_0.18_25)/20] border border-[oklch(0.55_0.18_25)/30] text-[oklch(0.75_0.18_25)] text-sm">
              Email ou senha incorretos.
            </div>
          )}

          <form action={signInWithPassword} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs text-[oklch(0.6_0.02_240)] mb-1.5 font-mono uppercase tracking-wider">
                Email
              </label>
              <input
                id="email" name="email" type="email" required autoComplete="email"
                placeholder="voce@empresa.com"
                className="w-full bg-[oklch(0.22_0.006_240)] border border-[oklch(0.28_0.006_240)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[oklch(0.4_0.02_240)] outline-none focus:border-[oklch(0.82_0.18_148)] transition-colors"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs text-[oklch(0.6_0.02_240)] font-mono uppercase tracking-wider">
                  Senha
                </label>
                <Link href="/forgot-password" className="text-xs text-[oklch(0.82_0.18_148)] hover:opacity-80 transition-opacity">
                  Esqueceu a senha?
                </Link>
              </div>
              <input
                id="password" name="password" type="password" required autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-[oklch(0.22_0.006_240)] border border-[oklch(0.28_0.006_240)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[oklch(0.4_0.02_240)] outline-none focus:border-[oklch(0.82_0.18_148)] transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[oklch(0.82_0.18_148)] hover:bg-[oklch(0.78_0.18_148)] text-[oklch(0.14_0.006_240)] font-semibold rounded-lg py-2.5 text-sm transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-[oklch(0.45_0.02_240)]">
          Não tem conta?{" "}
          <Link href="/register" className="text-[oklch(0.82_0.18_148)] hover:opacity-80 transition-opacity font-medium">
            Cadastre-se
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-[oklch(0.35_0.02_240)]">
          Solana Devnet · dados simulados
        </p>
      </div>
    </div>
  );
}
