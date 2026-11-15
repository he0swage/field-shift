// Section 3 — NASA FIRMS Fire Watch Card & Climate Screen Banner.
// Enforces exact wording rules from Section 3.4:
//   - Detections found: "{count} satellite fire detections within {radius} km in the last {days} days. Nearest: {nearest}." (amber badge)
//   - None found: "No satellite fire detections within {radius} km in the last {days} days." (grey badge, NEVER green)
//   - Error: "Fire data is not available right now. Try again later."
//   - Always shows: "Satellite data, about 3 hours old. Not a forecast. No detection does not mean no fire." and the fetch time.
import { useState } from 'react';
import { useFarm } from '../state/FarmContext';
import { useFires } from '../hooks/useData';
import { fmtCoord, fmtDist } from '../utils/format';

const MANDATORY_NOTICE = 'Satellite data, about 3 hours old. Not a forecast. No detection does not mean no fire.';

export function FireWatchBanner({ regionId }) {
  const { state } = useFarm();
  const { data: fires } = useFires(regionId);
  if (!fires || fires.error || !fires.count) return null;
  const radiusText = fmtDist(fires.radius_km || 25, state.units);
  const nearestText = fmtDist(fires.nearest_km, state.units);

  return (
    <div className="fire-banner" role="region" aria-label="Satellite fire detections near region">
      <div className="fire-banner-head">
        <span className="fire-pill fire-pill-amber">🔥 Fire Watch · Active Detections</span>
        <span className="fire-banner-meta">
          Source: NASA FIRMS ({fires.source || 'VIIRS_NOAA21_NRT'}) · Fetched {fires.fetched_at}
        </span>
      </div>
      <p className="fire-banner-main">
        <b>
          {fires.count} satellite fire {fires.count === 1 ? 'detection' : 'detections'} within {radiusText} in the last {fires.days || 2} days.
          {' '}Nearest: {nearestText}.
        </b>
      </p>
      <p className="fire-banner-notice">
        {MANDATORY_NOTICE} Retaining cereal/legume stubble as surface mulch instead of burning residue protects soil organic carbon and moisture.
      </p>
    </div>
  );
}

