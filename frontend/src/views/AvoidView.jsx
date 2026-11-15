// PAGE 3.2 — Rotations & crops to avoid this season (restrained warning design).
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { cropFit } from '../utils/agronomy';
import { AlertTriangle, ArrowRight, Pin, XOctagon } from 'lucide-react';
import Icon from '../components/icons';
import { sameName } from '../utils/format';
import { PageHead, PageNav, RegionStrip, SampleNotice } from '../components/ui';
import NeedsAnalysis from '../components/NeedsAnalysis';
import './Results.css';

const ROWS = [
  { k: 'climate', icon: 'climate' },
  { k: 'soil', icon: 'soilProblem' },
  { k: 'water', icon: 'water' },
  { k: 'disease', icon: 'disease' },
];

export function AvoidCard({ a, isUsual, alt }) {
  const t = useT();
  const details = ROWS.filter(r => a[r.k]);
  return (
    <article className={`avoid-card level-${a.level}`}>
      <div className="avoid-top">
        <span className="avoid-icon" aria-hidden="true">{a.level === 'high' ? <XOctagon size={20} /> : <AlertTriangle size={20} />}</span>
        <div className="avoid-title">
          <span className="label">{t(`avoid.level.${a.level}`)}{a.score != null && ` · ${a.score}/100`}</span>
          <h3>{a.crops.join(' → ')}</h3>
        </div>
      </div>
      {isUsual && <p className="usual-flag"><Pin size={14} aria-hidden="true" /> {t('avoid.isUsual')}</p>}
      <p className="avoid-reason">{a.reason}</p>
      {details.length > 0 && (
        <details className="avoid-more">
          <summary>{t('avoid.details')}</summary>
          <dl className="avoid-rows">
            {details.map(r => (
              <div key={r.k}><dt><Icon name={r.icon} size={15} /> {t(`avoid.${r.k}`)}</dt><dd>{a[r.k]}</dd></div>
            ))}
          </dl>
        </details>
      )}
      {alt && <p className="avoid-alt"><ArrowRight size={15} className="flip" aria-hidden="true" /> {t('avoid.alt')}: <b>{alt}</b></p>}
    </article>
  );
}

export default function AvoidView() {
  const t = useT();
  const { state, region, cropById } = useFarm();
  const { ranking } = useAnalysis();
  const usualNames = state.rotation.map(id => cropById(id)?.name || id);

  // Custom crops that the rules engine flags as unsuitable for this region
  const badCustom = state.custom
    .map(c => ({ c, fit: cropFit(region, c) }))
    .filter(x => x.fit.level === 'bad');

  return (
    <section aria-labelledby="avoid-title">
      <PageHead id="avoid-title" eyebrow={t('eyebrow.recs', { n: 2 })} title={t('avoid.title')} sub={t('avoid.sub')}>
        <RegionStrip />
      </PageHead>

      {!ranking ? <NeedsAnalysis /> : (
        <>
          <SampleNotice data={ranking} />
          <h3 className="section-title">{t('avoid.rotations')}</h3>
          <div className="avoid-grid">
            {ranking.avoid.map(a => {
              const altR = ranking.rotations.find(r => r.rank === a.alternative);
              return (
                <AvoidCard key={a.crops.join()} a={a}
                  isUsual={a.crops.every((c, i) => sameName(c, usualNames[i]))}
                  alt={altR && `${t('rank.rank', { n: altR.rank })} — ${altR.crops.join(' → ')}`} />
              );
            })}
          </div>

          <h3 className="section-title" style={{ marginTop: 40 }}>{t('avoid.crops')}</h3>
          {badCustom.length === 0 ? (
            <p className="muted">{t('avoid.noCrops')}</p>
          ) : (
            <div className="avoid-grid">
              {badCustom.map(({ c, fit }) => (
                <AvoidCard key={c.id} a={{
                  crops: [c.name], level: 'caution', reason: t('avoid.customReason'),
                  climate: fit.issues.filter(i => i.key !== 'fit.ph').map(i => t(i.key, i.vars)).join(' ') || undefined,
                  soil: fit.issues.filter(i => i.key === 'fit.ph').map(i => t(i.key, i.vars)).join(' ') || undefined,
                }} />
              ))}
            </div>
          )}
        </>
      )}

      <PageNav back="top" next="summary" />
    </section>
  );
}
