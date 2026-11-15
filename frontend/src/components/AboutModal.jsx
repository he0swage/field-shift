// Sections 2.2, 7 & 8 — About, Scaling Architecture, Scientific Limits & Data Credits Modal.
import { useFarm } from '../state/FarmContext';

export default function AboutModal() {
  const { state, set } = useFarm();
  if (!state.aboutOpen) return null;

  const close = () => set({ aboutOpen: false });

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="aboutTitle" onClick={close}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <div className="eyebrow">Architecture · Limits · Attribution</div>
            <h2 id="aboutTitle">About Field Shift &amp; Global Scaling</h2>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={close} aria-label="Close About dialog">
            ✕ Close
          </button>
        </div>

        <div className="modal-body">
          <div className="pitch-quote">
            <p>
              <b>Scaling Principle:</b> “The same pipeline runs in dryland Algeria, the US plains, and the Indo-Gangetic Plain.
              A new region is data, not code.”
            </p>
            <p style={{ marginTop: 8 }}>
              <b>Fire Watch Principle:</b> “Fire Watch shows fires satellites detected near the region, with a clear note that it is not a forecast.”
            </p>
          </div>

          <h3>1. Three Global Regions &amp; Validation Tiers</h3>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Role</th>
                  <th>Region</th>
                  <th>Farming System</th>
                  <th>Default Sourced Crops</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>regionA</b></td>
                  <td><span className="badge sig">Deep (Validated)</span></td>
                  <td>Sétif High Plains, Algeria (36.2° N, 5.4° E)</td>
                  <td>Rainfed</td>
                  <td>Wheat, Barley, Lentil, Chickpea (+ 9 ITGC/OAIC crops)</td>
                </tr>
                <tr>
                  <td><b>regionB</b></td>
                  <td><span className="badge weak">Light (Less validated)</span></td>
                  <td>Central Kansas Plains, USA (38.8° N, 97.6° W)</td>
                  <td>Rainfed</td>
                  <td>Wheat, Corn, Soybean, Sorghum (USDA NASS)</td>
                </tr>
                <tr>
                  <td><b>regionC</b></td>
                  <td><span className="badge weak">Light (Less validated)</span></td>
                  <td>Punjab Plains, India (30.9° N, 75.9° E)</td>
                  <td>Irrigated</td>
                  <td>Rice, Wheat, Maize, Mung Bean (ICAR / PAU / FAOSTAT)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style={{ marginTop: 22 }}>2. Documented Model Scope &amp; Special Cases (Section 2.2)</h3>
          <ul className="modal-list">
            <li>
              <b>Irrigation vs. Rainfall Water Stress:</b> Rainfall-based water stress can mislead where farms are irrigated
              (such as <b>regionC — Punjab Plains, India</b> and irrigated pockets of the US Great Plains). We store a{' '}
              <code>farming_system</code> flag and display a visible banner: <i>“Water stress is based on rainfall. Irrigated farms may differ.”</i>
            </li>
            <li>
              <b>Two Crops a Year (Double Cropping Limit):</b> Many South Asian farms grow two crops per year (for example Kharif paddy rice
              followed by Rabi wheat in Punjab). Our engine currently models <b>one primary crop per year</b> across a 3-year sequence.
              Multi-season double-cropping (Kharif + Rabi within each year) is a documented future improvement.
            </li>
            <li>
              <b>Coarse Satellite Climate Grid (~50 km):</b> NASA POWER’s agroclimatology grid cells are coarse (roughly 50 km resolution),
              so one coordinate point stands for a wide area of flat farmland rather than mountain microclimates or coastal strips.
            </li>
            <li>
              <b>Light Regions (“Less validated”):</b> Light regions use public national statistics (USDA NASS for Kansas, FAOSTAT/ICAR/PAU for Punjab)
              joined with global base traits (`domain/crops_base.csv` ⋈ `domain/regions/&lt;region&gt;/yield.csv`) to demonstrate zero-code scaling.
            </li>
            <li>
              <b>Fire Watch Scope:</b> NASA FIRMS detects actively burning thermal anomalies (~3 hours old, 375 m VIIRS resolution).
              It is <b>not</b> a fire forecast, danger level, or push-alert system (no user accounts or personal contacts are stored).
            </li>
          </ul>

          <h3 style={{ marginTop: 22 }}>3. Data Sources &amp; Official Credits (Section 8)</h3>
          <ul className="modal-list">
            <li><b>NASA POWER (Prediction Of Worldwide Energy Resources):</b> Daily agroclimatology (`PRECTOTCORR`, `T2M_MAX`, `T2M_MIN`), 1995–2024.</li>
            <li><b>NASA FIRMS (Fire Information for Resource Management System):</b> VIIRS NOAA-20 / NOAA-21 375 m Near-Real-Time active fire detections.</li>
            <li><b>ECMWF / Open-Meteo ERA5-Land:</b> Independent 30-year precipitation and temperature reanalysis cross-check.</li>
            <li><b>ISRIC SoilGrids v2.0:</b> 250 m global topsoil organic carbon (`soc_g_per_kg`), pH (`phh2o`), and clay/silt/sand texture.</li>
            <li><b>NASA LP DAAC / ORNL DAAC MODIS (MOD13Q1 v061):</b> 250 m 16-day spring-peak Normalized Difference Vegetation Index (NDVI).</li>
            <li><b>Agronomic &amp; Yield Benchmarks:</b> ITGC, MADR &amp; OAIC/CCLS (Algeria); USDA NASS &amp; K-State Extension (Kansas, USA); ICAR, PAU Ludhiana &amp; FAOSTAT (Punjab, India).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

