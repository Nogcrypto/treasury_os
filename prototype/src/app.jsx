/* App root + router */

const App = () => {
  const [view, setView]            = React.useState("dashboard");
  const [theme, setTheme]          = React.useState(() => localStorage.getItem("tos-theme") || "dark");
  const [simulated, setSimulated]  = React.useState(true);
  const [onboarded, setOnboarded]  = React.useState(() => localStorage.getItem("tos-onboarded") === "1");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [kycDone, setKycDone]      = React.useState(() => localStorage.getItem("tos-kyc") === "1");
  const [tourStep, setTourStep]    = React.useState(null); // null = closed, 0..n = active

  const startTour  = () => { setTourStep(0); setView(TOUR_STEPS[0].view); };
  const nextTour   = () => {
    setTourStep(s => {
      const n = s + 1;
      if (n >= TOUR_STEPS.length) return null;
      setView(TOUR_STEPS[n].view);
      return n;
    });
  };
  const prevTour   = () => {
    setTourStep(s => {
      const n = Math.max(0, s - 1);
      setView(TOUR_STEPS[n].view);
      return n;
    });
  };
  const closeTour  = () => setTourStep(null);

  // Auto-start tour the first time after onboarding
  React.useEffect(() => {
    if (onboarded && localStorage.getItem("tos-tour-shown") !== "1") {
      const t = setTimeout(() => {
        startTour();
        localStorage.setItem("tos-tour-shown", "1");
      }, 600);
      return () => clearTimeout(t);
    }
  }, [onboarded]);

  const approveKYC = () => { localStorage.setItem("tos-kyc", "1"); setKycDone(true); };
  const resetKYC   = () => { localStorage.removeItem("tos-kyc"); setKycDone(false); };

  React.useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tos-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === "dark" ? "light" : "dark");
  const finishOnboarding = () => { localStorage.setItem("tos-onboarded", "1"); setOnboarded(true); };
  const resetOnboarding = () => { localStorage.removeItem("tos-onboarded"); setOnboarded(false); };

  // Tweaks integration
  const [tweaks, setTweak] = useTweaks ? useTweaks(/*EDITMODE-BEGIN*/{
    "accent": "mint",
    "density": "regular",
    "showTickerTape": true,
    "showGrid": true,
    "tabularNums": true,
    "fontPair": "inter+jetbrains"
  }/*EDITMODE-END*/) : [{}, () => {}];

  React.useEffect(() => {
    const root = document.documentElement;
    const accent = {
      mint:   "oklch(0.82 0.18 148)",
      cyan:   "oklch(0.78 0.13 200)",
      violet: "oklch(0.74 0.18 295)",
      amber:  "oklch(0.78 0.16 80)",
    }[tweaks.accent || "mint"];
    if (accent) root.style.setProperty("--accent", accent);
    if (tweaks.showGrid === false) {
      root.style.setProperty("--grid", "transparent");
    } else {
      root.style.removeProperty("--grid");
    }
  }, [tweaks.accent, tweaks.showGrid]);

  if (!onboarded) {
    return <Onboarding onDone={finishOnboarding} />;
  }

  let page;
  switch (view) {
    case "dashboard":   page = <Dashboard onOpenSimulator={() => setView("simulator")} onOpenCopilot={() => setView("copilot")} onOpenExecution={() => setDrawerOpen(true)} />; break;
    case "policy":      page = <Policy onOpenCopilot={() => setView("copilot")} />; break;
    case "copilot":     page = <Copilot onApprove={() => setView("simulator")} />; break;
    case "simulator":   page = <Simulator onApprove={() => setDrawerOpen(true)} />; break;
    case "execution":   page = <ExecutionPage openDrawer={() => setDrawerOpen(true)} />; break;
    case "tokenstudio":
      page = kycDone
        ? <TokenStudio />
        : <KYCFlow onApproved={approveKYC} />;
      break;
    case "buckets":     page = <PlaceholderPage view="Buckets" />; break;
    case "reports":     page = <PlaceholderPage view="Reporting" />; break;
    case "alerts":      page = <PlaceholderPage view="Alertas" />; break;
    default:            page = <Dashboard />;
  }

  return (
    <div className="app">
      <TickerTape items={TOS.TICKER_ITEMS} />
      <TopBar theme={theme} toggleTheme={toggleTheme} simulated={simulated} onConnect={resetOnboarding} onStartTour={startTour} />
      <Sidebar active={view} setActive={setView} simulated={simulated} setSimulated={setSimulated} />
      <main className="main" data-screen-label={`page · ${view}`}>{page}</main>

      {drawerOpen && <ExecutionDrawer onClose={() => setDrawerOpen(false)} simulated={simulated} />}

      {tourStep !== null && (
        <Tour
          step={tourStep}
          total={TOUR_STEPS.length}
          data={TOUR_STEPS[tourStep]}
          onNext={nextTour}
          onPrev={prevTour}
          onClose={closeTour}
        />
      )}

      {/* Tweaks panel */}
      {window.TweaksPanel && (
        <TweaksPanel title="Tweaks · TreasuryOS">
          <TweakSection label="Aparência">
            <TweakRadio
              label="Accent neon"
              value={tweaks.accent || "mint"}
              onChange={v => setTweak("accent", v)}
              options={[
                { value: "mint",   label: "Mint" },
                { value: "cyan",   label: "Cyan" },
                { value: "violet", label: "Violet" },
                { value: "amber",  label: "Amber" },
              ]}
            />
            <TweakToggle label="Grid de fundo"  value={tweaks.showGrid !== false} onChange={v => setTweak("showGrid", v)} />
            <TweakToggle label="Ticker tape"    value={tweaks.showTickerTape !== false} onChange={v => setTweak("showTickerTape", v)} />
            <TweakRadio
              label="Densidade"
              value={tweaks.density || "regular"}
              onChange={v => setTweak("density", v)}
              options={[{value: "compact", label: "Densa"}, {value: "regular", label: "Reg."}, {value: "comfy", label: "Espaç."}]}
            />
          </TweakSection>
          <TweakSection label="Demo">
            <TweakButton label="Iniciar tour guiado" onClick={startTour} />
            <TweakButton label="Reiniciar onboarding" onClick={() => { resetOnboarding(); resetKYC(); localStorage.removeItem("tos-tour-shown"); }} />
            <TweakButton label="Resetar KYC" onClick={resetKYC} />
            <TweakButton label="Abrir drawer de execução" onClick={() => setDrawerOpen(true)} />
            <TweakToggle label="Modo simulado" value={simulated} onChange={setSimulated} />
          </TweakSection>
        </TweaksPanel>
      )}
    </div>
  );
};

const PlaceholderPage = ({ view }) => (
  <div className="page">
    <PageHead crumb={`WORKSPACE / ${view.toUpperCase()}`} title={view} desc="Tela em construção — disponível na próxima leva." />
    <div className="panel" style={{padding: 40, textAlign: "center", color: "var(--fg-3)"}}>
      <Icon name="sparkles" size={20} />
      <div style={{marginTop: 8, fontFamily: "JetBrains Mono", letterSpacing: "0.05em"}}>módulo previsto · roadmap V1</div>
    </div>
  </div>
);

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
