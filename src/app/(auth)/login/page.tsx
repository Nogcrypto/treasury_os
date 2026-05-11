import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { signInWithPassword } from "./actions";

interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const t = await getTranslations("auth.login");

  return (
    <div className="min-h-screen bg-[oklch(0.14_0.006_240)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <Image
            src="/logo.png"
            alt="TreasuryOS"
            width={200}
            height={80}
            className="w-auto h-16 object-contain mx-auto mb-3"
            priority
          />
          <p className="text-[oklch(0.55_0.02_240)] text-sm font-mono tracking-wider uppercase">
            {t("tagline" as never)}
          </p>
        </div>

        <div className="bg-[oklch(0.18_0.006_240)] border border-[oklch(0.25_0.006_240)] rounded-xl p-6">
          <h1 className="text-white font-semibold text-lg mb-1">{t("title" as never)}</h1>
          <p className="text-[oklch(0.55_0.02_240)] text-sm mb-6">
            {t("subtitle" as never)}
          </p>

          {params.error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-[oklch(0.35_0.18_25)/20] border border-[oklch(0.55_0.18_25)/30] text-[oklch(0.75_0.18_25)] text-sm">
              {t("error" as never)}
            </div>
          )}

          <form action={signInWithPassword} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs text-[oklch(0.6_0.02_240)] mb-1.5 font-mono uppercase tracking-wider">
                {t("email_label" as never)}
              </label>
              <input
                id="email" name="email" type="email" required autoComplete="email"
                placeholder={t("email_placeholder" as never)}
                className="w-full bg-[oklch(0.22_0.006_240)] border border-[oklch(0.28_0.006_240)] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-[oklch(0.4_0.02_240)] outline-none focus:border-[oklch(0.82_0.18_148)] transition-colors"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs text-[oklch(0.6_0.02_240)] font-mono uppercase tracking-wider">
                  {t("password_label" as never)}
                </label>
                <Link href="/forgot-password" className="text-xs text-[oklch(0.82_0.18_148)] hover:opacity-80 transition-opacity">
                  {t("forgot_password" as never)}
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
              {t("submit" as never)}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm text-[oklch(0.45_0.02_240)]">
          {t("no_account" as never)}{" "}
          <Link href="/register" className="text-[oklch(0.82_0.18_148)] hover:opacity-80 transition-opacity font-medium">
            {t("register_link" as never)}
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-[oklch(0.35_0.02_240)]">
          {t("footer" as never)}
        </p>
      </div>
    </div>
  );
}
