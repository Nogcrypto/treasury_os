/* Token Studio — emit equity tokens for SMBs (small caps tokenizadas) */

const TokenStudio = () => {
  const T = TOS.TOKEN;
  return (
    <div className="page">
      <PageHead
        crumb="WORKSPACE / TOKEN STUDIO"
        title="Token Studio · Capivara Labs"
        desc="Emita um token de equity da empresa, abasteça pool próprio e distribua dividendos onchain. Compliance e audit trail integrados ao Policy Engine."
        actions={<>
          <button className="btn"><Icon name="file" size={13}/>Whitepaper</button>
          <button className="btn"><Icon name="upload" size={13}/>Mintar tranche</button>
          <button className="btn primary"><Icon name="droplet" size={13}/>Adicionar liquidez</button>
        </>}
      />

      {/* Hero */}
      <div className="studio-hero">
        <div>
          <div className="row gap-s" style={{marginBottom: 6}}>
            <span className="tag cyan">SPL Token · Devnet</span>
            <span className="tag">Mint · 4Tk…CAPI</span>
            <span className="tag pos">Compliance · ok</span>
          </div>
          <h2>${T.symbol} · {T.name}</h2>
          <p>Equity tokenizada · governança 1 token = 1 voto · dividendos trimestrais via streaming. <strong style={{color: "var(--fg)"}}>Você</strong> controla supply, vesting e mecanismos de redenção.</p>
          <div className="row gap-l" style={{marginTop: 14}}>
            <div>
              <div className="mono-sm">Preço atual</div>
              <div className="mono" style={{fontSize: 22, fontWeight: 600, color: "var(--accent-2)"}}>${T.price.toFixed(3)}<span style={{fontSize: 11, color: "var(--pos)", marginLeft: 6}}>+4.20%</span></div>
            </div>
            <div>
              <div className="mono-sm">FDV</div>
              <div className="mono" style={{fontSize: 22, fontWeight: 600}}>{fmtUSD(T.fdv)}</div>
            </div>
            <div>
              <div className="mono-sm">Holders</div>
              <div className="mono" style={{fontSize: 22, fontWeight: 600}}>{T.holders}</div>
            </div>
            <div>
              <div className="mono-sm">Pool TVL</div>
              <div className="mono" style={{fontSize: 22, fontWeight: 600, color: "var(--accent)"}}>{fmtUSD(T.poolTvl)}</div>
            </div>
          </div>
        </div>
        <div className="token-mock">
          <div className="row between"><span className="h">${T.symbol}</span><span className="tag cyan">SPL</span></div>
          <div className="row between"><span>supply_total</span><span style={{color: "var(--fg)"}}>{fmt(T.supply)}</span></div>
          <div className="row between"><span>circulating</span><span style={{color: "var(--fg)"}}>{fmt(T.circulating)}</span></div>
          <div className="row between"><span>treasury_held</span><span style={{color: "var(--fg)"}}>{fmt(T.treasury)}</span></div>
          <div className="row between"><span>team_vested</span><span style={{color: "var(--fg)"}}>{fmt(T.team)}</span></div>
          <div className="row between"><span>in_pool</span><span style={{color: "var(--accent)"}}>{fmt(T.pool)}</span></div>
          <div style={{marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--line)", color: "var(--fg-3)", fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase"}}>vesting · 36 mo · cliff 6 · linear</div>
        </div>
      </div>

      {/* Pool */}
      <div className="split-2-1">
        <div className="panel">
          <div className="panel-head">
            <div className="left"><Icon name="droplet" size={13}/><span>Liquidity Pool · {T.poolPair}</span></div>
            <div className="row gap-s">
              <span className="tag">AMM 50/50</span>
              <span className="tag pos">APR LP 18.4%</span>
            </div>
          </div>
          <div className="panel-body">
            <div className="row gap-l" style={{marginBottom: 14}}>
              <div style={{flex: 1}}>
                <div className="mono-sm">Reserva CAPI</div>
                <div className="mono" style={{fontSize: 18, fontWeight: 600}}>1,650,000</div>
                <div className="bar" style={{marginTop: 8}}>
                  <div className="fill" style={{width: "50%", background: "var(--accent-2)"}}></div>
                </div>
              </div>
              <div style={{flex: 1}}>
                <div className="mono-sm">Reserva USDC</div>
                <div className="mono" style={{fontSize: 18, fontWeight: 600}}>679,800</div>
                <div className="bar" style={{marginTop: 8}}>
                  <div className="fill" style={{width: "50%", background: "var(--accent)"}}></div>
                </div>
              </div>
              <div style={{flex: 1}}>
                <div className="mono-sm">Volume 24h</div>
                <div className="mono" style={{fontSize: 18, fontWeight: 600}}>{fmtUSD(T.vol24)}</div>
                <div className="mono-sm" style={{color: "var(--pos)", marginTop: 6}}>+12.4% vs ontem</div>
              </div>
            </div>

            {/* Mini chart */}
            <div style={{height: 100, position: "relative", border: "1px solid var(--line)", borderRadius: 4, padding: "8px 12px", background: "var(--bg-2)"}}>
              <div className="mono-sm" style={{position: "absolute", top: 8, left: 12}}>preço {T.poolPair} · 24h</div>
              <svg viewBox="0 0 600 80" width="100%" height="80" preserveAspectRatio="none" style={{marginTop: 16}}>
                <defs>
                  <linearGradient id="poolGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0"/>
                  </linearGradient>
                </defs>
                <path d="M 0 60 L 30 55 L 60 58 L 90 50 L 120 48 L 150 52 L 180 44 L 210 42 L 240 38 L 270 34 L 300 36 L 330 32 L 360 28 L 390 30 L 420 24 L 450 22 L 480 18 L 510 20 L 540 16 L 570 14 L 600 12 L 600 80 L 0 80 Z" fill="url(#poolGrad)"/>
                <path d="M 0 60 L 30 55 L 60 58 L 90 50 L 120 48 L 150 52 L 180 44 L 210 42 L 240 38 L 270 34 L 300 36 L 330 32 L 360 28 L 390 30 L 420 24 L 450 22 L 480 18 L 510 20 L 540 16 L 570 14 L 600 12" fill="none" stroke="var(--accent-2)" strokeWidth="1.6"/>
              </svg>
            </div>
          </div>

          <div className="panel-head" style={{borderTop: "1px solid var(--line)"}}>
            <div className="left"><Icon name="cycle" size={13}/><span>Trades recentes</span></div>
            <span className="meta">live · helius webhook</span>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Hora</th><th>Lado</th><th className="num">Quantidade</th><th className="num">USDC</th><th>Wallet</th></tr>
            </thead>
            <tbody>
              {TOS.POOL_TRADES.map((t, i) => (
                <tr key={i}>
                  <td className="mono muted">{t.t}</td>
                  <td><span className={"tag " + (t.side === "buy" ? "pos" : "neg")}>{t.side.toUpperCase()}</span></td>
                  <td className="num">{t.amount}</td>
                  <td className="num">{t.usdc}</td>
                  <td className="mono muted">{t.who}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="col">
          <div className="panel">
            <div className="panel-head">
              <div className="left"><Icon name="user" size={13}/><span>Cap table</span></div>
              <span className="meta">{T.holders} holders</span>
            </div>
            {TOS.TOKEN_HOLDERS.map((h, i) => (
              <div className="alloc-row" key={i}>
                <div className="ico" style={{background: i === 0 ? "oklch(0.4 0.08 200)" : "var(--bg-3)"}}>
                  <Icon name={i === 0 ? "shield" : i === 1 ? "user" : i === 2 ? "droplet" : "user"} size={11}/>
                </div>
                <div>
                  <div style={{fontWeight: 500}}>{h.name}</div>
                  <div className="mono-sm" style={{textTransform: "none", letterSpacing: 0, marginTop: 1}}>{h.addr} · {h.role}</div>
                </div>
                <div className="num">{fmt(h.v)}</div>
                <div className="num muted">{h.pct.toFixed(1)}%</div>
                <div className="bar" style={{width: 60}}>
                  <div className="fill" style={{width: h.pct + "%", background: i === 0 ? "var(--accent-3)" : i === 2 ? "var(--accent)" : "var(--fg-3)"}}></div>
                </div>
                <button className="btn icon sm"><Icon name="chevronRight" size={11}/></button>
              </div>
            ))}
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="left"><Icon name="coins" size={13}/><span>Dividendos onchain</span></div>
              <span className="tag pos">APR efetivo {T.dividends.apr}%</span>
            </div>
            <div className="panel-body" style={{display: "grid", gap: 10}}>
              <div className="row between">
                <span className="mono-sm">Total distribuído</span>
                <span className="mono" style={{fontSize: 16, fontWeight: 600}}>{fmtUSD(T.dividends.totalPaid)}</span>
              </div>
              <div className="row between">
                <span className="mono-sm">Última epoch</span>
                <span className="mono">{T.dividends.lastEpoch}</span>
              </div>
              <div className="row between">
                <span className="mono-sm">Próxima distribuição</span>
                <span className="tag warn">em 23 dias</span>
              </div>
              <button className="btn primary" style={{justifyContent: "center", marginTop: 4}}>
                <Icon name="send" size={12}/> Distribuir 8,400 USDC
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="left"><Icon name="shield" size={13}/><span>Compliance · SMB Equity</span></div>
            </div>
            <div className="panel-body" style={{display: "grid", gap: 6, fontSize: 11.5}}>
              <div className="row gap-s"><Icon name="check" size={11} style={{color: "var(--pos)"}}/><span>KYC opcional por whitelist (off no devnet)</span></div>
              <div className="row gap-s"><Icon name="check" size={11} style={{color: "var(--pos)"}}/><span>Vesting on-chain · cliff 6mo · linear 36mo</span></div>
              <div className="row gap-s"><Icon name="check" size={11} style={{color: "var(--pos)"}}/><span>Transfer hooks · jurisdição BR/UE flag</span></div>
              <div className="row gap-s"><Icon name="check" size={11} style={{color: "var(--pos)"}}/><span>Audit trail integrado ao Policy Engine</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

window.TokenStudio = TokenStudio;
