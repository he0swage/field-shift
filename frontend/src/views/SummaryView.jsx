// PAGE 4.1 — Your personalized farming strategy: full recap + PDF report.
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { useClimateModel } from '../hooks/useClimateModel';
import { fmtCoord } from '../data/regions';
import { FAMILY_ICON } from '../data/crops';
import { KEYS, PRIO } from '../utils/priorities';
import { signed } from '../utils/format';
import { PageHead, PageNav, SampleNotice } from '../components/ui';
import RotationCard from '../components/rotation/RotationCard';
import CompareTable from '../components/rotation/CompareTable';
import MonthlyBarsChart from '../components/charts/MonthlyBarsChart';
import NeedsAnalysis from '../components/NeedsAnalysis';
import ExportButton from '../components/ExportButton';
import { NitrogenCard, useUsual } from './CompareView';
import { useMonths } from './MonthlyView';
import '../components/climate/climate.css';
import './Results.css';

function Section({ n, title, children, id }) {
  return (
    <section className="sum-section" aria-labelledby={id}>
      <h3 className="sum-title" id={id}><span className="sum-num" aria-hidden="true">{n}</span>{title}</h3>
      {children}
    </section>
  );
}

export default function SummaryView() {
  const t = useT();
  const { state, region } = useFarm();
  const { ranking } = useAnalysis();
  const { model: m, scenario } = useClimateModel();
  const usual = useUsual();
  const months = useMonths();

  return (
    <section aria-labelledby="sum-page-title">
      <PageHead id="sum-page-title" eyebrow={t('eyebrow.results')} title={t('sum.title')} sub={t('sum.sub')} />

      <Section n="1" id="s1" title={t('sum.farm')}>
        <dl className="facts-grid">
          <div><dt>{t('sum.region')}</dt><dd>{t(`region.${region.id}.name`)}</dd></div>
          <div><dt>{t('sum.country')}</dt><dd>{t(`country.${region.countryCode}`)}</dd></div>
          <div><dt>{t('region.coords')}</dt><dd dir="ltr">{fmtCoord(region.lat, region.lon)}</dd></div>
          <div><dt>{t('region.rain')}</dt><dd>{region.est.includes('rain') ? '≈ ' : ''}{region.rain} mm/{t('unit.yr')}</dd></div>
        </dl>
        <div className="prio-chips">
          {KEYS.map(k => (
            <span key={k} className="prio-chip" style={{ '--c': PRIO[k].color }}>
              <span aria-hidden="true">{PRIO[k].icon}</span> {t(`prio.${k}`)} <b>{state.priorities[k]}</b>
            </span>
          ))}
        </div>
      </Section>

      <Section n="2" id="s2" title={t('sum.usual')}>
        <ol className="sum-rotation">
          {usual.map((c, i) => <li key={i}><span>{t('common.year', { n: i + 1 })}</span><b>{FAMILY_ICON[c.family]} {c.name}</b></li>)}
        </ol>
      </Section>

      <Section n="3" id="s3" title={t('sum.climate')}>
        {m && (
          <>
            <dl className="facts-grid">
              <div><dt>🌧️ {t('scen.rain')}</dt><dd dir="ltr">{signed(scenario.rain)}%</dd></div>
              <div><dt>🌡️ {t('scen.temp')}</dt><dd dir="ltr">{signed(scenario.temp, 1)} °C</dd></div>
              <div><dt>📉 {t('ind.rainTrend')}</dt><dd dir="ltr">{signed(m.trend.decade, 1)} mm/{t('unit.decade')}</dd></div>
              <div><dt>🏜️ {t('ind.dry')}</dt><dd>{m.ind.longestDrySpell} → {m.sc.dry} {t('unit.days')}</dd></div>
              <div><dt>🔥 {t('ind.hot')}</dt><dd>{m.ind.hotDays} → {m.sc.hot}</dd></div>
              <div><dt>❄️ {t('ind.frost')}</dt><dd>{m.ind.frostDays} → {m.sc.frost}</dd></div>
              <div><dt>⛈️ {t('ind.extreme')}</dt><dd>{m.ind.extremeRainDays} → {m.sc.extreme}</dd></div>
              <div><dt>🌧️ {t('sum.annualRain')}</dt><dd>{m.trend.mean} → {m.sc.rain} mm</dd></div>
            </dl>
            <div className="card" style={{ marginTop: 16 }}>
              <div className="chart-card-head">
                <h4>{t('monthly.title')}</h4>
                <div className="legend-row"><span><i className="sw s1" />{t('monthly.base')}</span><span><i className="sw s2" />{t('monthly.scenario')}</span></div>
              </div>
              <MonthlyBarsChart months={months} base={m.base} scenario={m.monthly}
                label={t('monthly.aria', { region: t(`region.${region.id}.name`) })}
                labels={{ base: t('monthly.base'), scenario: t('monthly.scenario') }} />
            </div>
            <SampleNotice data={m.data} />
          </>
        )}
      </Section>

      {!ranking ? (
        <Section n="4" id="s4" title={t('sum.rec')}><NeedsAnalysis /></Section>
      ) : (
        <>
          <Section n="4" id="s4" title={t('sum.rec')}>
            <RotationCard r={ranking.rotations[0]} />
          </Section>
          <Section n="5" id="s5" title={t('sum.vs')}>
            <div className="card">
              <CompareTable ranking={ranking} usualName={usual.map(c => c.name).join(' → ')} />
            </div>
            <div style={{ marginTop: 20 }}><NitrogenCard ranking={ranking} /></div>
            <SampleNotice data={ranking} />
          </Section>
        </>
      )}

      <div className="download-cta">
        <div>
          <h3>{t('sum.pdfTitle')}</h3>
          <p>{t('sum.pdfText')}</p>
        </div>
        <ExportButton label={t('sum.download')} icon="📄" className="btn btn-gold btn-lg" />
      </div>

      <PageNav back="top" backLabel={t('sum.backRecs')} />
    </section>
  );
}
