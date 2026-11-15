// PAGE 2.2 — Extreme weather: hot days, frost days, extreme-rain days (baseline vs scenario).
import { useT } from '../i18n/I18nContext';
import { useClimateModel } from '../hooks/useClimateModel';
import { extremeInsight } from '../utils/insights';
import { Loading, PageHead, PageNav, RegionStrip, SampleNotice } from '../components/ui';
import ScenarioControls from '../components/climate/ScenarioControls';
import IndicatorCard from '../components/climate/IndicatorCard';
import ExtremeBars from '../components/charts/ExtremeBars';
import '../components/climate/climate.css';

export default function ExtremeView() {
  const t = useT();
  const { model: m } = useClimateModel();
  const days = t('unit.daysYr');

  return (
    <section aria-labelledby="extreme-title">
      <PageHead id="extreme-title" eyebrow={t('eyebrow.climate', { n: 2 })} title={t('extreme.title')} sub={t('extreme.sub')}>
        <RegionStrip />
      </PageHead>

      {!m ? <Loading>{t('common.loading')}</Loading> : (
        <>
          <SampleNotice data={m.data} />
          <ScenarioControls compact />
          <div className="indicators" aria-live="polite">
            <IndicatorCard icon="hot" tone="heat" title={t('ind.hot')} base={m.ind.hotDays} scen={m.sc.hot} unit={days} goal="lower">
              {t('ind.hot.d')}
            </IndicatorCard>
            <IndicatorCard icon="frost" tone="cold" title={t('ind.frost')} base={m.ind.frostDays} scen={m.sc.frost} unit={days} goal="lower">
              {t('ind.frost.d')}
            </IndicatorCard>
            <IndicatorCard icon="extreme" tone="rain" title={t('ind.extreme')} base={m.ind.extremeRainDays} scen={m.sc.extreme} unit={days} goal="lower">
              {t('ind.extreme.d')}
            </IndicatorCard>
          </div>
          <section className="card chart-card" aria-labelledby="ext-chart">
            <div className="chart-card-head">
              <h3 className="card-title" id="ext-chart">{t('extreme.chart')}</h3>
              <div className="legend-row">
                <span><i className="sw s1" />{t('monthly.base')}</span>
                <span><i className="sw s2" />{t('monthly.scenario')}</span>
              </div>
            </div>
            <ExtremeBars labels={{ aria: t('extreme.chart') }} rows={[
              { id: 'hot', label: t('ind.hot'), base: m.ind.hotDays, scen: m.sc.hot },
              { id: 'frost', label: t('ind.frost'), base: m.ind.frostDays, scen: m.sc.frost },
              { id: 'extreme', label: t('ind.extreme'), base: m.ind.extremeRainDays, scen: m.sc.extreme },
            ]} />
          </section>
          <div className="ai-insight" style={{ marginTop: 24 }}>
            <p aria-live="polite">{extremeInsight(t, m)}</p>
          </div>
        </>
      )}

      <PageNav back="climate" next="monthly" />
    </section>
  );
}
