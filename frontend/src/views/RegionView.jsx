// PAGE 1.2 — Select your agricultural region: name cards (left) + 3D globe with the selected region's details (right).
import { useCallback, useRef, useState } from 'react';
import { Check } from 'lucide-react';
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
                <div className="rc-top">
                  <div>
                    <h3>{t(`region.${r.id}.name`)}</h3>
                    <p className="rc-country">{t(`country.${r.countryCode}`)}</p>
                  </div>
                  <span className="rc-check" aria-hidden="true">{on && <Check size={16} strokeWidth={2.5} />}</span>
                </div>
                <div className="stat md">
                  <span className="label">{t('region.rain')}</span>
                  <span className="value">{r.est.includes('rain') ? '≈' : ''}{r.rain}<small>mm/{t('unit.yr')}</small></span>
                </div>
              </div>
            );
          })}
          <p className="hint">{t('region.more')}</p>
        </div>

        <div className="globe-panel">
          <Globe regions={GLOBE_REGIONS} selectedId={state.region} focusTick={focusTick} onSelect={choose} labelFor={labelFor}>
            <div className="globe-info" aria-live="polite" key={selected.id}>
              <span className="label">{t(`country.${selected.countryCode}`)}</span>
              <h3>{t(`region.${selected.id}.name`)}</h3>
              <p className="gi-coords num" dir="ltr">{fmtCoord(selected.lat, selected.lon)}</p>
              <p className="gi-climate">{t(`region.${selected.id}.climate`)}</p>
              {selected.est.includes('rain') && <p className="gi-est">{t('region.estNote')}</p>}
            </div>
          </Globe>
        </div>
      </div>

      <PageNav back="home" next="strategy" />
    </section>
  );
}
