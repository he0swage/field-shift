// Footer: short about, method, sources, the AI disclosure and collapsible "Developer Information".
import { Sparkles } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import { Logo, SOURCES } from './Header';
import './layout.css';

const CLIMATE_CONTRACT = `GET /api/v1/climate?region=setif
→ { "source", "annual": [{ "year", "rain" }], "monthly": [12 values],
    "indicators": { "hotDays", "frostDays", "extremeRainDays", "longestDrySpell" },
    "trend": { "mmPerDecade", "label", "olsP", "mkP" } }`;

const RANKING_CONTRACT = `POST /api/v1/ranking
body: { "region", "rotation": [3 ids], "allowed": [ids], "custom": [],
        "priorities": { "water", "soil", "yield" }, "scenario": { "rain", "temp" } }
→ { monteCarlo, usual, rotations[4], avoid[], ignoredCrops, assumptions }
   (full contract: backend/README.md)`;

export default function Footer() {
  const t = useT();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="footer-grid">
          <section>
            <div className="brand"><Logo /><span className="brand-name">Crop Rotation Advisor</span></div>
            <p className="footer-text">{t('about.text')}</p>
          </section>
          <section>
            <h2>{t('about.method')}</h2>
            <ul>
              <li>{t('about.m1')}</li>
              <li>{t('about.m2')}</li>
              <li>{t('about.m3')}</li>
              <li>{t('about.m4')}</li>
            </ul>
          </section>
          <section>
            <h2>{t('about.sources')}</h2>
            <ul>{SOURCES.map(s => <li key={s}>{s}</li>)}</ul>
          </section>
        </div>
        <p className="ai-disclosure"><Sparkles size={16} aria-hidden="true" /><span>{t('ai.disclosure')}</span></p>
        <details className="dev-info">
          <summary>{t('dev.title')}</summary>
          <p>{t('dev.text')}</p>
          <pre dir="ltr"><code>{CLIMATE_CONTRACT}</code></pre>
          <pre dir="ltr"><code>{RANKING_CONTRACT}</code></pre>
        </details>
        <p className="footer-note">{t('about.note')}</p>
      </div>
    </footer>
  );
}
