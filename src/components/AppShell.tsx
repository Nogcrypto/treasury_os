"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import nextDynamic from "next/dynamic";
import { signOut } from "@/app/(auth)/login/actions";
import { MarketTicker } from "./MarketTicker";
import { Tour } from "./Tour";
import { LanguageSwitcher } from "./LanguageSwitcher";

const ProfilePanelDynamic = nextDynamic(
  () => import("./ProfilePanelWithProviders").then((m) => ({ default: m.ProfilePanelWithProviders })),
  { ssr: false }
);

function initials(name?: string, email?: string) {
  if (name) {
    const parts = name.trim().split(" ");
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "?").toUpperCase();
}

function NavLink({
  href, label, icon, badge, badgeVariant, active, onClick,
}: {
  href: string; label: string; icon: string; badge: string | null;
  badgeVariant: string; active: boolean; onClick: () => void;
}) {
  const badgeClass = badgeVariant === "accent"
    ? "bg-accent/15 text-accent border-accent/25"
    : badgeVariant === "neg"
    ? "bg-neg/15 text-neg border-neg/25"
    : "bg-bg-3 text-fg-3 border-line";

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2 mx-2 rounded-lg text-sm transition-colors ${
        active
          ? "text-fg bg-bg-2 border border-line"
          : "text-fg-3 hover:text-fg hover:bg-bg-2"
      }`}
    >
      <span className="font-mono text-xs w-4 text-center opacity-60">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span className={`text-[9px] font-mono px-1.5 py-px rounded-full border ${badgeClass}`}>{badge}</span>
      )}
    </Link>
  );
}

export function AppShell({
  children,
  email,
  orgName,
  orgId,
  walletAddress,
  userName,
  simulatedMode,
  alertCount,
  showTourAutoStart,
}: {
  children: React.ReactNode;
  email?: string;
  orgName?: string;
  orgId?: string;
  walletAddress?: string;
  userName?: string;
  simulatedMode?: boolean;
  alertCount?: number;
  showTourAutoStart?: boolean;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [simMode, setSimMode] = useState(simulatedMode ?? false);

  const navWorkspace = [
    { href: "/dashboard",     label: t("items.dashboard"),     icon: "⬡", badge: null as string | null, badgeVariant: "" },
    { href: "/policy",        label: t("items.policy"),        icon: "⚖", badge: null as string | null, badgeVariant: "" },
    { href: "/copilot",       label: t("items.copilot"),       icon: "✦", badge: "3",                   badgeVariant: "accent" },
    { href: "/simulator",     label: t("items.simulator"),     icon: "◈", badge: null as string | null, badgeVariant: "" },
    { href: "/execution",     label: t("items.execution"),     icon: "▶", badge: null as string | null, badgeVariant: "" },
    { href: "/equity-studio", label: t("items.equity_studio"), icon: "◎", badge: tCommon("new_badge"),  badgeVariant: "accent" },
  ].map((item) =>
    item.href === "/dashboard" && alertCount && alertCount > 0
      ? { ...item, badge: String(alertCount), badgeVariant: "neg" }
      : item
  );

  const navOperations = [
    { href: "/reports", label: t("items.reporting"), icon: "↗", badge: null as string | null, badgeVariant: "" },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const closeMobile = () => setMobileOpen(false);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-4 py-4 border-b border-line flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <Link href="/dashboard" className="flex items-baseline gap-0 leading-none select-none">
            <span className="text-lg font-light text-fg-2 tracking-[0.12em]">Treasury</span>
            <span className="text-lg font-bold text-fg tracking-[0.04em]">OS</span>
          </Link>
          {orgName && (
            <div className="text-[10px] text-fg-3 mt-1 truncate font-mono">{orgName}</div>
          )}
        </div>
        <button
          onClick={closeMobile}
          className="md:hidden ml-2 p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors shrink-0"
          aria-label={t("close_menu")}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <div className="flex-1 py-3 overflow-y-auto space-y-4">
        {/* Workspace */}
        <div>
          <div className="px-4 mb-1 text-[9px] font-mono text-fg-3 uppercase tracking-widest">{t("workspace")}</div>
          <div className="space-y-0.5">
            {navWorkspace.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} onClick={closeMobile} />
            ))}
          </div>
        </div>

        {/* Operations */}
        <div>
          <div className="px-4 mb-1 text-[9px] font-mono text-fg-3 uppercase tracking-widest">{t("operations")}</div>
          <div className="space-y-0.5">
            {navOperations.map((item) => (
              <NavLink key={item.href} {...item} active={isActive(item.href)} onClick={closeMobile} />
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: RPC + wallet + user */}
      <div className="px-3 py-3 border-t border-line space-y-2 shrink-0">
        {/* RPC status */}
        <div className="flex items-center gap-2 px-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[10px] font-mono text-fg-3">{t("rpc_status")}</span>
        </div>

        {walletAddress && (
          <div className="flex items-center gap-1.5 px-2">
            <span className="text-[10px] font-mono text-fg-3 truncate">
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
          </div>
        )}

        <button
          onClick={() => { setProfileOpen(true); closeMobile(); }}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-2 transition-colors text-left group"
        >
          <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-semibold text-accent shrink-0">
            {initials(userName, email)}
          </div>
          <div className="min-w-0 flex-1">
            {userName && (
              <div className="text-xs font-medium text-fg-2 truncate leading-tight">{userName}</div>
            )}
            <div className="text-[10px] text-fg-3 truncate leading-tight">{email}</div>
          </div>
          <span className="text-fg-3 opacity-0 group-hover:opacity-100 transition-opacity text-xs">›</span>
        </button>

        <form action={signOut}>
          <button type="submit" className="text-[10px] text-fg-3 hover:text-fg transition-colors px-2">
            {t("sign_out")}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={closeMobile} />
      )}

      {/* Sidebar */}
      <nav
        className={`
          fixed inset-y-0 left-0 z-40 w-56 flex flex-col bg-bg-1 border-r border-line
          transition-transform duration-200 ease-in-out
          md:relative md:w-52 md:translate-x-0 md:shrink-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        {sidebarContent}
      </nav>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="h-11 border-b border-line bg-bg-1 flex items-center gap-3 px-4 shrink-0">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors shrink-0"
            aria-label={t("open_menu")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>

          {/* Mobile logo */}
          <Link href="/dashboard" className="md:hidden flex items-baseline gap-0 leading-none select-none">
            <span className="text-base font-light text-fg-2 tracking-[0.12em]">Treasury</span>
            <span className="text-base font-bold text-fg tracking-[0.04em]">OS</span>
          </Link>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-xs">
            <div className="relative w-full">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M8.5 8.5l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                placeholder={t("search_placeholder")}
                className="w-full bg-bg-2 border border-line rounded-lg pl-7 pr-3 py-1 text-xs text-fg placeholder:text-fg-3 focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex-1" />

          {/* Simulated mode toggle */}
          <label className="hidden md:flex items-center gap-1.5 cursor-pointer">
            <div
              onClick={() => setSimMode(!simMode)}
              className={`w-8 h-4 rounded-full relative transition-colors ${simMode ? "bg-warn" : "bg-bg-3"}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-fg transition-transform ${simMode ? "translate-x-4" : "translate-x-0.5"}`} />
            </div>
            <span className={`text-[10px] font-mono ${simMode ? "text-warn" : "text-fg-3"}`}>
              {simMode ? t("simulated") : t("live")}
            </span>
          </label>

          {/* Language switcher */}
          <LanguageSwitcher />

          {/* Tour */}
          <Tour autoStart={showTourAutoStart} />

          {/* Bell */}
          <button className="relative p-1.5 rounded-lg text-fg-3 hover:text-fg hover:bg-bg-2 transition-colors">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M7.5 1.5C5.015 1.5 3 3.515 3 6v3.5l-1.5 1v1h12v-1L12 9.5V6c0-2.485-2.015-4.5-4.5-4.5Z" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M6 12.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2"/>
            </svg>
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-neg text-[8px] font-bold text-white flex items-center justify-center">2</span>
          </button>

        </div>

        {/* Market Ticker */}
        <MarketTicker />

        {/* Main content */}
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
