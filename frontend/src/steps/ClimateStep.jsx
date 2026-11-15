// Step 5 — real NASA POWER 1995-2024 rainfall, ERA5 crosscheck, Fire Watch banner & card,
// what-if scenario, and experimental SARIMA outlook (with Metric/US unit toggle).
import { useMemo, useState } from 'react';
import { MONTHS } from '../data/sampleClimate';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { useClimate } from '../hooks/useData';
import { applyScenario, rainTrend } from '../utils/agronomy';
import { convRain, fmtCoord, fmtRain, fmtRainTrend, fmtTemp, fmtTempDelta, rainUnit, signed } from '../utils/format';
import { StepHead, StepNav } from '../components/Layout';
import { Alert, ConfBadge, Loading, SampleNotice } from '../components/ui';
import FireWatchCard, { FireWatchBanner } from '../components/FireWatchCard';
import AnnualLineChart from '../components/charts/AnnualLineChart';
import MonthlyBarsChart from '../components/charts/MonthlyBarsChart';
import './ClimateStep.css';

const BADGE = {
  clear: ['sig', '● Clear trend · both tests agree'],
  weak: ['weak', '◐ Weak trend'],
  none: ['none', '○ No clear trend'],
};

function Delta({ now, base, unit }) {
  const d = Math.round((now - base) * 10) / 10;
  return <span className="delta">{d === 0 ? 'no change' : `${d > 0 ? '▲ +' : '▼ '}${d}${unit} vs baseline`}</span>;
}

