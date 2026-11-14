// Step 5 — rainfall on the farmer's land: what-if scenario, indicators, yearly + monthly charts.
import { useMemo, useState } from 'react';
import { MONTHS } from '../data/sampleClimate';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { useClimate } from '../hooks/useData';
import { applyScenario, rainTrend } from '../utils/agronomy';
import { signed } from '../utils/format';
import { StepHead, StepNav } from '../components/Layout';
import { Alert, Loading, SampleNotice } from '../components/ui';
import AnnualLineChart from '../components/charts/AnnualLineChart';
import MonthlyBarsChart from '../components/charts/MonthlyBarsChart';
import './ClimateStep.css';

const BADGE = {
  clear: ['sig', '● Clear trend · both tests agree'],
  weak: ['weak', '◐ Weak trend'],
  none: ['none', '○ No clear trend'],
};

function Delta({ now, base, unit }) {
  const d = now - base;
  return <span className="delta">{d === 0 ? 'no change' : `${d > 0 ? '▲ +' : '▼ '}${d}${unit} vs today`}</span>;
}

function ScenarioCard() {
  const { state, set } = useFarm();
  const toast = useToast();
  const s = state.scenario;
  const reset = () => {
    const prev = s;
    set({ scenario: { rain: 0, temp: 0 } });
    toast('Scenario reset to today’s climate.', () => set({ scenario: prev }));
  };
  return (
    <div className="card tinted">
      <div className="head-row">
        <div>
          <h3>What-if scenario</h3>
          <p className="sub" style={{ marginBottom: 0 }}>Test a different future. Everything below updates as you move the sliders.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reset}>↺ Today’s climate</button>
      </div>
      <div className="scenario">
        <div>
          <div className="scen-head"><label htmlFor="rainS">🌧️ Rainfall change</label><output htmlFor="rainS">{signed(s.rain)}%</output></div>
          <input type="range" id="rainS" min="-50" max="30" step="5" value={s.rain} aria-valuetext={`${s.rain} percent rainfall change`}
            onChange={e => set({ scenario: { ...s, rain: +e.target.value } })} />
          <div className="scale"><span>−50% drier</span><span>0</span><span>+30% wetter</span></div>
        </div>
        <div>
          <div className="scen-head"><label htmlFor="tempS">🌡️ Temperature change</label><output htmlFor="tempS">{signed(s.temp, 1)} °C</output></div>
          <input type="range" id="tempS" min="0" max="4" step="0.5" value={s.temp} aria-valuetext={`${s.temp} degrees warmer`}
            onChange={e => set({ scenario: { ...s, temp: +e.target.value } })} />
          <div className="scale"><span>today</span><span>+2 °C</span><span>+4 °C</span></div>
        </div>
      </div>
    </div>
  );
}

