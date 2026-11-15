// About / methodology + collapsible "Developer Information" (API contracts are hidden from farmers).
import { useT } from '../../i18n/I18nContext';
import './layout.css';

const CLIMATE_CONTRACT = `GET {VITE_API_BASE}/climate?region=setif&lat=36.15&lon=5.38
→ { "source": "NASA POWER 1995-2024",
    "annual":  [{ "year": 1995, "rain": 412 }, …],
    "monthly": [52, 46, 43, 41, 27, 10, 3, 7, 20, 24, 44, 45],
    "indicators": { "hotDays": 48, "frostDays": 32,
                    "extremeRainDays": 5, "longestDrySpell": 58 } }`;

const RANKING_CONTRACT = `POST {VITE_API_BASE}/ranking
body: { "region": "setif", "rotation": ["durum","barley","durum"],
        "allowed": ["durum", …], "custom": [],
        "priorities": { "water": 42, "soil": 33, "yield": 25 },
        "scenario": { "rain": -20, "temp": 2 } }
→ same shape as SAMPLE_RANKING in src/data/sampleRanking.js`;

export default function Footer() {
  const t = useT();
  return (
    <footer className="site-footer" id="about">
      <div className="wrap footer-grid">
        <section>
          <div className="brand footer-brand"><span className="brand-mark" aria-hidden="true">🌾</span><span className="brand-name">Precision Crop <span>Rotation Advisor</span></span></div>
          <p>{t('about.text')}</p>
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
          <ul>
            <li>NASA POWER 1995–2024</li>
            <li>ISRIC SoilGrids</li>
            <li>MODIS NDVI</li>
            <li>OAIC / CCLS Prices</li>
          </ul>
        </section>
      </div>
      <div className="wrap">
        <details className="dev-info">
          <summary>{t('dev.title')}</summary>
          <p>{t('dev.text')}</p>
          <h3>Climate</h3>
          <pre dir="ltr"><code>{CLIMATE_CONTRACT}</code></pre>
          <h3>Ranking</h3>
          <pre dir="ltr"><code>{RANKING_CONTRACT}</code></pre>
        </details>
        <p className="footer-note">{t('about.note')}</p>
      </div>
    </footer>
  );
}