export default function FireWatchCard({ regionId, compact = false }) {
  const { state } = useFarm();
  const { data: fires, loading, refreshLive, toggleErrorDemo, isErrorDemo } = useFires(regionId);
  const [showDry, setShowDry] = useState(false);

  const units = state.units;
  const radiusVal = fires?.radius_km ?? 25;
  const daysVal = fires?.days ?? 2;
  const radiusLabel = units === 'imperial' ? `${fmtDist(radiusVal, 'imperial')} (${radiusVal} km)` : `${radiusVal} km`;
  const nearestLabel = fires?.nearest_km != null
    ? (units === 'imperial' ? `${fires.nearest_km} km (${fmtDist(fires.nearest_km, 'imperial')})` : `${fires.nearest_km} km`)
    : '—';

  const hasError = Boolean(fires?.error);
  const hasDetections = !hasError && Number(fires?.count) > 0;
  const dry = fires?.dry_conditions;

  return (
    <section className={`card fire-card${compact ? ' fire-card-compact' : ''}`} aria-labelledby="fireWatchTitle">
      <div className="fire-card-top">
        <div>
          <div className="eyebrow fire-eyebrow">NASA FIRMS · VIIRS 375 m Near-Real-Time</div>
          <h3 id="fireWatchTitle">Fire Watch — Satellite Detections Nearby</h3>
        </div>
        <div className="fire-actions">
          <button type="button" className="btn btn-sm btn-secondary" onClick={refreshLive} disabled={loading}>
            ↻ Refresh snapshot
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={toggleErrorDemo}
            title="Test API fallback / error state (Section 3.7)"
          >
            {isErrorDemo ? 'Restore data' : 'Test error state'}
          </button>
        </div>
      </div>

      <div className="fire-status-box" aria-live="polite">
        {hasError ? (
          <div className="fire-state fire-state-error">
            <span className="fire-pill fire-pill-error">Unavailable</span>
            <p className="fire-headline">Fire data is not available right now. Try again later.</p>
          </div>
        ) : hasDetections ? (
          <div className="fire-state fire-state-amber">
            <span className="fire-pill fire-pill-amber">Amber · Thermal anomalies detected</span>
            <p className="fire-headline">
              {fires.count} satellite fire {fires.count === 1 ? 'detection' : 'detections'} within {radiusLabel} in the last {daysVal} days. Nearest: {nearestLabel}.
            </p>
          </div>
        ) : (
          <div className="fire-state fire-state-grey">
            {/* Section 3.4: None found uses grey badge, NEVER green */}
            <span className="fire-pill fire-pill-grey">No detections in window</span>
            <p className="fire-headline">
              No satellite fire detections within {radiusLabel} in the last {daysVal} days.
            </p>
          </div>
        )}

        <div className="fire-mandatory-footer">
          <p className="fire-notice-text">{MANDATORY_NOTICE}</p>
          <div className="fire-fetch-meta">
            <span>
              <b>Fetched:</b> {fires?.fetched_at || 'Unavailable (offline fallback)'}
            </span>
            {fires?.source && (
              <span>
                <b>Sensor:</b> {fires.source} ({fires.mode === 'live-firms' ? 'Live NASA FIRMS' : 'Saved snapshot'})
              </span>
            )}
          </div>
        </div>
      </div>

      {hasDetections && fires.detections?.length > 0 && (
        <div className="fire-table-wrap">
          <table className="fire-table">
            <caption className="sr-only">Recent satellite thermal detections within 25 km</caption>
            <thead>
              <tr>
                <th scope="col">Distance</th>
                <th scope="col">Date (UTC)</th>
                <th scope="col">Time</th>
                <th scope="col">Coordinates</th>
                <th scope="col">FRP</th>
              </tr>
            </thead>
            <tbody>
              {fires.detections.map((d, idx) => (
                <tr key={`${d.date}-${d.time}-${idx}`}>
                  <td><b>{d.km} km</b> {units === 'imperial' ? `(${fmtDist(d.km, 'imperial')})` : ''}</td>
                  <td>{d.date}</td>
                  <td>{String(d.time).padStart(4, '0').replace(/(\d{2})(\d{2})/, '$1:$2')} UTC</td>
                  <td>{d.lat != null && d.lon != null ? fmtCoord(d.lat, d.lon) : '—'}</td>
                  <td>{d.frp_mw != null ? `${d.frp_mw} MW` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dry && !hasError && (
        <div className="fire-dry-wrap">
          <button
            type="button"
            className="btn-link fire-dry-toggle"
            aria-expanded={showDry}
            onClick={() => setShowDry(v => !v)}
          >
            {showDry ? '▾ Hide' : '▸ Show'} meteorological dry-conditions context (Indicative only)
          </button>
          {showDry && (
            <div className="fire-dry-box">
              <div className="fire-dry-head">
                <b>Dry-conditions context (NASA POWER)</b>
                <span className="fire-pill fire-pill-grey">Indicative only · Not a validated fire index</span>
              </div>
              <div className="fire-dry-grid">
                <div><span>Consecutive dry days</span><b>{dry.consecutive_dry_days} days</b></div>
                <div><span>Hot days/yr</span><b>{dry.hot_days_recent} days</b></div>
                <div><span>Mean relative humidity</span><b>{dry.mean_rh_pct}%</b></div>
                <div><span>Mean wind speed</span><b>{dry.wind_m_s} m/s</b></div>
              </div>
              <p className="fire-dry-note">
                <b>Agronomic link:</b> Open burning of cereal or paddy residue destroys surface organic mulch, volatilises 80%+ of straw nitrogen,
                and accelerates topsoil moisture loss. Incorporating legume breaks and retaining stubble reduces post-harvest burn pressure.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

