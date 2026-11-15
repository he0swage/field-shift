// Empty state shown before the farmer runs the analysis (or while it is running).
import { Sprout } from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { useNav } from '../state/NavContext';
import AnalysisRunner from './AnalysisRunner';
import '../views/StrategyView.css';

export default function NeedsAnalysis() {
  const t = useT();
  const { go } = useNav();
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden="true"><Sprout size={28} strokeWidth={1.5} /></div>
      <h3>{t('empty.title')}</h3>
      <p>{t('empty.text')}</p>
      <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'start' }}>
        <AnalysisRunner showView={false} />
      </div>
      <button type="button" className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => go('strategy')}>
        {t('empty.review')}
      </button>
    </div>
  );
}
