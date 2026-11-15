// PAGE 1.2 — Select your agricultural region: name cards (left) + 3D globe with the selected region's details (right).
import { useCallback, useRef, useState } from 'react';
import { useT } from '../i18n/I18nContext';
import { useFarm } from '../state/FarmContext';
import { REGIONS, REGION_IDS, fmtCoord } from '../data/regions';
import { PageHead, PageNav } from '../components/ui';
import Globe from '../components/globe/Globe';
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
                <span className="region-radio" aria-hidden="true" />
                <h3>{t(`region.${r.id}.name`)}</h3>
              </div>
            );
          })}
          <p className="hint">{t('region.more')}</p>
        </div>

        <div className="globe-panel">
          <Globe regions={GLOBE_REGIONS} selectedId={state.region} focusTick={focusTick} onSelect={choose} labelFor={labelFor} />
          <aside className="globe-info" aria-live="polite" key={selected.id}>
            <h3>{t(`region.${selected.id}.name`)}</h3>
            <p className="gi-country">{t(`country.${selected.countryCode}`)}</p>
            <dl>
              <div><dt>{t('region.coords')}</dt><dd className="num" dir="ltr">{fmtCoord(selected.lat, selected.lon)}</dd></div>
              <div>
                <dt>{t('region.rain')}</dt>
                <dd className="num">{selected.est.includes('rain') ? '≈ ' : ''}{selected.rain} mm/{t('unit.yr')}
                  {selected.est.includes('rain') && <span className="est"> · {t('common.estimate')}</span>}</dd>
              </div>
            </dl>
            <p className="gi-climate">{t(`region.${selected.id}.climate`)}</p>
          </aside>
        </div>
      </div>

      <PageNav back="home" next="strategy" />
    </section>
  );
}
