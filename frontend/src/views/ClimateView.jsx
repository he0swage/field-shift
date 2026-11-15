// PAGE 2.1 — Understand your local climate: what-if sliders, rainfall trend + longest dry spell, AI interpretation.
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useClimateModel } from '../hooks/useClimateModel';
import { climateInsight } from '../utils/insights';
import { signed } from '../utils/format';
import { AiBadge, Loading, PageHead, PageNav, RegionStrip, SampleNotice } from '../components/ui';
import ScenarioControls from '../components/climate/ScenarioControls';
import IndicatorCard from '../components/climate/IndicatorCard';
import AnnualLineChart from '../components/charts/AnnualLineChart';
import '../components/climate/climate.css';

export const SIG_TONE = { clear: 'badge-good', weak: 'badge-warn', none: '' };

export default function ClimateView() {
  const t = useT();
  const { region } = useFarm();
  const { model: m, scenario } = useClimateModel();
  const name = t(`region.${region.id}.name`);

  return (
    <section aria-labelledby="climate-title">
      <PageHead id="climate-title" eyebrow={t('eyebrow.climate', { n: 1 })} title={t('climate.title')} sub={t('climate.sub')}>
        <RegionStrip />
      </PageHead>

      {!m ? <Loading>{t('common.loading')}</Loading> : (
        <>
          <SampleNotice data={m.data} />
          <ScenarioControls />

          <div className="indicators" aria-live="polite">
            <IndicatorCard icon="rain" tone="rain" title={t('ind.rainTrend')} base={m.trend.mean} scen={m.sc.rain}
              unit={`mm/${t('unit.yr')}`} goal="higher"
              extra={(
                <p className="ind-extra">
                  {t('ind.trend19952024')}: <b dir="ltr">{signed(m.trend.decade, 1)} mm/{t('unit.decade')}</b>{' '}
                  <span className={`badge ${SIG_TONE[m.trend.sig]}`}>{t(`sig.${m.trend.sig}`)}</span>
                </p>
              )}>
              {t('ind.rainTrend.d')}
            </IndicatorCard>
            <IndicatorCard icon="dry" tone="dry" title={t('ind.dry')} base={m.ind.longestDrySpell} scen={m.sc.dry}
              unit={t('unit.days')} goal="lower">
              {t('ind.dry.d')}
            </IndicatorCard>
          </div>

          <div className="ai-insight" style={{ marginTop: 24 }}>
            <AiBadge />
            <p aria-live="polite">{climateInsight(t, name, m, scenario)}</p>
          </div>

          <section className="card chart-card" aria-labelledby="annual-title">
            <div className="chart-card-head">
              <div>
                <h3 className="card-title" id="annual-title">{t('annual.title')}</h3>
                <p className="card-sub">{t('annual.sub')}</p>
              </div>
              <div className="legend-row">
                <span><i className="sw s1" />{t('annual.rain')}</span>
                <span><i className="sw trend-sw" />{t('annual.trend')}</span>
              </div>
            </div>
            <AnnualLineChart series={m.data.annual} trend={m.trend}
              label={t('annual.aria', { region: name, d: signed(m.trend.decade, 1) })}
              labels={{ trend: t('annual.trend'), rain: t('annual.rain') }} />
          </section>
        </>
      )}

      <PageNav back="strategy" next="extreme" />
    </section>
  );
}