export default function ClimateStep() {
  const { state, region } = useFarm();
  const { data: climate, loading } = useClimate(state.region);
  const [showTable, setShowTable] = useState(false);
  const { scenario } = state;

  const view = useMemo(() => {
    if (!climate) return null;
    const trend = rainTrend(climate.annual);
    const ind = climate.indicators;
    const sc = applyScenario(ind, trend.mean, scenario);
    const base = climate.monthly;
    const monthly = base.map(v => Math.round(v * (1 + scenario.rain / 100)));
    return { trend, ind, sc, base, monthly };
  }, [climate, scenario]);

  return (
    <section aria-labelledby="t5">
      <StepHead id="t5" eyebrow="Step 5 of 6 · Results" title="Rainfall on your land">
        How rain and heat have changed since 1995 at <b>{region.name} · {region.lat.toFixed(2)}° N, {region.lon.toFixed(2)}° E</b>,
        and what a drier, hotter future could mean. Data: NASA POWER 1995–2024.
      </StepHead>

      <div aria-live="polite">
        {loading && !climate && <Loading>Loading 30 years of rainfall for {region.name}…</Loading>}
        <SampleNotice data={climate} />
      </div>

      {view && (
        <div className="grid" aria-busy={loading}>
          <ScenarioCard />

          <div className="climate-cards">
            {[
              ['🌧️', 'Yearly rainfall', `${view.sc.rain} mm`, <Delta now={view.sc.rain} base={view.trend.mean} unit=" mm" />,
                `${signed(view.trend.decade, 1)} mm per decade since ${climate.annual[0].year}. ${view.trend.slope < 0 ? 'Less rain means low-thirst crops are safer.' : 'Rain is stable or rising.'}`,
                BADGE[view.trend.sig]],
              ['☀️', 'Hot days (> 35 °C)', `${view.sc.hot} days/yr`, <Delta now={view.sc.hot} base={view.ind.hotDays} unit=" days" />, 'Heat during grain filling can shrivel late cereal harvests.'],
              ['❄️', 'Frost days (< 0 °C)', `${view.sc.frost} days/yr`, <Delta now={view.sc.frost} base={view.ind.frostDays} unit=" days" />, 'Spring frost can damage early flowers on peas, lentils and faba beans.'],
              ['⛈️', 'Heavy rain (> 20 mm/day)', `${view.sc.extreme} days/yr`, <Delta now={view.sc.extreme} base={view.ind.extremeRainDays} unit=" days" />, 'Downpours wash away bare topsoil if no stubble or cover remains.'],
              ['🏜️', 'Longest dry spell', `${view.sc.dry} days`, <Delta now={view.sc.dry} base={view.ind.longestDrySpell} unit=" days" />, 'Long dry gaps favour deep-rooted or early-maturing crops.'],
              ['💨', 'Crop water demand', `${signed(view.sc.waterDemand)}%`, <span className="delta">evapotranspiration</span>, 'Warmer air pulls more water out of plants and topsoil.'],
            ].map(([ic, k, v, delta, note, badge]) => (
              <div className="metric" key={k}>
                <div className="k"><span aria-hidden="true">{ic}</span>{k}</div>
                <div className="v">{v}</div>
                {delta}
                {badge && <div style={{ marginTop: 8 }}><span className={`badge ${badge[0]}`}>{badge[1]}</span></div>}
                <div className="note" style={{ marginTop: 8 }}>{note}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h3>Yearly rainfall, {climate.annual[0].year}–{climate.annual.at(-1).year}</h3>
            <p className="sub">
              Average <b>{view.trend.mean} mm/yr</b> · trend <b>{view.trend.decade.toFixed(1)} mm/decade</b> ·
              OLS p = {view.trend.pOls.toFixed(3)}, Mann–Kendall p = {view.trend.pMk.toFixed(3)}
            </p>
            <AnnualLineChart series={climate.annual} trend={view.trend}
              label={`Yearly rainfall, average ${view.trend.mean} mm, trend ${view.trend.decade.toFixed(1)} mm per decade`} />
            <div className="legend-row" aria-hidden="true">
              <span><i className="sw s1" />Yearly rainfall</span>
              <span><i className="sw trend-sw" />Trend</span>
            </div>
          </div>

          <div className="card">
            <div className="head-row">
              <div>
                <h3>Monthly rainfall: today vs scenario</h3>
                <p className="sub" style={{ marginBottom: 0 }}>Average rain each month (mm). Hover or tap a month for exact values.</p>
              </div>
              <button type="button" className="btn btn-secondary" aria-expanded={showTable} aria-controls="monthlyTable"
                onClick={() => setShowTable(v => !v)}>{showTable ? 'Hide table' : 'Show as table'}</button>
            </div>
            <div className="legend-row">
              <span><i className="sw s1" />Today (baseline)</span>
              <span><i className="sw s2" />Scenario</span>
            </div>
            <MonthlyBarsChart months={MONTHS} base={view.base} scenario={view.monthly}
              label={`Monthly rainfall, baseline versus scenario ${scenario.rain}% rain and +${scenario.temp} °C`} />
            {showTable && (
              <div id="monthlyTable" className="table-wrap">
                <table>
                  <thead><tr><th scope="col">Month</th><th scope="col">Baseline (mm)</th><th scope="col">Scenario (mm)</th><th scope="col">Change</th></tr></thead>
                  <tbody>
                    {MONTHS.map((m, i) => (
                      <tr key={m}><th scope="row">{m}</th><td>{view.base[i]}</td><td>{view.monthly[i]}</td><td>{signed(view.monthly[i] - view.base[i])}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <MonthlyInsight monthly={view.monthly} />
          </div>
        </div>
      )}

      <StepNav back={{ to: 4, label: '← Back to review' }} next={{ to: 6, label: 'Next: best rotations →' }} />
    </section>
  );
}

function MonthlyInsight({ monthly }) {
  const wet = MONTHS.filter((_, i) => monthly[i] >= 40);
  const sowing = monthly[9] + monthly[10]; // Oct + Nov
  return (
    <Alert tone="ok" icon="🧭">
      In this scenario, <b>{wet.length} months</b> get 40 mm or more ({wet.join(', ') || 'none'}).
      Autumn sowing rain (Oct + Nov) is <b>{sowing} mm</b>
      {sowing < 70 ? ' — sow on stored moisture and prefer early, drought-tolerant varieties.' : ', enough for normal autumn sowing.'}
    </Alert>
  );
}
