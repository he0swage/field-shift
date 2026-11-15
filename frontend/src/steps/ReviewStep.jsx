// Step 4 — check all answers before results (with Metric / US-Imperial unit support).
import { useState } from 'react';
import { useFarm } from '../state/FarmContext';
import { useNav } from '../state/NavContext';
import { cropProblems } from '../utils/agronomy';
import { KEYS, PRIO } from '../utils/priorities';
import { fmtCoord, fmtRain } from '../utils/format';
import { StepHead, StepNav } from '../components/Layout';
import { Alert } from '../components/ui';

function SummaryCard({ title, editTo, srLabel, children }) {
  const { go } = useNav();
  return (
    <div className="card">
      <div className="head">
        <h3>{title}</h3>
        <button type="button" className="btn btn-link" onClick={() => go(editTo)}>Edit<span className="sr-only"> {srLabel}</span></button>
      </div>
      <dl>{children}</dl>
    </div>
  );
}

export default function ReviewStep() {
  const { state, region, cropById } = useFarm();
  const { go } = useNav();
  const [problems, setProblems] = useState([]);
  const names = ids => ids.map(id => cropById(id)?.name || id);
  const units = state.units;

  const analyse = () => {
    const p = cropProblems(state.allowed, cropById);
    if (p.length) setProblems(p); else go(5);
  };

  return (
    <section aria-labelledby="t4">
      <StepHead
        id="t4"
        eyebrow="Step 4 of 6"
        title="Check your answers"
        badges={
          <>
            {region.lessValidated && <span className="role-pill role-light">Less validated</span>}
            <span className={`sys-pill sys-${region.farmingSystem}`}>
              {region.farmingSystem === 'irrigated' ? '💧 Irrigated' : '🌧️ Rainfed'}
            </span>
          </>
        }
      >
        Review everything before we rank rotations for your farm. Use “Edit” to change any section.
      </StepHead>

      <div className="summary">
        <SummaryCard title="Region" editTo={1} srLabel="region">
          <dt>Area</dt><dd>{region.name} ({region.role === 'deep' ? 'Deep · Validated' : 'Light · Less validated'})</dd>
          <dt>Farming system</dt><dd>{region.farmingSystem === 'irrigated' ? 'Irrigated (canal / tube-well)' : 'Rainfed dryland'}</dd>
          <dt>Location</dt><dd>{fmtCoord(region.lat, region.lon)}</dd>
          <dt>Annual rainfall</dt><dd>{fmtRain(region.rain, units)} (NASA POWER)</dd>
        </SummaryCard>
        <SummaryCard title="Rotation & crops" editTo={2} srLabel="rotation and crops">
          <dt>Current rotation</dt><dd>{names(state.rotation).join(' → ')}</dd>
          <dt>Allowed crops ({state.allowed.length})</dt><dd>{names(state.allowed).join(', ')}</dd>
        </SummaryCard>
        <SummaryCard title="Priorities" editTo={3} srLabel="priorities">
          {KEYS.map(k => [<dt key={`${k}t`}>{PRIO[k].name}</dt>, <dd key={`${k}d`}>{state.priorities[k]} / 100</dd>])}
        </SummaryCard>
      </div>

      <div aria-live="polite">
        {problems.length > 0 && (
          <Alert tone="warn" icon="⚠️">
            <b>Fix before analysing:</b> {problems.join(', ')}.{' '}
            <button type="button" className="btn btn-link" onClick={() => go(2)}>Go to step 2</button>
          </Alert>
        )}
      </div>

      <StepNav back={{ to: 3, label: '← Back' }} next={{ label: '🔍 See climate, Fire Watch & rainfall →', onClick: analyse }} />
    </section>
  );
}
