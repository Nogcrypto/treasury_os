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
  const [mobileOpen, setMobileOpen] = useState(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-line flex items-center justify-between">
        <div className="min-w-0">
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
        {/* Close button — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden ml-2 p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors shrink-0"
          aria-label="Fechar menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Nav links */}
      <div className="flex-1 py-2 overflow-y-auto">
        {NAV.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
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

      {/* Profile + sign out */}
      <div className="px-3 py-3 border-t border-line space-y-1">
        <button
          onClick={() => { setProfileOpen(true); setMobileOpen(false); }}
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
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible flex column; mobile: fixed overlay */}
      <nav
        className={`
          fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-bg-1 border-r border-line
          transition-transform duration-200 ease-in-out
          md:relative md:w-52 md:translate-x-0 md:shrink-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {sidebarContent}
      </nav>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-line bg-bg-1 sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors shrink-0"
            aria-label="Abrir menu"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <Image
            src="/logo.png"
            alt="TreasuryOS"
            width={120}
            height={48}
            className="w-auto h-8 object-contain"
          />
          {orgName && (
            <div className="text-xs text-fg-3 font-mono truncate ml-auto">{orgName}</div>
          )}
        </div>

        <main className="flex-1 min-w-0 overflow-auto">{children}</main>
      </div>

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
