// PAGE 2.1 — Understand your local climate: what-if sliders, rainfall trend + longest dry spell, AI interpretation.
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useClimateModel } from '../hooks/useClimateModel';
import { climateInsight } from '../utils/insights';
import { signed } from '../utils/format';
import { Loading, PageHead, PageNav, RegionStrip, SampleNotice } from '../components/ui';
import ScenarioControls from '../components/climate/ScenarioControls';
import IndicatorCard from '../components/climate/IndicatorCard';
import AnnualLineChart from '../components/charts/AnnualLineChart';
import FireWatchCard, { FireWatchBanner } from '../components/FireWatchCard';
import '../components/climate/climate.css';

export const SIG_TONE = { clear: '', weak: '', none: '' };

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
          <FireWatchBanner regionId={region.id} />
          <ScenarioControls />

          <div className="indicators" aria-live="polite">
            <IndicatorCard icon="rain" tone="rain" title={t('ind.rainTrend')} base={m.trend.mean} scen={m.sc.rain}
              unit={`mm/${t('unit.yr')}`} goal="higher"
              extra={(
                <p className="ind-extra">
                  {t('ind.trend19952024')}: <b dir="ltr">{signed(m.trend.decade, 1)} mm/{t('unit.decade')}</b>{' '}
                  <span className="quiet-note">· {t(`sig.${m.trend.sig}`)}</span>
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
            <p aria-live="polite">{climateInsight(t, name, m, scenario)}</p>
          </div>

          <section className="card chart-card" aria-labelledby="annual-title">
            <div className="chart-card-head">
              <div>
                <h3 className="card-title" id="annual-title">{t('annual.title')}</h3>
                <p className="card-sub">{t('annual.sub')}</p>
              </div>
              <div className="legend-row">
                <span><i className="sw line-sw" />{t('annual.rain')}</span>
                <span><i className="sw trend-sw" />{t('annual.trend')}</span>
              </div>
            </div>
            <AnnualLineChart series={m.data.annual} trend={m.trend}
              label={t('annual.aria', { region: name, d: signed(m.trend.decade, 1) })}
              labels={{ trend: t('annual.trend'), rain: t('annual.rain') }} />
          </section>

          {/* Problematic #3: Drought Shock Frequency & Historical Anomaly Early Warning */}
          {m.trend.shockYears?.length > 0 && (
            <section className="card" aria-labelledby="shock-title" style={{ marginTop: 24, background: 'var(--surface-2)', border: '1px solid var(--line-strong)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <h3 className="card-title" id="shock-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    ⚠️ Drought Shock Frequency &amp; Historical Anomaly Early Warning
                  </h3>
                  <p className="card-sub">
                    A long-term trend line hides volatility. Below are flagged acute drought shock years (rainfall ≤ <b>{m.trend.shockThreshold} mm/yr</b>).
                  </p>
                </div>
                <span className="badge badge-warn" style={{ fontWeight: 700 }}>
                  1 drought shock every ~{m.trend.returnPeriodYrs} yrs ({m.trend.shockCount}/30 yrs)
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {m.trend.shockYears.map(sy => (
                  <span
                    key={sy.year}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '5px 11px',
                      borderRadius: 999,
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      background: sy.severity === 'severe' ? 'var(--danger-soft, #fee)' : 'var(--warn-soft, #fff4e5)',
                      color: sy.severity === 'severe' ? 'var(--danger, #c00)' : 'var(--ink)',
                      border: `1.5px solid ${sy.severity === 'severe' ? 'var(--danger, #c00)' : '#e6a100'}`,
                    }}
                    title={`${sy.year}: ${sy.rain} mm (${sy.deficitPct}% vs 30-yr mean)`}
                  >
                    <span>{sy.severity === 'severe' ? '🔴' : '🟠'}</span>
                    <b>{sy.year}</b>: {sy.rain} mm ({sy.deficitPct}%)
                  </span>
                ))}
              </div>
            </section>
          )}

          <div style={{ marginTop: 24 }}>
            <FireWatchCard regionId={region.id} />
          </div>
        </>
      )}

      <PageNav back="strategy" next="extreme" />
    </section>
  );
}
