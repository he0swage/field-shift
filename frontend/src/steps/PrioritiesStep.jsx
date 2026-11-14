// Step 3 — the 3 farm priorities (always sum to 100).
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { KEYS, PRIO, PROFILE_TEXT, presetFor, setPriority, topKey } from '../utils/priorities';
import { StepHead, StepNav } from '../components/Layout';
import { Alert, WeightStack } from '../components/ui';

const SLIDERS = {
  water: { icon: '💧', bg: 'var(--water-soft)', color: 'var(--water)', text: 'Prefer crops that need less rain and survive dry spells.' },
  soil: { icon: '🌱', bg: 'var(--soil-soft)', color: 'var(--soil)', text: 'Build organic matter and natural nitrogen with legume and cover crops.' },
  yield: {
    icon: '🌾', bg: 'var(--wheat-soft)', color: 'var(--wheat)',
    text: <>Aim for steady harvests, based on <abbr title="Normalized Difference Vegetation Index — satellite measure of plant health">NDVI</abbr> history.</>,
  },
};

export default function PrioritiesStep() {
  const { state, set, region } = useFarm();
  const toast = useToast();
  const p = state.priorities;
  const top = topKey(p);

  const replace = (next, message) => {
    const prev = p;
    set({ priorities: next });
    toast(message, () => set({ priorities: prev }));
  };

  return (
    <section aria-labelledby="t3">
      <StepHead id="t3" eyebrow="Step 3 of 6" title="What matters most on your farm?">
        Move the sliders. The three priorities always add up to 100 — raising one lowers the others.
      </StepHead>

      <div className="grid grid-2">
        <div className="card">
          {KEYS.map(k => (
            <div className="prio" key={k}>
              <div className="ico" style={{ background: SLIDERS[k].bg }} aria-hidden="true">{SLIDERS[k].icon}</div>
              <div>
                <h4><label htmlFor={`p-${k}`}>{PRIO[k].name}</label></h4>
                <p>{SLIDERS[k].text}</p>
                <input type="range" id={`p-${k}`} min="0" max="100" value={p[k]} aria-valuetext={`${p[k]} out of 100`}
                  onChange={e => set({ priorities: setPriority(p, k, +e.target.value) })} />
              </div>
              <output htmlFor={`p-${k}`} style={{ color: SLIDERS[k].color }}>{p[k]}</output>
            </div>
          ))}
        </div>

        <div className="card tinted">
          <h3>Your weight mix</h3>
          <p className="sub">How rotations will be scored.</p>
          <WeightStack priorities={p} height={36} />
          <Alert tone="ok" icon="🧭" style={{ marginTop: 24 }}>
            <b>Your profile: {PRIO[top].name}</b><br />{PROFILE_TEXT[top]}
          </Alert>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => replace({ water: 33, soil: 33, yield: 34 }, 'Weights set to equal.')}>
              ⚖️ Equal weights
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => replace(presetFor(region), `Preset for ${region.name} applied.`)}>
              ↺ Regional preset
            </button>
          </div>
        </div>
      </div>

      <StepNav back={{ to: 2, label: '← Back' }} next={{ to: 4, label: 'Next: review →' }} />
    </section>
  );
}
