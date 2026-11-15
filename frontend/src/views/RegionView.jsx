// PAGE 1.2 — Select your agricultural region: region cards (left) + interactive 3D globe (right).
import { useCallback, useRef, useState } from 'react';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { REGIONS, REGION_IDS, fmtCoord } from '../data/regions';
import { PageHead, PageNav } from '../components/ui';
import Globe from '../components/globe/Globe';
import RegionThumb from '../components/globe/RegionThumb';
import '../components/globe/Globe.css';
import './RegionView.css';

const GLOBE_REGIONS = REGION_IDS.map(id => ({ id, ...REGIONS[id] }));

export default function RegionView() {
  const t = useT();
  const { state, set } = useFarm();
  const [focusTick, setFocusTick] = useState(0);
  const cardRefs = useRef({});

  const choose = useCallback(id => {
    set({ region: id });
    setFocusTick(n => n + 1);
  }, [set]);

  // Radiogroup keyboard pattern: arrows move + select
  const onKey = (e, i) => {
    if (e.key === ' ') e.preventDefault(); // no page scroll; selection happens on keyup
    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (!d) return;
    e.preventDefault();
    const id = REGION_IDS[(i + d + REGION_IDS.length) % REGION_IDS.length];
    choose(id);
    cardRefs.current[id]?.focus();
  };

  const labelFor = useCallback(r => t(`region.${r.id}.name`), [t]);
  const selected = { id: state.region, ...REGIONS[state.region] };

  return (
    <section className="region-section" id="region-section" aria-labelledby="region-title">
      <PageHead id="region-title" eyebrow={t('eyebrow.setup', { n: 1 })} title={t('region.title')}
        sub={t('region.sub')} />

      <div className="region-layout">
        <div className="region-list" role="radiogroup" aria-label={t('region.listLabel')}>
          {GLOBE_REGIONS.map((r, i) => {
            const on = r.id === state.region;
            return (
              <div key={r.id} ref={el => { cardRefs.current[r.id] = el; }}
                className={`region-card${on ? ' selected' : ''}`} role="radio" aria-checked={on}
                tabIndex={on ? 0 : -1} onClick={() => choose(r.id)} onKeyDown={e => onKey(e, i)}
                onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') choose(r.id); }}>
                <RegionThumb lat={r.lat} lon={r.lon} />
                <div className="region-body">
                  <div className="region-top">
                    <h3>{t(`region.${r.id}.name`)}</h3>
                    {on && <span className="badge badge-good"><span aria-hidden="true">✓</span> {t('common.selected')}</span>}
                  </div>
                  <p className="region-country">{t(`country.${r.countryCode}`)}</p>
                  <dl className="region-facts">
                    <div><dt>{t('region.coords')}</dt><dd className="num" dir="ltr">{fmtCoord(r.lat, r.lon)}</dd></div>
                    <div>
                      <dt>{t('region.rain')}</dt>
                      <dd className="num">{r.est.includes('rain') ? '≈ ' : ''}{r.rain} mm/{t('unit.yr')}
                        {r.est.includes('rain') && <span className="est"> · {t('common.estimate')}</span>}</dd>
                    </div>
                  </dl>
                  <p className="region-climate">{t(`region.${r.id}.climate`)}</p>
                </div>
              </div>
            );
          })}
          <p className="hint">{t('region.more')}</p>
        </div>

        <div className="globe-panel">
          <Globe regions={GLOBE_REGIONS} selectedId={state.region} focusTick={focusTick} onSelect={choose} labelFor={labelFor} />
          <p className="globe-caption" aria-live="polite">
            <span aria-hidden="true">📍</span> <b>{t(`region.${selected.id}.name`)}</b>, {t(`country.${selected.countryCode}`)} · <span dir="ltr">{fmtCoord(selected.lat, selected.lon)}</span>
          </p>
        </div>
      </div>

      <PageNav back="home" next="strategy" />
    </section>
  );
}
