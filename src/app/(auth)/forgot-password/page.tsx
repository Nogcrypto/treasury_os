import Link from "next/link";
import Image from "next/image";
import { sendPasswordReset } from "./actions";

interface Props {
  searchParams: Promise<{ sent?: string; error?: string }>;
}

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-[oklch(0.14_0.006_240)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
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
          {params.sent ? (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-full bg-[oklch(0.82_0.18_148)/15] border border-[oklch(0.82_0.18_148)/30] flex items-center justify-center mx-auto mb-4">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9L7 13L15 5" stroke="oklch(0.82 0.18 148)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h2 className="text-white font-semibold mb-2">Verifique seu email</h2>
              <p className="text-[oklch(0.55_0.02_240)] text-sm">
                Se o email existir, enviaremos um link para redefinir sua senha.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-white font-semibold text-lg mb-1">Esqueceu a senha?</h1>
              <p className="text-[oklch(0.55_0.02_240)] text-sm mb-6">
                Digite seu email e enviaremos um link de redefinição.
              </p>

              {params.error && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-[oklch(0.35_0.18_25)/20] border border-[oklch(0.55_0.18_25)/30] text-[oklch(0.75_0.18_25)] text-sm">
                  Email inválido.
                </div>
              )}

              <form action={sendPasswordReset} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs text-[oklch(0.6_0.02_240)] mb-1.5 font-mono uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    id="email" name="email" type="email" required
                    placeholder="voce@empresa.com" autoComplete="email"
                    className="w-full bg-[oklch(0.22_0.006_240)] border border-[oklch(0.28_0.006_240)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[oklch(0.4_0.02_240)] outline-none focus:border-[oklch(0.82_0.18_148)] transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-[oklch(0.82_0.18_148)] hover:bg-[oklch(0.78_0.18_148)] text-[oklch(0.14_0.006_240)] font-semibold rounded-lg py-2.5 text-sm transition-colors"
                >
                  Enviar link de redefinição
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-sm text-[oklch(0.45_0.02_240)]">
          <Link href="/login" className="text-[oklch(0.82_0.18_148)] hover:opacity-80 transition-opacity font-medium">
            ← Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}
