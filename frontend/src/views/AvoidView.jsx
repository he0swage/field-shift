// PAGE 3.2 — Rotations & crops to avoid this season (restrained warning design).
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { useAnalysis } from '../state/AnalysisContext';
import { cropFit } from '../utils/agronomy';
import { AlertTriangle, ArrowRight, Pin, XOctagon } from 'lucide-react';
import Icon from '../components/icons';
import { sameName } from '../utils/format';
import { AiBadge, PageHead, PageNav, RegionStrip, SampleNotice } from '../components/ui';
import NeedsAnalysis from '../components/NeedsAnalysis';
import './Results.css';

const ROWS = [
  { k: 'climate', icon: 'climate' },
  { k: 'soil', icon: 'soilProblem' },
  { k: 'water', icon: 'water' },
  { k: 'disease', icon: 'disease' },
];

function aiExplain(t, a) {
  const found = ROWS.filter(r => a[r.k]).map(r => t(`avoid.${r.k}`).toLowerCase());
  return t('avoid.ai', { score: a.score, issues: found.join(', ') || t('avoid.rules') });
}

export function AvoidCard({ a, isUsual, alt }) {
  const t = useT();
  return (
    <article className={`avoid-card level-${a.level}`}>
      <header className="avoid-head">
        <span className="avoid-icon" aria-hidden="true">{a.level === 'high' ? <XOctagon size={18} /> : <AlertTriangle size={18} />}</span>
        <div>
          <span className={`badge ${a.level === 'high' ? 'badge-bad' : 'badge-warn'}`}>{t(`avoid.level.${a.level}`)}</span>
          <h3>{a.crops.join(' → ')}</h3>
          {a.score != null && <p className="muted">{t('avoid.score', { score: a.score })}</p>}
        </div>
      </header>
      {isUsual && <p className="usual-flag"><Pin size={14} aria-hidden="true" /> {t('avoid.isUsual')}</p>}
      <p className="avoid-reason"><b>{t('avoid.reason')}:</b> {a.reason}</p>
      <dl className="avoid-rows">
        {ROWS.filter(r => a[r.k]).map(r => (
          <div key={r.k}><dt><Icon name={r.icon} size={14} /> {t(`avoid.${r.k}`)}</dt><dd>{a[r.k]}</dd></div>
        ))}
      </dl>
      {alt && (
        <p className="avoid-alt"><ArrowRight size={14} className="flip" aria-hidden="true" /> <b>{t('avoid.alt')}:</b> {alt}</p>
      )}
      {a.score != null && (
        <div className="avoid-ai"><AiBadge /><p>{aiExplain(t, a)}</p></div>
      )}
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
