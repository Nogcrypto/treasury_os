import { sendMagicLink } from "./actions";

interface Props {
  searchParams: Promise<{ sent?: string; email?: string; error?: string }>;
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
          {params.sent ? (
            <SentState email={params.email ?? ""} />
          ) : (
            <LoginForm error={params.error} />
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[oklch(0.45_0.02_240)]">
          Solana Devnet · dados simulados
        </p>
      </div>
    </div>
  );
}

function LoginForm({ error }: { error?: string }) {
  return (
    <>
      <h1 className="text-white font-semibold text-lg mb-1">Entrar</h1>
      <p className="text-[oklch(0.55_0.02_240)] text-sm mb-6">
        Enviaremos um magic link para o seu email.
      </p>

      {error && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[oklch(0.35_0.18_25)/20] border border-[oklch(0.55_0.18_25)/30] text-[oklch(0.75_0.18_25)] text-sm">
          {error === "auth_callback_failed"
            ? "Link expirado ou inválido. Tente novamente."
            : error === "send_failed"
            ? "Erro ao enviar o link. Tente novamente."
            : "Email inválido."}
        </div>
      )}

      <form action={sendMagicLink} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-xs text-[oklch(0.6_0.02_240)] mb-1.5 font-mono uppercase tracking-wider">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@empresa.com"
            className="w-full bg-[oklch(0.22_0.006_240)] border border-[oklch(0.28_0.006_240)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[oklch(0.4_0.02_240)] outline-none focus:border-[oklch(0.82_0.18_148)] transition-colors"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-[oklch(0.82_0.18_148)] hover:bg-[oklch(0.78_0.18_148)] text-[oklch(0.14_0.006_240)] font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          Enviar magic link
        </button>
      </form>
    </>
  );
}

function SentState({ email }: { email: string }) {
  return (
    <div className="text-center py-4">
      <div className="w-10 h-10 rounded-full bg-[oklch(0.82_0.18_148)/15] border border-[oklch(0.82_0.18_148)/30] flex items-center justify-center mx-auto mb-4">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 9L7 13L15 5" stroke="oklch(0.82 0.18 148)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h2 className="text-white font-semibold mb-1">Verifique seu email</h2>
      <p className="text-[oklch(0.55_0.02_240)] text-sm">
        Enviamos um magic link para{" "}
        <span className="text-white font-mono text-xs">{email}</span>.
      </p>
      <p className="text-[oklch(0.45_0.02_240)] text-xs mt-3">
        O link expira em 1 hora.
      </p>
    </div>
  );
}
