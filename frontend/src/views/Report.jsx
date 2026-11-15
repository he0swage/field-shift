// Printable agricultural report (hidden on screen; the only thing printed / saved as PDF).
import { useI18n } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { useClimateModel } from '../hooks/useClimateModel';
import { fmtCoord } from '../data/regions';
import { KEYS, PRIO } from '../utils/priorities';
import { fmtInt, signed } from '../utils/format';
import MonthlyBarsChart from '../components/charts/MonthlyBarsChart';
import NitrogenChart from '../components/charts/NitrogenChart';
import CompareTable from '../components/rotation/CompareTable';
import { useUsual } from './CompareView';
import { useMonths } from './MonthlyView';
import './Report.css';

export default function Report() {
  const { t, lang } = useI18n();
  const { state, region } = useFarm();
  const { ranking } = useAnalysis();
  const { model: m, scenario } = useClimateModel();
  const usual = useUsual();
  const months = useMonths();
  const name = t(`region.${region.id}.name`);
  const best = ranking?.rotations[0];
  const date = new Date().toLocaleDateString(lang === 'ar' ? 'ar' : lang, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <article className="report" aria-hidden="true">
      <header className="r-head">
        <div className="r-brand">🌾 Precision Crop Rotation Advisor</div>
        <h1>{t('report.title')}</h1>
        <p>{name}, {t(`country.${region.countryCode}`)} · {fmtCoord(region.lat, region.lon)} · {date}</p>
        {(ranking?.sample || m?.data.sample) && <p className="r-sample">{t('report.sample')}</p>}
      </header>

      <section>
        <h2>1. {t('sum.farm')}</h2>
        <table className="r-table"><tbody>
          <tr><th>{t('sum.region')}</th><td>{name} ({t(`country.${region.countryCode}`)})</td></tr>
          <tr><th>{t('region.coords')}</th><td>{fmtCoord(region.lat, region.lon)}</td></tr>
          <tr><th>{t('region.rain')}</th><td>{region.rain} mm/{t('unit.yr')}{region.est.includes('rain') ? ` (${t('common.estimate')})` : ''}</td></tr>
          {KEYS.map(k => <tr key={k}><th>{PRIO[k].icon} {t(`prio.${k}`)}</th><td>{state.priorities[k]} / 100</td></tr>)}
        </tbody></table>
      </section>

      <section>
        <h2>2. {t('sum.usual')}</h2>
        <p>{usual.map((c, i) => `${t('common.year', { n: i + 1 })}: ${c.name}`).join('  →  ')}</p>
      </section>

      {m && (
        <section>
          <h2>3. {t('sum.climate')}</h2>
          <table className="r-table"><tbody>
            <tr><th>{t('scen.rain')}</th><td>{signed(scenario.rain)}%</td><th>{t('scen.temp')}</th><td>{signed(scenario.temp, 1)} °C</td></tr>
            <tr><th>{t('ind.rainTrend')}</th><td>{signed(m.trend.decade, 1)} mm/{t('unit.decade')} ({t(`sig.${m.trend.sig}`)})</td><th>{t('sum.annualRain')}</th><td>{m.trend.mean} → {m.sc.rain} mm</td></tr>
            <tr><th>{t('ind.dry')}</th><td>{m.ind.longestDrySpell} → {m.sc.dry}</td><th>{t('ind.hot')}</th><td>{m.ind.hotDays} → {m.sc.hot}</td></tr>
            <tr><th>{t('ind.frost')}</th><td>{m.ind.frostDays} → {m.sc.frost}</td><th>{t('ind.extreme')}</th><td>{m.ind.extremeRainDays} → {m.sc.extreme}</td></tr>
          </tbody></table>
          <h3>{t('monthly.title')} — <span className="r-key s1" /> {t('monthly.base')} · <span className="r-key s2" /> {t('monthly.scenario')}</h3>
          <MonthlyBarsChart months={months} base={m.base} scenario={m.monthly} fixedWidth={680}
            label={t('monthly.title')} labels={{ base: t('monthly.base'), scenario: t('monthly.scenario') }} />
        </section>
      )}

      {ranking && (
        <>
          <section className="r-break">
            <h2>4. {t('top.title')}</h2>
            <p>{t('top.confidence', { pct: ranking.monteCarlo.rank1StaysFirstPct })}</p>
            <table className="r-table r-grid">
              <thead><tr><th>#</th><th>{t('top.rotation')}</th><th>{t('rank.score')}</th><th>{t('rank.water')}</th><th>{t('rank.ndvi')}</th><th>{t('rank.fert3')}</th><th>{t('rank.income')}</th></tr></thead>
              <tbody>{ranking.rotations.map(r => (
                <tr key={r.rank}><td>{r.rank}</td><td>{r.crops.join(' → ')}</td><td>{r.scores.final}</td><td>{r.waterNeed}</td><td>{r.ndviStability}</td><td>{r.fertilizer} kg/ha</td><td>{fmtInt(r.income)} DA</td></tr>
              ))}</tbody>
            </table>

            <h3>{t('report.rank1')}: {best.crops.join(' → ')}</h3>
            <table className="r-table r-grid">
              <thead><tr><th>{t('common.yearCol')}</th><th>{t('report.crop')}</th><th>{t('rank.soilN')}</th><th>{t('rank.health')}</th><th>{t('rank.fert')}</th><th>{t('rank.risks')}</th></tr></thead>
              <tbody>{best.years.map((y, i) => (
                <tr key={i}><td>{i + 1}</td><td>{y.crop}{y.nCredit ? ` (${t('rank.nCredit')} −${y.nCredit}%)` : ''}</td><td>{y.soilN} kg/ha</td><td>{y.health}%</td><td>{y.fertilizer} ({y.kg} kg/ha)</td><td>{y.risks.join(' ')}</td></tr>
              ))}</tbody>
            </table>
            {best.fertilizerSaved > 0 && <p>{t('rank.saves', { kg: best.fertilizerSaved })}</p>}
          </section>

          <section>
            <h2>5. {t('avoid.title')}</h2>
            <ul>{ranking.avoid.map(a => (
              <li key={a.crops.join()}><b>{a.crops.join(' → ')}</b> ({a.score}/100) — {[a.reason, a.climate, a.soil, a.water, a.disease].filter(Boolean).join(' ')}</li>
            ))}</ul>
          </section>

          <section>
            <h2>6. {t('sum.vs')}</h2>
            <CompareTable ranking={ranking} usualName={usual.map(c => c.name).join(' → ')} />
            <NitrogenChart years={best.years} usualEnd={ranking.usual?.soilNEnd} fixedWidth={560}
              labels={{ aria: t('n.title'), year: n => t('common.year', { n }), rec: t('n.rec'), usual: t('n.usualShort'), usualLegend: t('n.usual') }} />
          </section>
        </>
      )}

      <section className="r-break-avoid">
        <h2>{ranking ? 7 : 4}. {t('report.method')}</h2>
        <ul>
          <li>{t('about.m1')}</li><li>{t('about.m2')}</li><li>{t('about.m3')}</li><li>{t('about.m4')}</li>
        </ul>
        <p><b>{t('about.sources')}:</b> NASA POWER 1995–2024 · ISRIC SoilGrids · MODIS NDVI · OAIC / CCLS Prices</p>
      </section>
    </article>
  );
}
