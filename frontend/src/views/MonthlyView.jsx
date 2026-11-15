// PAGE 2.3 — Monthly rainfall shift: scenario vs baseline chart, trend confidence, AI insight, evapotranspiration.
import { useState } from 'react';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useClimateModel } from '../hooks/useClimateModel';
import { monthlyInsight } from '../utils/insights';
import { signed } from '../utils/format';
import { AiBadge, Loading, PageHead, PageNav, RegionStrip, SampleNotice } from '../components/ui';
import ScenarioControls from '../components/climate/ScenarioControls';
import MonthlyBarsChart from '../components/charts/MonthlyBarsChart';
import { SIG_TONE } from './ClimateView';
import '../components/climate/climate.css';

export const useMonths = () => {
  const t = useT();
  return Array.from({ length: 12 }, (_, i) => t(`month.${i}`));
};

export default function MonthlyView() {
  const t = useT();
  const { region } = useFarm();
  const { model: m, scenario } = useClimateModel();
  const months = useMonths();
  const [table, setTable] = useState(false);

  return (
    <section aria-labelledby="monthly-title">
      <PageHead id="monthly-title" eyebrow={t('eyebrow.climate', { n: 3 })} title={t('monthly.title')} sub={t('monthly.sub')}>
        <RegionStrip />
      </PageHead>

      {!m ? <Loading>{t('common.loading')}</Loading> : (
        <>
          <SampleNotice data={m.data} />
          <ScenarioControls compact />

          <section className="card chart-card" aria-labelledby="mchart-title">
            <div className="chart-card-head">
              <div>
                <h3 className="card-title" id="mchart-title">{t('monthly.chart')}</h3>
                <p className="card-sub">{t('monthly.chartSub', { rain: `${signed(scenario.rain)}%`, temp: `${signed(scenario.temp, 1)} °C` })}</p>
              </div>
              <div className="row">
                <div className="legend-row">
                  <span><i className="sw s1" />{t('monthly.base')}</span>
                  <span><i className="sw s2" />{t('monthly.scenario')}</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" aria-expanded={table} aria-controls="monthly-table"
                  onClick={() => setTable(v => !v)}>{table ? t('common.hideTable') : t('common.showTable')}</button>
              </div>
            </div>
            <MonthlyBarsChart months={months} base={m.base} scenario={m.monthly}
              label={t('monthly.aria', { region: t(`region.${region.id}.name`) })}
              labels={{ base: t('monthly.base'), scenario: t('monthly.scenario') }} />
            {table && (
              <div className="table-wrap" id="monthly-table">
                <table className="data-table">
                  <caption className="sr-only">{t('monthly.chart')}</caption>
                  <thead><tr><th scope="col">{t('common.month')}</th><th scope="col">{t('monthly.base')} (mm)</th><th scope="col">{t('monthly.scenario')} (mm)</th><th scope="col">{t('ind.diff')}</th></tr></thead>
                  <tbody>
                    {months.map((mo, i) => (
                      <tr key={mo}><th scope="row">{mo}</th><td>{m.base[i]}</td><td>{m.monthly[i]}</td><td dir="ltr">{signed(m.monthly[i] - m.base[i])}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="confidence">
              <b>{t('monthly.confidence')}</b>
              <span className={`badge badge-lg ${SIG_TONE[m.trend.sig]}`}>
                {m.trend.sig === 'clear' ? '✓ ' : ''}{t(`conf.${m.trend.sig}`)}
              </span>
              <span className="hint" style={{ margin: 0 }} dir="ltr">
                Mann–Kendall p = {m.trend.pMk.toFixed(3)} · OLS p = {m.trend.pOls.toFixed(3)}
              </span>
            </div>
          </section>

          <div className="insight-grid">
            <div className="ai-insight">
              <AiBadge />
              <p aria-live="polite">{monthlyInsight(t, months, m)}</p>
            </div>
            <div className="et-card">
              <h3><span aria-hidden="true">💨</span> {t('et.title')}</h3>
              <div className="et-value num" dir="ltr">{m.sc.et > 0 ? '+' : ''}{m.sc.et}%</div>
              <div className="et-meter" aria-hidden="true"><i style={{ width: `${Math.min(100, Math.max(0, m.sc.et) * 5)}%` }} /></div>
              <p className="hint" style={{ margin: 0 }}>{t('et.text')}</p>
            </div>
          </div>
        </>
      )}

      <PageNav back="extreme" next="top" />
    </section>
  );
}
