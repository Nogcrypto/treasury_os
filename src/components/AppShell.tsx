"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(auth)/login/actions";

const NAV = [
  { href: "/dashboard", label: "Dashboard",  icon: "⬡" },
  { href: "/policy",    label: "Política",   icon: "⚖" },
  { href: "/copilot",   label: "Copilot",    icon: "✦" },
  { href: "/simulator", label: "Simulador",  icon: "◈" },
  { href: "/execution", label: "Execução",   icon: "▶" },
  { href: "/reports",   label: "Relatórios", icon: "↗" },
];

export function AppShell({
  children,
  email,
  orgName,
}: {
  children: React.ReactNode;
  email?: string;
  orgName?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <nav className="w-52 shrink-0 border-r border-line bg-bg-1 flex flex-col">
        <div className="px-4 py-4 border-b border-line">
          <Image
            src="/logo.png"
            alt="TreasuryOS"
            width={140}
            height={56}
            className="w-auto h-10 object-contain"
            priority
          />
          {orgName && (
            <div className="text-xs text-fg-3 mt-1.5 truncate font-mono">{orgName}</div>
          )}
        </div>

        <div className="flex-1 py-2">
          {NAV.map(({ href, label, icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 px-4 py-2 text-sm transition-colors ${
                  active
                    ? "text-fg bg-bg-2 border-r-2 border-accent"
                    : "text-fg-3 hover:text-fg hover:bg-bg-2"
                }`}
              >
                <span className="font-mono text-xs w-4 text-center opacity-50">{icon}</span>
                {label}
              </Link>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-line space-y-1.5">
          {email && (
            <div className="text-xs text-fg-3 font-mono truncate">{email}</div>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-fg-3 hover:text-fg transition-colors"
            >
              Sair →
            </button>
          </form>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  );
}
