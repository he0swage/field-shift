// Rainfall-change and temperature-change sliders (full size on 2.1, compact on 2.2 / 2.3).
import { RotateCcw } from 'lucide-react';
import { useT } from '../../i18n/I18nContext';
import Icon from '../icons';
import { useFarm } from '../../state/FarmContext';
import { useToast } from '../../state/ToastContext';
import { signed } from '../../utils/format';
import './climate.css';

const RAIN = { min: -50, max: 30, step: 5 };
const TEMP = { min: -1, max: 5, step: 0.5 };
const pctOf = (v, r) => `${((v - r.min) / (r.max - r.min)) * 100}%`;

export default function ScenarioControls({ compact = false }) {
  const t = useT();
  const { state, set } = useFarm();
  const toast = useToast();
  const s = state.scenario;
  const update = patch => set({ scenario: { ...s, ...patch } });
  const reset = () => {
    const prev = s;
    set({ scenario: { rain: 0, temp: 0 } });
    toast(t('scen.resetDone'), () => set({ scenario: prev }));
  };

  return (
    <section className={`card scenario${compact ? ' compact' : ''}`} aria-labelledby="scen-title">
      <div className="row">
        <h3 className="card-title" id="scen-title">{t('scen.title')}</h3>
        <span className="spacer" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset} disabled={!s.rain && !s.temp}><RotateCcw size={14} aria-hidden="true" /> {t('scen.reset')}</button>
      </div>
      {!compact && <p className="card-sub">{t('scen.sub')}</p>}
      <div className="scen-grid">
        <div className="scen water">
          <div className="scen-head">
            <label htmlFor="scen-rain"><Icon name="rain" /> {t('scen.rain')}</label>
            <output htmlFor="scen-rain" className="scen-value num" dir="ltr">{signed(s.rain)}%</output>
          </div>
          <input id="scen-rain" type="range" min={RAIN.min} max={RAIN.max} step={RAIN.step} value={s.rain}
            aria-valuetext={`${signed(s.rain)} %`} style={{ '--pct': pctOf(s.rain, RAIN), '--track-fill': 'var(--series-1)' }}
            onChange={e => update({ rain: +e.target.value })} />
          <div className="scen-scale num" dir="ltr"><span>−50%</span><span>0</span><span>+30%</span></div>
        </div>
        <div className="scen heat">
          <div className="scen-head">
            <label htmlFor="scen-temp"><Icon name="temp" /> {t('scen.temp')}</label>
            <output htmlFor="scen-temp" className="scen-value num" dir="ltr">{signed(s.temp, 1)} °C</output>
          </div>
          <input id="scen-temp" type="range" min={TEMP.min} max={TEMP.max} step={TEMP.step} value={s.temp}
            aria-valuetext={`${signed(s.temp, 1)} °C`} style={{ '--pct': pctOf(s.temp, TEMP), '--track-fill': 'var(--series-2)' }}
            onChange={e => update({ temp: +e.target.value })} />
          <div className="scen-scale num" dir="ltr"><span>−1 °C</span><span>0</span><span>+5 °C</span></div>
        </div>
      </div>
    </section>
  );
}