function ScenarioCard() {
  const { state, set } = useFarm();
  const toast = useToast();
  const s = state.scenario;
  const units = state.units;
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
          <p className="sub" style={{ marginBottom: 0 }}>Test a different future. Everything below — and Step 6 rankings — updates as you move the sliders.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={reset}>↺ Today’s climate</button>
      </div>
      <div className="scenario">
        <div>
          <div className="scen-head"><label htmlFor="rainS">🌧️ Rainfall change</label><output htmlFor="rainS">{signed(s.rain)}%</output></div>
          <input
            type="range"
            id="rainS"
            min="-50"
            max="30"
            step="5"
            value={s.rain}
            aria-valuetext={`${s.rain} percent rainfall change`}
            onChange={e => set({ scenario: { ...s, rain: +e.target.value } })}
          />
          <div className="scale"><span>−50% drier</span><span>0</span><span>+30% wetter</span></div>
        </div>
        <div>
          <div className="scen-head">
            <label htmlFor="tempS">🌡️ Temperature change</label>
            <output htmlFor="tempS">{fmtTempDelta(s.temp, units)}</output>
          </div>
          <input
            type="range"
            id="tempS"
            min="0"
            max="4"
            step="0.5"
            value={s.temp}
            aria-valuetext={`${fmtTempDelta(s.temp, units)} warmer`}
            onChange={e => set({ scenario: { ...s, temp: +e.target.value } })}
          />
          <div className="scale">
            <span>today</span>
            <span>{fmtTempDelta(2, units)}</span>
            <span>{fmtTempDelta(4, units)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ClimateStep() {
  const { state, region } = useFarm();
  const { data: climate, loading } = useClimate(state.region);
  const [showTable, setShowTable] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const { scenario, units } = state;
  const rUnit = rainUnit(units);

  const view = useMemo(() => {
    if (!climate) return null;
    const trend = rainTrend(climate.annual);
    const ind = climate.indicators;
    const sc = applyScenario(ind, trend.mean, scenario);
    const base = climate.monthly;
    const monthly = base.map(v => Math.round(v * (1 + scenario.rain / 100)));
    return { trend, ind, sc, base, monthly };
  }, [climate, scenario]);

  const v2 = climate?.v2Indicators;
  const txt = climate?.climateText;
  const forecast = climate?.forecast;

  return (
    <section aria-labelledby="t5">
      <StepHead
        id="t5"
        eyebrow="Step 5 of 6 · Climate & Fire Watch"
        title={`Rainfall & extremes in ${region.areaName}`}
        badges={
          <>
            {region.lessValidated && <span className="role-pill role-light">Less validated</span>}
            <span className={`sys-pill sys-${region.farmingSystem}`}>
              {region.farmingSystem === 'irrigated' ? '💧 Irrigated' : '🌧️ Rainfed'}
            </span>
          </>
        }
      >
        How rain and heat have changed since 1995 at <b>{region.name} · {fmtCoord(region.lat, region.lon)}</b>,
        and what a drier, hotter future could mean. Data: NASA POWER 1995–2024 + Open-Meteo ERA5 + NASA FIRMS.
      </StepHead>

      {/* Section 3.4: If there are fire detections, show an in-app banner on the Climate screen */}
      <FireWatchBanner regionId={state.region} />

      {region.isIrrigated && (
        <Alert tone="warn" icon="💧" style={{ marginBottom: 18 }}>
          <b>Water stress is based on rainfall. Irrigated farms may differ.</b>
          {' '}({region.name} uses canal and tube-well irrigation outside the monsoon window.)
        </Alert>
      )}

      <div aria-live="polite">
        {loading && !climate && <Loading>Loading 30 years of rainfall for {region.name}…</Loading>}
        <SampleNotice data={climate} />
      </div>

      {view && (
        <div className="grid" aria-busy={loading}>
          <ScenarioCard />

          <div className="climate-cards">
            {[
              [
                '🌧️',
                'Yearly rainfall',
                fmtRain(view.sc.rain, units),
                <Delta now={convRain(view.sc.rain, units)} base={convRain(view.trend.mean, units)} unit={` ${rUnit}`} />,
                `${fmtRainTrend(view.trend.decade, units)} since ${climate.annual[0].year}. ${v2?.rainfall_30yr_mean_mm?.crosscheck_value ? `ERA5 30-yr mean: ${fmtRain(v2.rainfall_30yr_mean_mm.crosscheck_value, units)}.` : ''}`,
                BADGE[view.trend.sig],
                v2?.rainfall_mm?.confidence,
              ],
              [
                '☀️',
                `Hot days (> ${fmtTemp(region.hotThresholdC, units)})`,
                `${view.sc.hot} days/yr`,
                <Delta now={view.sc.hot} base={view.ind.hotDays} unit=" days" />,
                txt?.hot_days?.en || 'Grain filling heat can shrivel late cereal harvests.',
                null,
                v2?.hot_days?.confidence,
              ],
              [
                '❄️',
                `Frost nights (< ${fmtTemp(region.thresholds?.frost_night_c ?? 0, units)})`,
                `${view.sc.frost} nights/yr`,
                <Delta now={view.sc.frost} base={view.ind.frostDays} unit=" nights" />,
                txt?.frost_days?.en || 'Spring frost can damage early flowers on pulses and winter cereals.',
                null,
                v2?.frost_days?.confidence,
              ],
              [
                '⛈️',
                `Heavy rain (> ${fmtRain(region.extremeRainThresholdMm, units)}/day)`,
                `${view.sc.extreme} days/yr`,
                <Delta now={view.sc.extreme} base={view.ind.extremeRainDays} unit=" days" />,
                txt?.extreme_rain_days?.en || 'Downpours wash away bare topsoil if no stubble or cover remains.',
                null,
                v2?.extreme_rain_days?.confidence,
              ],
              [
                '🏜️',
                'Longest dry spell',
                `${view.sc.dry} days`,
                <Delta now={view.sc.dry} base={view.ind.longestDrySpell} unit=" days" />,
                txt?.longest_dry_spell_days?.en || 'Growing-season dry gaps favour deep-rooted or early-maturing crops.',
                null,
                v2?.longest_dry_spell_days?.confidence,
              ],
              [
                '💨',
                'Crop water demand',
                `${signed(view.sc.waterDemand)}%`,
                <span className="delta">evapotranspiration</span>,
                'Warmer air pulls more water out of plants and topsoil (+4% ET0 per °C).',
                null,
                null,
              ],
            ].map(([ic, k, v, delta, note, badge, conf]) => (
              <div className="metric" key={k}>
                <div className="k"><span aria-hidden="true">{ic}</span>{k}{conf && <ConfBadge level={conf} />}</div>
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
              30-yr mean <b>{fmtRain(view.trend.mean, units)}/yr</b> (2015–24: <b>{fmtRain(region.rain10yr, units, 1)}/yr</b>) · trend <b>{fmtRainTrend(view.trend.decade, units)}</b> ·
              OLS p = {view.trend.pOls.toFixed(3)}, Mann–Kendall p = {(v2?.rainfall_trend?.mk_p ?? view.trend.pMk).toFixed(4)}
            </p>
            <AnnualLineChart
              series={climate.annual}
              trend={view.trend}
              label={`Yearly rainfall, average ${fmtRain(view.trend.mean, units)}, trend ${fmtRainTrend(view.trend.decade, units)}`}
            />
            <div className="legend-row" aria-hidden="true">
              <span><i className="sw s1" />Yearly rainfall (NASA POWER)</span>
              <span><i className="sw trend-sw" />OLS Trend</span>
              <span><i className="sw" style={{ background: '#d9381e', borderRadius: '50%' }} />Acute drought shock year (≤ {fmtRain(view.trend.shockThreshold, units)})</span>
            </div>
            {txt?.rainfall_source_disagreement?.en && (
              <Alert tone="warn" icon="ℹ️" style={{ marginTop: 14 }}>{txt.rainfall_source_disagreement.en}</Alert>
            )}
          </div>

          {/* Problematic 3 Fix: Proactive Drought Shock Frequency & Anomaly Year Early-Warning Card */}
          <div className="card tinted" aria-labelledby="droughtShockHeading">
            <div className="head-row">
              <div>
                <h3 id="droughtShockHeading">🚨 Drought Shock Frequency &amp; Historical Anomaly Early-Warning</h3>
                <p className="sub" style={{ marginBottom: 0 }}>
                  A 30-year trend line hides year-to-year volatility. Below are the exact historical drought shock years
                  (rainfall ≤ <b>{fmtRain(view.trend.shockThreshold, units)}</b>) and recurrence frequency in <b>{region.areaName}</b>.
                </p>
              </div>
              <span className="badge sig">
                ⚡ 1 shock every ~{view.trend.returnPeriodYrs} years ({view.trend.shockCount}/30 yrs)
              </span>
            </div>

            <div className="climate-cards" style={{ marginTop: 12, marginBottom: 14 }}>
              <div className="metric">
                <div className="k">📉 Sen’s Slope Drying Velocity</div>
                <div className="v">{fmtRainTrend(v2?.rainfall_trend?.sen_slope_mm_per_decade ?? view.trend.senDecade, units)}</div>
                <div className="note" style={{ marginTop: 6 }}>
                  Non-parametric Theil–Sen drying rate (Mann–Kendall p = {(v2?.rainfall_trend?.mk_p ?? view.trend.pMk).toFixed(4)}).
                </div>
              </div>
              <div className="metric">
                <div className="k">⏳ Drought Return Period</div>
                <div className="v">1 in {view.trend.returnPeriodYrs} yrs</div>
                <div className="note" style={{ marginTop: 6 }}>
                  <b>{view.trend.recentShocks}</b> of the last 10 years were acute drought shocks (≤ {fmtRain(view.trend.shockThreshold, units)}).
                </div>
              </div>
              <div className="metric">
                <div className="k">📊 Inter-Annual Volatility (σ)</div>
                <div className="v">±{fmtRain(view.trend.stdDev, units)}</div>
                <div className="note" style={{ marginTop: 6 }}>
                  Standard deviation around the {fmtRain(view.trend.mean, units)} 30-year mean.
                </div>
              </div>
            </div>

            {view.trend.shockYears?.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: '0.92rem' }}>
                  Flagged Historical Dry Anomaly Years ({ climate.annual[0].year }–{ climate.annual.at(-1).year }):
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {view.trend.shockYears.map(sy => (
                    <span
                      key={sy.year}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '5px 10px',
                        borderRadius: '999px',
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        background: sy.severity === 'severe' ? 'var(--danger-soft)' : 'var(--warn-soft, #fff4e5)',
                        color: sy.severity === 'severe' ? 'var(--danger)' : 'var(--ink)',
                        border: `1.5px solid ${sy.severity === 'severe' ? 'var(--danger)' : '#e6a100'}`,
                      }}
                      title={`${sy.year}: ${sy.rain} mm (${sy.deficitPct}% vs 30-yr mean)`}
                    >
                      {sy.severity === 'severe' ? '🔴' : '🟠'} <b>{sy.year}</b>: {fmtRain(sy.rain, units)} ({sy.deficitPct}%)
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="head-row">
              <div>
                <h3>Monthly rainfall: today vs scenario</h3>
                <p className="sub" style={{ marginBottom: 0 }}>30-yr mean rain each month ({rUnit}). Hover or tap a month for exact values.</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                aria-expanded={showTable}
                aria-controls="monthlyTable"
                onClick={() => setShowTable(v => !v)}
              >
                {showTable ? 'Hide table' : 'Show as table'}
              </button>
            </div>
            <div className="legend-row">
              <span><i className="sw s1" />Today (baseline)</span>
              <span><i className="sw s2" />Scenario</span>
            </div>
            <MonthlyBarsChart
              months={MONTHS}
              base={view.base}
              scenario={view.monthly}
              label={`Monthly rainfall, baseline versus scenario ${scenario.rain}% rain and ${fmtTempDelta(scenario.temp, units)}`}
            />
            {showTable && (
              <div id="monthlyTable" className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col">Baseline ({rUnit})</th>
                      <th scope="col">Scenario ({rUnit})</th>
                      <th scope="col">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS.map((m, i) => {
                      const b = convRain(view.base[i], units);
                      const s = convRain(view.monthly[i], units);
                      const diff = Math.round((s - b) * 10) / 10;
                      return (
                        <tr key={m}>
                          <th scope="row">{m}</th>
                          <td>{b}</td>
                          <td>{s}</td>
                          <td>{signed(diff, units === 'imperial' ? 1 : 0)} {rUnit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <FireWatchCard regionId={state.region} />

          {forecast?.projection?.length > 0 && (
            <div className="card tinted">
              <div className="head-row">
                <div>
                  <h3>Experimental 24-month seasonal outlook ({forecast.modelType})</h3>
                  <p className="sub" style={{ marginBottom: 0 }}>
                    {forecast.note} <ConfBadge level="low" />
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  aria-expanded={showForecast}
                  onClick={() => setShowForecast(v => !v)}
                >
                  {showForecast ? 'Hide 24-month projection' : 'Show 24-month projection'}
                </button>
              </div>
              {showForecast && (
                <div className="table-wrap" style={{ marginTop: 14 }}>
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col">Projected mean ({rUnit})</th>
                        <th scope="col">80% Lower bound ({rUnit})</th>
                        <th scope="col">80% Upper bound ({rUnit})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecast.projection.slice(0, 12).map(row => (
                        <tr key={row.date}>
                          <th scope="row">{row.date}</th>
                          <td>{convRain(row.mean_mm, units)}</td>
                          <td>{convRain(row.lower_mm, units)}</td>
                          <td>{convRain(row.upper_mm, units)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <StepNav back={{ to: 4, label: '← Back to review' }} next={{ to: 6, label: '🌾 See recommended rotations →' }} />
    </section>
  );
}
