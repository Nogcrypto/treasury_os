"use client";
import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import {
  Wallet, ArrowRight, ShieldCheck, TrendingUp, Briefcase, CheckCircle2, Cpu,
  BarChart3, Lock, Zap, Globe, Coins, FileText, Share2, Landmark, Layers,
} from "lucide-react";
import { GlowCard } from "./ui/spotlight-card";
import { Button } from "./ui/button";
import { InfiniteSlider } from "./ui/infinite-slider";
import { ProgressiveBlur } from "./ui/progressive-blur";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { createClient } from "@/lib/supabase/client";

const Beams = dynamic(() => import("./ui/beams").then((m) => ({ default: m.Beams })), {
  ssr: false,
  loading: () => <div className="size-full bg-black" />,
});
const CanvasRevealEffect = dynamic(
  () => import("./ui/canvas-reveal").then((m) => ({ default: m.CanvasRevealEffect })),
  { ssr: false, loading: () => null },
);

export default function LandingPage() {
  return (
    <LanguageProvider>
      <div className="min-h-screen bg-black font-sans selection:bg-brand-emerald/30 overflow-x-hidden">
        <Navbar />
        <main className="flex flex-col items-center">
          <HeroSection />
          <SocialProof />
          <MaturityPath />
          <SimulatorSection />
          <DashboardPreview />
          <AiCopilotSection />
          <WaitlistSection />
        </main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}

function Navbar() {
  const { lang, setLang, t } = useLanguage();
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/10 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center">
          <a href="#" aria-label="TreasuryOS" className="group flex items-baseline gap-0 leading-none select-none">
            <span className="text-xl tracking-widest font-light text-white/70 transition-colors duration-300 group-hover:text-white/90"
              style={{ fontFamily: "'Inter', 'Manrope', 'Public Sans', system-ui, sans-serif", letterSpacing: "0.12em" }}>
              Treasury
            </span>
            <span className="text-xl font-bold text-white transition-colors duration-300 group-hover:text-white"
              style={{ fontFamily: "'Inter', 'Manrope', 'Public Sans', system-ui, sans-serif", letterSpacing: "0.04em" }}>
              OS
            </span>
          </a>
        </div>

        <div className="hidden md:flex items-center space-x-1 rounded-full bg-white/5 backdrop-blur-xl border border-white/10 p-1 absolute left-1/2 -translate-x-1/2">
          <a href="#produto" className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-all hover:bg-white/10 hover:text-white pb-1.5">{t.nav.product}</a>
          <a href="#yield" className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-all hover:bg-white/10 hover:text-white pb-1.5">{t.nav.yield}</a>
          <a href="#tokenizacao" className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-all hover:bg-white/10 hover:text-white pb-1.5">{t.nav.tokenization}</a>
          <a href="#copilot" className="rounded-full px-4 py-2 text-sm font-medium text-white/90 transition-all hover:bg-white/10 hover:text-white pb-1.5">{t.nav.copilot}</a>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group flex items-center py-2 -my-2">
            <button className="flex items-center gap-1 text-white/90 hover:text-white transition-colors">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase">{lang}</span>
            </button>
            <div className="absolute top-full right-0 pt-3 hidden group-hover:block">
              <div className="flex flex-col rounded-xl bg-black/90 backdrop-blur-xl border border-white/10 p-2 shadow-xl w-36">
                <button onClick={() => setLang("pt")} className={`px-4 py-2 text-sm text-left rounded-lg transition-colors ${lang === "pt" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>Português</button>
                <button onClick={() => setLang("en")} className={`px-4 py-2 text-sm text-left rounded-lg transition-colors ${lang === "en" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>English</button>
                <button onClick={() => setLang("es")} className={`px-4 py-2 text-sm text-left rounded-lg transition-colors ${lang === "es" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>Español</button>
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="hidden sm:flex rounded-full" asChild>
            <a href="/login">
              <Wallet className="mr-2 h-4 w-4" />
              {t.nav.connectWallet}
            </a>
          </Button>
        </div>
      </div>
    </nav>
  );
}

function HeroSection() {
  const { t } = useLanguage();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    mouseX.set((clientX - left) / width - 0.5);
    mouseY.set((clientY - top) / height - 0.5);
  };

  const springConfig = { damping: 25, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);
  const videoX = useTransform(smoothX, [-0.5, 0.5], ["-3%", "3%"]);
  const videoY = useTransform(smoothY, [-0.5, 0.5], ["-3%", "3%"]);
  const glowX = useTransform(smoothX, [-0.5, 0.5], ["-20%", "20%"]);
  const glowY = useTransform(smoothY, [-0.5, 0.5], ["-20%", "20%"]);

  return (
    <section
      className="relative w-full overflow-hidden bg-black min-h-screen flex items-center justify-center pt-8 pb-12"
      onMouseMove={handleMouseMove}
    >
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] aspect-square bg-brand-blue/10 blur-[120px] rounded-full pointer-events-none"
        style={{ x: glowX, y: glowY }}
      />
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ x: videoX, y: videoY }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
      >
        <Beams
          beamWidth={2.5} beamHeight={18} beamNumber={15}
          lightColor="#ffffff" speed={2.5} noiseIntensity={2}
          scale={0.15} rotation={43}
          className="size-full opacity-60 mix-blend-screen scale-[1.05]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
      </motion.div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col items-center justify-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8 inline-flex items-center rounded-full bg-white/5 backdrop-blur-xl border border-white/10 px-4 py-2 text-sm font-medium text-white/90"
        >
          <span className="relative flex h-2 w-2 mr-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-emerald opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-emerald" />
          </span>
          {t.hero.badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2, type: "spring", bounce: 0.2 }}
          className="w-full font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.2] tracking-tight text-white drop-shadow-2xl"
        >
          <span className="block sm:whitespace-nowrap">{t.hero.title1}</span>
          <span className="block sm:whitespace-nowrap bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            {t.hero.title2}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-6 lg:mt-10 max-w-2xl text-lg md:text-xl md:leading-8 text-white/80"
        >
          {t.hero.desc}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full max-w-md sm:max-w-none"
        >
          <Button
            size="lg"
            className="h-14 bg-white text-black hover:bg-gray-100 rounded-full px-8 text-base font-semibold group flex items-center justify-center gap-2 shadow-[0_0_32px_4px_rgba(255,255,255,0.18),0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_0_48px_8px_rgba(255,255,255,0.28),0_4px_24px_rgba(0,0,0,0.5)] transition-all outline-none ring-1 ring-white/30 hover:ring-white/60"
            asChild
          >
            <a href="/login">
              <span>{t.hero.connectWallet}</span>
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

function SocialProof() {
  const { t } = useLanguage();
  const partners = ["Solana", "Phantom", "Helius", "Kamino", "Anthropic", "Orca", "Raydium", "Meteora"];
  return (
    <section className="w-full bg-black pb-12 pt-8 border-b border-white/5 z-20 relative">
      <div className="group relative mx-auto max-w-7xl px-6 lg:px-12">
        <div className="flex flex-col items-center lg:flex-row lg:items-center">
          <div className="mb-8 lg:mb-0 lg:pr-8 lg:border-r lg:border-white/10 whitespace-nowrap">
            <p className="text-center lg:text-end text-sm font-semibold text-gray-500 uppercase tracking-[0.2em]">
              {t.social.title}
            </p>
          </div>
          <div className="relative py-4 w-full flex-1 overflow-hidden lg:pl-8">
            <InfiniteSlider duration={40} gap={112}>
              {partners.map((partner, idx) => (
                <div key={idx} className="flex items-center font-display text-3xl font-bold text-gray-400 grayscale hover:grayscale-0 hover:text-white cursor-pointer transition-all duration-300">
                  {partner}
                </div>
              ))}
            </InfiniteSlider>
            <div className="absolute inset-y-0 left-0 lg:left-8 w-24 bg-gradient-to-r from-black to-transparent opacity-90 z-10 pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-black to-transparent opacity-90 z-10 pointer-events-none" />
            <ProgressiveBlur className="pointer-events-none absolute left-0 lg:left-8 top-0 h-full w-24 z-20" direction="left" blurIntensity={0.5} />
            <ProgressiveBlur className="pointer-events-none absolute right-0 top-0 h-full w-24 z-20" direction="right" blurIntensity={0.5} />
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center lg:justify-end gap-8 text-sm text-gray-400 font-medium">
          <div className="flex items-center gap-2.5 transition-colors hover:text-white cursor-default">
            <Lock className="h-4 w-4 text-brand-emerald" /> {t.social.nonCustodial}
          </div>
          <div className="flex items-center gap-2.5 transition-colors hover:text-white cursor-default">
            <ShieldCheck className="h-4 w-4 text-brand-blue" /> {t.social.audit}
          </div>
        </div>
      </div>
    </section>
  );
}

function SimulatorSection() {
  const { t, lang } = useLanguage();
  const [volume, setVolume] = useState(500000);
  const burnRate = 25000;
  const apy = 0.082;
  const yieldMensal = (volume * apy) / 12;
  const yieldAnual = volume * apy;
  const standardRunway = volume / burnRate;
  const optimizedBurnRate = burnRate - yieldMensal;
  const optimizedRunway = volume / optimizedBurnRate;

  const chartData = [];
  for (let month = 0; month <= Math.ceil(optimizedRunway); month++) {
    chartData.push({
      month: `${t.sim.monthPrefix} ${month}`,
      standard: Math.max(0, volume - burnRate * month),
      optimized: Math.max(0, volume - optimizedBurnRate * month),
    });
  }

  const locale = lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US";
  const fmt = (n: number, opts?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD", ...opts }).format(n);

  return (
    <motion.section
      id="yield"
      initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      className="relative mx-auto flex w-full max-w-7xl flex-col items-center gap-12 px-6 py-24"
    >
      <div className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 w-full max-w-[800px] aspect-square bg-brand-emerald/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold text-white md:text-4xl">{t.sim.title}</h2>
        <p className="mt-4 text-gray-400">{t.sim.subtitle}</p>
      </div>
      <div className="group w-full max-w-4xl overflow-hidden rounded-2xl border border-white/5 bg-brand-surface/30 backdrop-blur-xl shadow-2xl transition-all hover:border-white/10 hover:bg-brand-surface/40 hover:shadow-[0_0_4rem_-1rem_rgba(16,185,129,0.2)]">
        <div className="p-8">
          <div className="mb-8 flex flex-col gap-4">
            <div className="flex justify-between">
              <label className="text-sm font-medium text-gray-400">{t.sim.volume}</label>
              <span className="font-display text-2xl font-bold text-brand-emerald">{fmt(volume)}</span>
            </div>
            <div className="group/slider relative py-4">
              <input
                type="range" min="50000" max="5000000" step="50000" value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden pointer-events-none shadow-inner border border-white/5">
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-brand-emerald to-brand-blue transition-all duration-75 ease-out"
                  style={{ width: `${((volume - 50000) / (5000000 - 50000)) * 100}%` }}
                />
              </div>
              <div
                className="absolute top-1/2 -mt-2 h-4 w-4 rounded-full bg-white border border-brand-emerald shadow-[0_0_15px_rgba(16,185,129,0.8)] pointer-events-none transition-transform group-hover/slider:scale-125 z-10"
                style={{ left: `calc(${((volume - 50000) / (5000000 - 50000)) * 100}% - 8px)` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-600 font-medium">
              <span>$50k</span><span>$5MM</span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 mb-8">
            <div className="group relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-6 transition-all hover:border-brand-blue/30 hover:shadow-[0_0_2rem_-0.5rem_#3b82f6]">
              <div className="absolute -right-20 -top-20 z-0 h-40 w-40 rounded-full bg-brand-blue/10 blur-[50px] transition-all group-hover:bg-brand-blue/20" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 text-brand-blue">
                  <TrendingUp className="h-5 w-5" />
                  <h3 className="font-medium text-gray-200">{t.sim.yieldTitle}</h3>
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-bold text-white">{fmt(yieldAnual, { maximumFractionDigits: 0 })}</span>
                  <span className="text-sm text-gray-400">{t.sim.perYear}</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">{t.sim.yieldDesc}</p>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-6 transition-all hover:border-brand-emerald/30 hover:shadow-[0_0_2rem_-0.5rem_#10b981]">
              <div className="absolute -right-20 -top-20 z-0 h-40 w-40 rounded-full bg-brand-emerald/10 blur-[50px] transition-all group-hover:bg-brand-emerald/20" />
              <div className="relative z-10">
                <div className="flex items-center gap-3 text-brand-emerald">
                  <BarChart3 className="h-5 w-5" />
                  <h3 className="font-medium text-gray-200">{t.sim.runwayTitle}</h3>
                </div>
                <div className="mt-4 flex items-end gap-4">
                  <div>
                    <span className="font-display text-4xl font-bold text-white">{optimizedRunway.toFixed(1)}</span>
                    <span className="ml-2 text-sm text-gray-400">{t.sim.months}</span>
                  </div>
                  <div className="mb-1 rounded bg-brand-emerald/10 px-2 py-1 text-xs font-semibold text-brand-emerald">
                    +{(optimizedRunway - standardRunway).toFixed(1)} {t.sim.extraMonths}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-64 w-full overflow-hidden rounded-xl border border-white/5 bg-black/40 p-4 pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorStandard" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOptimized" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} width={60} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "#111827", borderColor: "rgba(255,255,255,0.1)", borderRadius: "8px" }}
                  itemStyle={{ color: "#fff" }}
                  formatter={(value) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value))}
                />
                <Area type="monotone" dataKey="standard" name={t.sim.trad} stroke="#60a5fa" fillOpacity={1} fill="url(#colorStandard)" />
                <Area type="monotone" dataKey="optimized" name={t.sim.withOS} stroke="#10b981" fillOpacity={1} fill="url(#colorOptimized)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function MaturityPath() {
  const { t } = useLanguage();

  const stepIcons = {
    blue: <Coins className="h-6 w-6 text-brand-blue" />,
    green: <FileText className="h-6 w-6 text-brand-emerald" />,
    orange: <Share2 className="h-6 w-6 text-orange-400" />,
  };
  const badgeColors = {
    blue: "border-brand-blue/30 text-brand-blue bg-brand-blue/10",
    green: "border-brand-emerald/30 text-brand-emerald bg-brand-emerald/10",
    orange: "border-orange-500/30 text-orange-400 bg-orange-500/10",
  };
  const textColors = {
    blue: "text-brand-blue",
    green: "text-brand-emerald",
    orange: "text-orange-400",
  };

  return (
    <motion.section
      id="produto"
      initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      className="relative w-full bg-black py-32"
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Beams beamWidth={2} beamHeight={20} beamNumber={10} lightColor="#10b981" speed={1.5} noiseIntensity={1} scale={0.1} rotation={-25} className="size-full opacity-30 mix-blend-screen scale-[1.05]" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black/80" />
      </div>
      <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-center px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="flex flex-col items-center">
          <h2 className="font-display text-4xl font-bold text-white md:text-5xl text-center">{t.path.title}</h2>
          <p className="mt-6 max-w-3xl text-center text-lg text-gray-400">{t.path.subtitle}</p>
        </motion.div>

        <div className="mt-20 grid w-full gap-6 md:grid-cols-3">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(t.path.steps as any[]).map((step, idx) => {
            const colorKey = step.color as "blue" | "green" | "orange";
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: idx * 0.2 }}
                className="group relative"
              >
                <GlowCard customSize className="w-full h-full min-h-[500px] transition-transform duration-500 group-hover:-translate-y-2 group-hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.5)] overflow-hidden" glowColor={colorKey}>
                  <div className="absolute inset-0 z-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                    <div className={`absolute -right-20 -top-20 h-64 w-64 rounded-full blur-[80px] ${colorKey === "blue" ? "bg-brand-blue/30" : colorKey === "green" ? "bg-brand-emerald/30" : "bg-orange-500/20"}`} />
                  </div>
                  <div className="flex flex-col h-full items-start relative z-10">
                    <div className={`text-xs font-bold tracking-[0.2em] mb-6 ${textColors[colorKey]}`}>{step.phase}</div>
                    <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${textColors[colorKey]}`}>
                      {stepIcons[colorKey]}
                    </div>
                    <h3 className="font-display text-2xl font-bold text-white mb-4 leading-tight">{step.title}</h3>
                    <div className={`inline-flex items-center rounded-full border px-3 py-1 mb-6 text-xs font-medium transition-colors duration-300 ${badgeColors[colorKey]}`}>{step.badge}</div>
                    <p className="leading-relaxed text-gray-400 mb-8 min-h-[120px] transition-colors duration-300 group-hover:text-gray-300">{step.desc}</p>
                    <div className="mt-auto w-full pt-6 border-t border-white/5">
                      <ul className="flex flex-col gap-4 w-full">
                        {(step.features as string[]).map((feat, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-gray-400 transition-all duration-300 group-hover:text-gray-200 group-hover:translate-x-2" style={{ transitionDelay: `${i * 75}ms` }}>
                            <CheckCircle2 className={`h-5 w-5 shrink-0 transition-transform duration-500 group-hover:scale-110 ${textColors[colorKey]}`} />
                            <span className="leading-relaxed">{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </GlowCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}

function DashboardPreview() {
  const { t } = useLanguage();
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);

  return (
    <motion.section
      id="tokenizacao"
      initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative mx-auto w-full max-w-7xl px-6 py-16 md:py-20"
    >
      <div className="absolute right-0 top-1/2 -z-10 -translate-y-1/2 w-[800px] h-[800px] bg-brand-blue/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute left-0 bottom-0 -z-10 w-[600px] h-[600px] bg-brand-emerald/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="grid gap-10 lg:gap-12 lg:grid-cols-2 items-center">
        <div className="flex flex-col gap-5">
          <div>
            <div className="relative mb-8">
              <div className="absolute -inset-8 bg-gradient-to-tr from-brand-blue/20 via-brand-emerald/10 to-transparent blur-3xl opacity-60 rounded-[3rem] pointer-events-none" />
              <h2 className="relative font-display text-4xl font-extrabold md:text-5xl lg:text-5xl xl:text-6xl leading-[1.15] tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-gray-400 drop-shadow-[0_4px_24px_rgba(255,255,255,0.1)] [text-shadow:_0_2px_10px_rgba(0,0,0,0.6),_0_1px_1px_rgba(255,255,255,0.3)]">
                  {t.dash.title}
                </span>
              </h2>
            </div>
            <div className="relative group cursor-default">
              <div className="absolute -inset-2 rounded-lg bg-white/5 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <p className="relative text-base md:text-lg text-gray-400 leading-relaxed border-l-2 border-brand-emerald/50 pl-6 py-2 transition-colors duration-300 group-hover:text-gray-300 group-hover:border-brand-emerald">
                {t.dash.subtitle}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 mt-4">
            {[
              { value: t.dash.stats.market, label: t.dash.stats.marketLabel, color: "brand-blue" },
              { value: t.dash.stats.roi, label: t.dash.stats.roiLabel, color: "brand-emerald" },
              { value: t.dash.stats.access, label: t.dash.stats.accessLabel, color: "brand-blue", span: true },
            ].map((stat, i) => (
              <div key={i} className={`group flex flex-col gap-2 p-5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors relative overflow-hidden ${stat.span ? "sm:col-span-1 col-span-2" : ""}`}>
                <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className={`font-display text-3xl font-bold text-${i === 1 ? "brand-emerald" : i === 2 ? "brand-blue" : "white"} font-mono tabular-nums tracking-tight`}>{stat.value}</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-[0.2em]">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="flex">
            <Button size="lg" className="rounded-full bg-brand-blue hover:bg-brand-blue/90 text-white font-medium px-8 transition-transform hover:scale-[1.02]" asChild>
              <a href="#credenciamento">
                {t.dash.ctaConsult}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        <div className="relative w-full flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-tr from-brand-emerald/10 to-brand-blue/10 blur-[100px] rounded-full -z-10" />
          <div className="flex flex-col gap-0 relative z-10 w-full max-w-lg">
            {/* Card 1 */}
            <div
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all duration-500 hover:border-brand-blue/50 hover:bg-black/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10"
              onMouseEnter={() => setHoveredCard(0)} onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-brand-blue/50 to-brand-blue rounded-l-2xl" />
              <div className="flex items-start gap-5">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-brand-blue/30 bg-gradient-to-br from-brand-blue/20 to-brand-blue/5 text-brand-blue shadow-[inset_0_0_20px_rgba(59,130,246,0.1)] transition-all duration-500 group-hover:scale-110 group-hover:bg-brand-blue/30 group-hover:shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  <Landmark className="h-6 w-6 stroke-[1.5]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold text-white mb-2 tracking-tight">{t.dash.card1Title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-normal">{t.dash.card1Desc}</p>
                  <AnimatePresence>
                    {hoveredCard === 0 && (
                      <motion.div key="c1" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} style={{ overflow: "hidden" }} className="mt-3 space-y-2">
                        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/10">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.dash.whatIs}</div>
                          <p className="text-sm text-gray-300 leading-relaxed font-normal">{t.dash.card1What}</p>
                        </div>
                        <div className="bg-brand-blue/[0.05] rounded-lg p-3 border border-brand-blue/20">
                          <div className="text-xs font-bold text-brand-blue uppercase tracking-wider mb-1 flex items-center gap-1.5"><Zap className="h-3 w-3" />{t.dash.valueForFounder}</div>
                          <p className="text-sm text-gray-300 leading-relaxed font-normal">{t.dash.card1Value}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="relative h-12 flex justify-start ml-[3rem] -my-2 -z-10">
              <div className="absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-brand-blue via-white/20 to-white/20" />
            </div>

            {/* Card 2 */}
            <div
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all duration-500 hover:border-white/30 hover:bg-black/60 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-10"
              onMouseEnter={() => setHoveredCard(1)} onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-white/20 to-white/50 rounded-l-2xl" />
              <div className="flex items-start gap-5">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-white/10 to-white/0 text-white shadow-[inset_0_0_20px_rgba(255,255,255,0.05)] transition-all duration-500 group-hover:scale-110 group-hover:bg-white/20 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                  <BarChart3 className="h-6 w-6 stroke-[1.5]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold text-white mb-2 tracking-tight">{t.dash.card2Title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-normal">{t.dash.card2Desc}</p>
                  <AnimatePresence>
                    {hoveredCard === 1 && (
                      <motion.div key="c2" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} style={{ overflow: "hidden" }} className="mt-3 space-y-2">
                        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/10">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.dash.whatIs}</div>
                          <p className="text-sm text-gray-300 leading-relaxed font-normal">{t.dash.card2What}</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/10">
                          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Zap className="h-3 w-3" />{t.dash.valueForFounder}</div>
                          <p className="text-sm text-gray-300 leading-relaxed font-normal">{t.dash.card2Value}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="relative h-12 flex justify-start ml-[3rem] -my-2 -z-10">
              <div className="absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-white/20 via-brand-emerald to-brand-emerald" />
            </div>

            {/* Card 3 */}
            <div
              className="group relative overflow-hidden rounded-2xl border border-brand-emerald/40 bg-gradient-to-br from-black/80 to-brand-emerald/10 p-6 backdrop-blur-xl transition-all duration-500 hover:border-brand-emerald hover:bg-black/90 hover:shadow-[0_0_50px_-10px_rgba(16,185,129,0.5)] z-10 transform hover:-translate-y-1"
              onMouseEnter={() => setHoveredCard(2)} onMouseLeave={() => setHoveredCard(null)}
            >
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-brand-emerald/50 to-brand-emerald rounded-l-2xl shadow-[0_0_15px_rgba(16,185,129,1)]" />
              <div className="absolute inset-0 bg-brand-emerald/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="absolute right-0 top-0 p-6 opacity-10 transition-transform duration-700 group-hover:scale-[2.5] group-hover:rotate-12 group-hover:opacity-20 pointer-events-none">
                <Globe className="h-48 w-48 text-brand-emerald" />
              </div>
              <div className="flex items-start gap-5 relative z-10">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-brand-emerald/50 bg-gradient-to-br from-brand-emerald/30 to-brand-emerald/10 text-brand-emerald shadow-[inset_0_0_30px_rgba(16,185,129,0.2),0_0_20px_rgba(16,185,129,0.3)] transition-all duration-500 group-hover:scale-110 group-hover:bg-brand-emerald/40 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] group-hover:rotate-6">
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-emerald opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-emerald" />
                  </span>
                  <Globe className="h-8 w-8 stroke-[1.5]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-brand-emerald/80 drop-shadow-sm mb-2">{t.dash.card3Title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed font-normal">{t.dash.card3Desc}</p>
                  <AnimatePresence>
                    {hoveredCard === 2 && (
                      <motion.div key="c3" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} style={{ overflow: "hidden" }} className="mt-3 space-y-2">
                        <div className="bg-white/[0.03] rounded-lg p-3 border border-white/5 group-hover:border-white/10 transition-colors">
                          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{t.dash.whatIs}</div>
                          <p className="text-sm text-gray-300 leading-relaxed font-normal">{t.dash.card3What}</p>
                        </div>
                        <div className="bg-brand-emerald/[0.03] rounded-lg p-3 border border-brand-emerald/10 group-hover:border-brand-emerald/20 transition-colors">
                          <div className="text-xs font-bold text-brand-emerald uppercase tracking-wider mb-1 flex items-center gap-1.5"><Zap className="h-3 w-3" />{t.dash.valueForFounder}</div>
                          <p className="text-sm text-gray-300 leading-relaxed font-normal">{t.dash.card3Value}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

function AiCopilotSection() {
  const { t } = useLanguage();
  return (
    <motion.section
      id="copilot"
      initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-12 px-6 py-24 md:flex-row"
    >
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <Beams beamWidth={1.5} beamHeight={12} beamNumber={6} lightColor="#8b5cf6" speed={2} noiseIntensity={1.5} scale={0.15} rotation={60} className="size-full opacity-40 mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/50" />
      </div>
      <div className="flex-1 text-left relative z-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-400">
          <Cpu className="h-4 w-4" />
          {t.ai.badge}
        </div>
        <h2 className="font-display text-3xl font-bold text-white md:text-5xl">
          {t.ai.title1} <br />{t.ai.title2}
        </h2>
        <p className="mt-6 text-lg text-gray-400">{t.ai.desc}</p>
      </div>

      <div className="flex-1 w-full relative">
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-blue to-purple-600 opacity-30 blur-lg" />
        <motion.div
          initial="hidden" whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          variants={{ visible: { transition: { staggerChildren: 1.5 } }, hidden: {} }}
          className="relative flex w-full flex-col gap-4 rounded-2xl border border-white/10 bg-brand-surface/80 p-6 backdrop-blur-xl"
        >
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100 } } }}
            className="flex gap-4 origin-top-left"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
              <Zap className="h-5 w-5" />
            </div>
            <div className="rounded-xl rounded-tl-none bg-white/5 p-4 text-sm leading-relaxed text-gray-200">
              <span className="font-semibold text-white">{t.ai.aiName}</span>
              <p className="mt-1">{t.ai.aiText1}</p>
              <div className="mt-3 rounded border border-brand-emerald/30 bg-brand-emerald/10 p-3 leading-snug">
                <strong>{t.ai.aiSuggestLabel}</strong> {t.ai.aiSuggestText}
              </div>
              <p className="mt-3">{t.ai.aiQuestion}</p>
            </div>
          </motion.div>
          <motion.div
            variants={{ hidden: { opacity: 0, y: 10, scale: 0.95 }, visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100 } } }}
            className="flex flex-row-reverse gap-4 mt-2 origin-top-right"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue/20 text-brand-blue">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="rounded-xl rounded-tr-none bg-brand-blue/20 p-4 text-sm text-gray-100">
              {t.ai.userReply}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function WaitlistSection() {
  const { t } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState(false);
  const [step, setStep] = useState<"email" | "code" | "success">("email");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [initialCanvasVisible, setInitialCanvasVisible] = useState(true);
  const [reverseCanvasVisible, setReverseCanvasVisible] = useState(false);

  useEffect(() => {
    if (step === "code") setTimeout(() => codeInputRefs.current[0]?.focus(), 500);
  }, [step]);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(true);
      return;
    }
    setEmailError(false);
    setLoading(true);
    setErrorMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      setStep("code");
    } catch {
      setErrorMsg("Erro ao enviar código. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    if (value && index < 5) codeInputRefs.current[index + 1]?.focus();
    if (index === 5 && value && newCode.every((d) => d.length === 1)) {
      verifyCode(newCode.join(""));
    }
  };

  const verifyCode = async (token: string) => {
    setLoading(true);
    setErrorMsg("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
      if (error) throw error;
      setReverseCanvasVisible(true);
      setTimeout(() => setInitialCanvasVisible(false), 50);
      setTimeout(() => {
        setStep("success");
        setTimeout(() => router.push("/dashboard"), 2000);
      }, 1500);
    } catch {
      setErrorMsg("Código inválido. Tente novamente.");
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => codeInputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[index] && index > 0) codeInputRefs.current[index - 1]?.focus();
  };

  const handleBack = () => {
    setStep("email");
    setCode(["", "", "", "", "", ""]);
    setReverseCanvasVisible(false);
    setInitialCanvasVisible(true);
    setErrorMsg("");
  };

  return (
    <section id="credenciamento" className="relative w-full overflow-hidden bg-black py-20 md:py-28">
      <div className="absolute inset-0 z-0 pointer-events-none">
        {initialCanvasVisible && (
          <div className="absolute inset-0">
            <CanvasRevealEffect animationSpeed={3} containerClassName="bg-black" colors={[[16, 185, 129], [16, 185, 129]]} dotSize={3} showGradient={false} reverse={false} />
          </div>
        )}
        {reverseCanvasVisible && (
          <div className="absolute inset-0">
            <CanvasRevealEffect animationSpeed={4} containerClassName="bg-black" colors={[[16, 185, 129], [16, 185, 129]]} dotSize={3} showGradient={false} reverse={true} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/70 to-black/90" />
        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 lg:px-12">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-24 items-center">
          {/* Left editorial */}
          <div className="flex flex-col gap-7">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-emerald/25 bg-black/50 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-emerald">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-emerald opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-emerald" />
              </span>
              Programa de Credenciamento
            </div>
            <div className="space-y-4">
              <h2 className="font-display text-4xl font-bold text-white md:text-5xl lg:text-6xl leading-[1.08] tracking-tight">{t.waitlist.title}</h2>
              <p className="text-lg text-white/50 font-light leading-relaxed max-w-sm">{t.waitlist.subtitle}</p>
            </div>
            <ul className="space-y-4">
              {[
                { phase: "FASE 01", icon: <Coins className="h-4 w-4 text-brand-emerald" />, title: "Implementação de Tesouraria Assistida", desc: "Migração segura do caixa operacional para ativos digitais com rendimentos institucionais via Kamino, Robin Wood e Orca." },
                { phase: "FASE 02", icon: <ShieldCheck className="h-4 w-4 text-brand-emerald" />, title: "Certificação de Governança via IA", desc: "Auditoria contínua por agentes de IA, mantendo Compliance Score apto para investidores." },
                { phase: "FASE 03", icon: <Layers className="h-4 w-4 text-brand-emerald" />, title: "Reserva de Slot para Tokenização", desc: "Pipeline exclusivo para converter capital social em ativos digitais líquidos via Security Tokens na Solana." },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-emerald/10 border border-brand-emerald/25">{item.icon}</span>
                  <div>
                    <p className="text-[10px] font-bold text-brand-emerald/70 uppercase tracking-widest mb-0.5">{item.phase}</p>
                    <p className="text-sm font-semibold text-white/90 mb-0.5">{item.title}</p>
                    <p className="text-xs text-white/45 leading-relaxed">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-white/30 border-l-2 border-brand-emerald/30 pl-3 leading-relaxed">
              Processo seletivo. Vagas limitadas por ciclo trimestral.
            </p>
          </div>

          {/* Right form */}
          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8 shadow-[0_32px_64px_rgba(0,0,0,0.5)]">
              <AnimatePresence mode="wait">
                {step === "email" && (
                  <motion.div key="email-step" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <h3 className="font-display text-xl font-bold text-white">{t.waitlist.cardTitle}</h3>
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-emerald bg-brand-emerald/10 border border-brand-emerald/25 rounded-full px-2.5 py-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-emerald animate-pulse" />
                          Ciclo Aberto
                        </span>
                      </div>
                      <p className="text-xs text-white/45 leading-relaxed">{t.waitlist.cardSubtitle}</p>
                    </div>
                    <div className="h-px bg-white/[0.08]" />
                    <div className="space-y-3">
                      <p className="text-xs text-white/50 leading-relaxed">{t.waitlist.newsletterText}</p>
                      {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
                      <form onSubmit={handleEmailSubmit} className="space-y-2.5">
                        <input type="text" placeholder="Nome da empresa" className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 px-4 text-white placeholder-white/25 text-sm outline-none transition-all focus:ring-2 focus:ring-brand-emerald/40 focus:border-brand-emerald/40" />
                        <input
                          type="email" placeholder={t.waitlist.placeholder} value={email}
                          onChange={(e) => { setEmail(e.target.value); setEmailError(false); }}
                          className={`w-full rounded-xl border bg-white/5 py-2.5 px-4 text-white placeholder-white/25 text-sm outline-none transition-all focus:ring-2 focus:ring-brand-emerald/40 ${emailError ? "border-red-500/50" : "border-white/10 focus:border-brand-emerald/40"}`}
                        />
                        <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-emerald hover:bg-brand-emerald/90 disabled:opacity-60 text-black font-semibold py-3 text-sm transition-colors group">
                          {loading ? "Enviando..." : t.waitlist.cta}
                          {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                        </button>
                      </form>
                    </div>
                    <div className="flex items-center justify-between gap-1 py-1">
                      {[{ n: "①", label: "Solicitação" }, { n: "②", label: "Avaliação Técnica" }, { n: "③", label: "Onboarding" }].map((s, i, arr) => (
                        <div key={s.label} className="flex items-center gap-1">
                          <div className="flex flex-col items-center">
                            <span className="text-xs text-brand-emerald/70">{s.n}</span>
                            <span className="text-[10px] text-white/30 leading-tight text-center">{s.label}</span>
                          </div>
                          {i < arr.length - 1 && <div className="h-px w-6 bg-white/10 mt-[-8px] mx-0.5" />}
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3 w-3 text-white/20" />
                        <p className="text-[10px] text-white/20 uppercase tracking-widest">Infraestrutura</p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {["Solana", "Helius", "Ondo Finance", "Anthropic"].map((name) => (
                          <span key={name} className="text-[10px] font-medium text-white/35 border border-white/15 rounded px-2 py-0.5 tracking-wide">{name}</span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === "code" && (
                  <motion.div key="code-step" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35, ease: "easeOut" }} className="space-y-6">
                    <div className="space-y-1.5">
                      <h3 className="font-display text-2xl font-bold text-white">{t.waitlist.codeSentTitle}</h3>
                      <p className="text-sm text-white/50">{t.waitlist.codeSentSubtitle}</p>
                    </div>
                    {errorMsg && <p className="text-xs text-red-400 text-center">{errorMsg}</p>}
                    <div className="relative rounded-xl py-4 px-5 border border-white/10 bg-white/5">
                      <div className="flex items-center justify-center gap-1">
                        {code.map((digit, i) => (
                          <div key={i} className="flex items-center">
                            <div className="relative">
                              <input
                                ref={(el) => { codeInputRefs.current[i] = el; }}
                                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={1}
                                value={digit}
                                onChange={(e) => handleCodeChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                disabled={loading}
                                className="w-8 text-center text-xl bg-transparent text-white border-none focus:outline-none focus:ring-0 appearance-none"
                                style={{ caretColor: "transparent" }}
                              />
                              {!digit && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                  <span className="text-xl text-white/20">0</span>
                                </div>
                              )}
                            </div>
                            {i < 5 && <span className="text-white/20 text-xl mx-0.5">|</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <motion.p className="text-white/40 hover:text-white/70 transition-colors cursor-pointer text-sm text-center" whileHover={{ scale: 1.02 }}>
                      {t.waitlist.resendCode}
                    </motion.p>
                    <div className="flex gap-3">
                      <motion.button onClick={handleBack} className="rounded-xl bg-white/5 border border-white/10 text-white text-sm font-medium px-5 py-3 hover:bg-white/10 transition-colors w-[35%]" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        {t.waitlist.back}
                      </motion.button>
                      <motion.button
                        disabled={!code.every((d) => d !== "") || loading}
                        className={`flex-1 rounded-xl text-sm font-semibold py-3 border transition-all duration-300 ${code.every((d) => d !== "") && !loading ? "bg-brand-emerald text-black border-transparent hover:bg-brand-emerald/90 cursor-pointer" : "bg-white/5 text-white/30 border-white/10 cursor-not-allowed"}`}
                        whileHover={code.every((d) => d !== "") ? { scale: 1.02 } : {}}
                        whileTap={code.every((d) => d !== "") ? { scale: 0.98 } : {}}
                      >
                        {loading ? "Verificando..." : t.waitlist.continueCta}
                      </motion.button>
                    </div>
                    <p className="text-xs text-white/25 text-center">{t.waitlist.privacy}</p>
                  </motion.div>
                )}

                {step === "success" && (
                  <motion.div key="success-step" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut", delay: 0.3 }} className="space-y-6 text-center">
                    <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.5 }} className="py-6">
                      <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-brand-emerald to-brand-emerald/70 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4)]">
                        <CheckCircle2 className="h-10 w-10 text-black" />
                      </div>
                    </motion.div>
                    <div className="space-y-2">
                      <h3 className="font-display text-2xl font-bold text-white">{t.waitlist.successTitle}</h3>
                      <p className="text-sm text-white/50">{t.waitlist.successSubtitle}</p>
                    </div>
                    <motion.button
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
                      onClick={() => router.push("/dashboard")}
                      className="w-full rounded-xl bg-brand-emerald hover:bg-brand-emerald/90 text-black font-semibold py-3 transition-colors text-sm"
                    >
                      {t.waitlist.continueDashboard}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="w-full border-t border-white/5 bg-black py-12 relative z-20">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 md:flex-row">
        <a href="#" aria-label="TreasuryOS" className="flex items-baseline gap-0 leading-none select-none opacity-70 hover:opacity-100 transition-opacity duration-300">
          <span className="text-base tracking-widest font-light text-white" style={{ fontFamily: "'Inter', 'Manrope', 'Public Sans', system-ui, sans-serif", letterSpacing: "0.12em" }}>Treasury</span>
          <span className="text-base font-bold text-white" style={{ fontFamily: "'Inter', 'Manrope', 'Public Sans', system-ui, sans-serif", letterSpacing: "0.04em" }}>OS</span>
        </a>
        <div className="text-sm text-gray-500">© {new Date().getFullYear()} TreasuryOS. {t.footer.rights}</div>
      </div>
    </footer>
  );
}
