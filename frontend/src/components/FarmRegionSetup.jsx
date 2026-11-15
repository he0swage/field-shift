import { useState, useEffect } from 'react';
import { REGIONS } from '../data/regions';
import { getRegionIndicators } from '../api/client';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { presetFor } from '../utils/priorities';

export default function FarmRegionSetup() {
  const { state, set, region } = useFarm();
  const toast = useToast();
  
  const [selectedRegionId, setSelectedRegionId] = useState(state.region || 'regionB');
  const [indicators, setIndicators] = useState({
    waterStress: region.water ?? 28,
    soc: region.soc ?? 17.08,
    socClass: 'Adequate / High (>15 g/kg · SoilGrids live)',
    frostRisk: region.frost ?? 14,
    erosionRisk: region.erosion ?? 28,
  });
  const [loading, setLoading] = useState(false);

  // Load region indicators on mount and whenever selectedRegionId changes
  useEffect(() => {
    let active = true;
    async function fetchIndicators() {
      setLoading(true);
      try {
        const res = await getRegionIndicators(selectedRegionId);
        if (active && res && res.region) {
          setIndicators({
            waterStress: res.region.waterStress ?? 28,
            soc: res.region.soc ?? 17.08,
            socClass: res.region.socClass ?? 'Adequate / High (>15 g/kg · SoilGrids live)',
            frostRisk: res.region.frostRisk ?? 14,
            erosionRisk: res.region.erosionRisk ?? 28,
          });
        }
      } catch (err) {
        console.error('Error fetching region indicators:', err);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchIndicators();
    return () => {
      active = false;
    };
  }, [selectedRegionId]);

  // Handler for region dropdown change
  const handleSelectChange = (e) => {
    const nextId = e.target.value;
    setSelectedRegionId(nextId);
    set({ region: nextId });
    toast(`Selected region: ${REGIONS[nextId]?.name || nextId}`);
  };

  // Handler for "Suggest for my region"
  const handleSuggest = () => {
    const currentReg = REGIONS[selectedRegionId] || region;
    const suggested = presetFor(currentReg);
    set({ priorities: suggested });
    toast(`Priorities updated for ${currentReg.name}.`);
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #d3ddd5',
      borderLeft: '5px solid #1e6b4e',
      padding: '24px 28px',
      marginBottom: '28px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#144a36', margin: 0 }}>
          Farm &amp; Region Setup
        </h2>
        <span style={{
          background: '#eef2ff',
          color: '#4338ca',
          fontSize: '11px',
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: '999px',
          letterSpacing: '0.04em'
        }}>
          ✦ AI-GENERATED
        </span>
      </div>

      <p style={{ color: '#46564d', fontSize: '15px', margin: '0 0 20px 0' }}>
        Pick your area, tell us what matters most on your farm, and enter the 3-year rotation you grow today.
      </p>

      {/* 2-column layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left Column: Select & Badges */}
        <div>
          <label htmlFor="region-selector" style={{ display: 'block', fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: '#15211b' }}>
            Select your region
          </label>
          
          <div style={{ position: 'relative' }}>
            <select
              id="region-selector"
              value={selectedRegionId}
              onChange={handleSelectChange}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                background: '#ffffff',
                fontSize: '14px',
                fontWeight: 500,
                color: '#1e293b',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              {Object.entries(REGIONS).map(([id, r]) => (
                <option key={id} value={id}>
                  {id} — {r.name} ({r.lat.toFixed(2)}°N, {r.lon.toFixed(2)}°E · NASA POWER)
                </option>
              ))}
            </select>
          </div>

          {/* Badges / Pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
            {/* Water stress */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#0369a1',
              fontWeight: 500
            }}>
              <span>💧</span>
              <span>Water stress: <strong>{indicators.waterStress}%</strong></span>
            </div>

            {/* SOC */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#15803d',
              fontWeight: 500
            }}>
              <span>🌱</span>
              <span>
                <abbr title="Soil organic carbon" style={{ textDecoration: 'underline dotted', cursor: 'help' }}>SOC</abbr>: <strong>{indicators.soc} g/kg</strong> ({indicators.socClass})
              </span>
            </div>

            {/* Frost risk */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#334155',
              fontWeight: 500
            }}>
              <span>❄️</span>
              <span>Frost risk: <strong>{indicators.frostRisk}%</strong></span>
            </div>

            {/* Erosion risk */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '13px',
              color: '#334155',
              fontWeight: 500
            }}>
              <span>🌪️</span>
              <span>Erosion risk: <strong>{indicators.erosionRisk}%</strong></span>
            </div>
          </div>
        </div>

        {/* Right Column: Regional indicator preset */}
        <div style={{
          background: '#f8faf8',
          border: '1px solid #e2ece5',
          borderRadius: '12px',
          padding: '18px 20px'
        }}>
          <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#15211b' }}>
            Regional indicator preset
          </h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
            Fill the three priority sliders automatically from your region&apos;s water stress, soil organic carbon class, and yield baseline (rescaled to 100).
          </p>
          <button
            type="button"
            onClick={handleSuggest}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: '#ffffff',
              border: '1.5px solid #22c55e',
              color: '#15803d',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <span>✨</span> Suggest for my region
          </button>
        </div>
      </div>
    </div>
  );
}
