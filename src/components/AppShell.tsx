"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState } from "react";
import nextDynamic from "next/dynamic";
import { signOut } from "@/app/(auth)/login/actions";

const ProfilePanelDynamic = nextDynamic(
  () => import("./ProfilePanelWithProviders").then((m) => ({ default: m.ProfilePanelWithProviders })),
  { ssr: false }
);

const NAV = [
  { href: "/dashboard", label: "Dashboard",  icon: "⬡" },
  { href: "/policy",    label: "Política",   icon: "⚖" },
  { href: "/copilot",   label: "Copilot",    icon: "✦" },
  { href: "/simulator", label: "Simulador",  icon: "◈" },
  { href: "/execution", label: "Execução",   icon: "▶" },
  { href: "/reports",   label: "Relatórios", icon: "↗" },
];

function initials(name?: string, email?: string) {
  if (name) {
    const parts = name.trim().split(" ");
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

export function AppShell({
  children,
  email,
  orgName,
  orgId,
  walletAddress,
  userName,
}: {
  children: React.ReactNode;
  email?: string;
  orgName?: string;
  orgId?: string;
  walletAddress?: string;
  userName?: string;
}) {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);

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

        <div className="px-3 py-3 border-t border-line space-y-1">
          {/* Profile button */}
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-2 transition-colors text-left group"
          >
            <div className="w-7 h-7 rounded-full bg-[oklch(0.82_0.18_148)/15] border border-[oklch(0.82_0.18_148)/25] flex items-center justify-center text-xs font-semibold text-[oklch(0.82_0.18_148)] shrink-0">
              {initials(userName, email)}
            </div>
            <div className="min-w-0 flex-1">
              {userName && (
                <div className="text-xs font-medium text-fg-2 truncate leading-tight">{userName}</div>
              )}
              <div className="text-xs text-fg-3 truncate leading-tight">{email}</div>
            </div>
            <span className="text-fg-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs">›</span>
          </button>

          {/* Wallet indicator */}
          {walletAddress && (
            <div className="flex items-center gap-1.5 px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[oklch(0.82_0.18_148)]" />
              <span className="text-xs font-mono text-fg-3 truncate">
                {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
              </span>
            </div>
          )}

          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-fg-3 hover:text-fg transition-colors px-2"
            >
              Sair →
            </button>
          </form>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>

      {/* Profile panel */}
      {profileOpen && orgId && (
        <ProfilePanelDynamic
          orgId={orgId}
          orgName={orgName}
          userName={userName}
          email={email}
          walletAddress={walletAddress}
          onClose={() => setProfileOpen(false)}
        />
      )}
    </div>
  );
}
