import React, { useState, useEffect } from 'react';
import { useFarm } from '../state/FarmContext';
import { useToast } from '../state/ToastContext';
import { REGIONS } from '../data/regions';
import { BASE_CROPS } from '../data/crops';
import {
  registerFarmer,
  loginFarmer,
  getCurrentFarmer,
  saveFarmerPlan,
  deleteFarmerPlan,
} from '../api/client';
import { computeLocalRanking } from '../utils/localEngine';

export default function FarmerAccountModal() {
  const { state, set, dispatch } = useFarm();
  const toast = useToast();

  const [tab, setTab] = useState(state.farmerUser ? 'profile' : 'login');
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState('');
  const [dbBackend, setDbBackend] = useState('postgresql');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [farmName, setFarmName] = useState('');
  const [defaultRegion, setDefaultRegion] = useState(state.region || 'regionA');
  const [preferredLang, setPreferredLang] = useState('en');
  const [farmSizeHa, setFarmSizeHa] = useState(15);
  const [planName, setPlanName] = useState('');

  useEffect(() => {
    if (state.accountOpen) {
      setErrMsg('');
      setTab(state.farmerUser ? 'profile' : 'login');
      if (state.farmerToken) {
        getCurrentFarmer(state.farmerToken).then((res) => {
          if (res?.authenticated && res.farmer) {
            set({
              farmerUser: res.farmer,
              savedPlans: Array.isArray(res.plans) ? res.plans : (state.savedPlans || []),
            });
            if (res.db?.engine) setDbBackend(res.db.engine);
          }
        });
      }
    }
  }, [state.accountOpen]);

  if (!state.accountOpen) return null;

  const close = () => set({ accountOpen: false });

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrMsg('');
    setBusy(true);
    try {
      const res = await loginFarmer({ email, password });
      if (!res?.farmer) {
        setErrMsg(res?.error || 'Could not sign in. Please check your email and password.');
      } else {
        set({
          farmerUser: res.farmer,
          farmerToken: res.token,
          savedPlans: Array.isArray(res.plans) ? res.plans : [],
        });
        if (res.db?.engine) setDbBackend(res.db.engine);
        setTab('profile');
        toast?.(`Welcome back, ${res.farmer.full_name}!`, 'ok');
      }
    } catch (err) {
      setErrMsg(err?.message || 'Sign-in error.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrMsg('');
    setBusy(true);
    try {
      const res = await registerFarmer({
        full_name: fullName,
        email,
        password,
        farm_name: farmName || `${fullName}'s Farm`,
        default_region: defaultRegion,
        preferred_lang: preferredLang,
        farm_size_ha: Number(farmSizeHa) || 10,
      });
      if (!res?.farmer) {
        setErrMsg(res?.error || 'Registration failed.');
      } else {
        set({
          farmerUser: res.farmer,
          farmerToken: res.token,
          savedPlans: Array.isArray(res.plans) ? res.plans : [],
        });
        if (res.db?.engine) setDbBackend(res.db.engine);
        setTab('profile');
        toast?.(`Farmer account created for ${res.farmer.full_name}!`, 'ok');
      }
    } catch (err) {
      setErrMsg(err?.message || 'Registration error.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = () => {
    set({ farmerUser: null, farmerToken: null, savedPlans: [] });
    setTab('login');
    toast?.('Signed out of farmer account.', 'info');
  };

  const handleSaveCurrentPlan = async (e) => {
    e.preventDefault();
    if (!state.farmerUser) return;
    setBusy(true);
    setErrMsg('');
    try {
      const ranking = computeLocalRanking({
        region: state.region,
        rotation: state.rotation,
        allowed: state.allowed,
        priorities: state.priorities,
        scenario: state.scenario,
        custom: state.custom,
      });
      const regName = REGIONS[state.region]?.short || state.region;
      const defaultTitle = `${regName} · ${state.rotation.length}-Year Plan (${new Date().toLocaleDateString()})`;
      const res = await saveFarmerPlan({
        token: state.farmerToken,
        farmer_id: state.farmerUser.id,
        plan_name: planName.trim() || defaultTitle,
        region: state.region,
        rotation: state.rotation,
        allowed: state.allowed,
        priorities: state.priorities,
        scenario: state.scenario,
        top_score: ranking?.rotations?.[0]?.scores?.final ?? null,
      });
      if (Array.isArray(res?.plans)) {
        set({ savedPlans: res.plans });
        setPlanName('');
        toast?.('Farm rotation plan saved to PostgreSQL account!', 'ok');
      } else {
        setErrMsg(res?.error || 'Could not save plan.');
      }
    } catch (err) {
      setErrMsg(err?.message || 'Failed to save plan.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoadPlan = (plan) => {
    dispatch({ type: 'loadSavedPlan', plan });
    toast?.(`Loaded "${plan.plan_name}" (${plan.rotation?.length || 3}-year rotation)`, 'ok');
    close();
  };

  const handleDeletePlan = async (planId) => {
    if (!state.farmerUser) return;
    setBusy(true);
    try {
      const res = await deleteFarmerPlan({
        token: state.farmerToken,
        plan_id: planId,
        farmer_id: state.farmerUser.id,
      });
      if (Array.isArray(res?.plans)) {
        set({ savedPlans: res.plans });
        toast?.('Saved plan removed.', 'info');
      }
    } finally {
      setBusy(false);
    }
  };

  const cropNames = (ids = []) =>
    ids.map((id) => BASE_CROPS[id]?.name || id).join(' → ');

  return (
    <div className="modal-backdrop" onClick={close} role="dialog" aria-modal="true" aria-label="Farmer Account">
      <div className="modal-card account-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <span className="account-db-badge">🐘 PostgreSQL Farmer Accounts</span>
            <h2 style={{ margin: '4px 0 0' }}>
              {state.farmerUser ? `👨‍🌾 ${state.farmerUser.full_name}` : '👨‍🌾 Farmer Account & Saved Rotations'}
            </h2>
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        {!state.farmerUser && (
          <div className="account-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              className={`account-tab ${tab === 'login' ? 'active' : ''}`}
              onClick={() => { setTab('login'); setErrMsg(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'register'}
              className={`account-tab ${tab === 'register' ? 'active' : ''}`}
              onClick={() => { setTab('register'); setErrMsg(''); }}
            >
              Create Farmer Account
            </button>
          </div>
        )}

        {errMsg && (
          <div className="account-error" role="alert">
            ⚠️ {errMsg}
          </div>
        )}

        {!state.farmerUser && tab === 'login' && (
          <form className="account-form" onSubmit={handleLogin}>
            <p className="muted" style={{ margin: '0 0 10px' }}>
              Sign in to access your saved 2, 3, 4, and 5-year crop rotation plans across Algeria, Kansas, and Punjab.
            </p>
            <label className="account-field">
              <span>Email Address</span>
              <input
                type="email"
                required
                placeholder="farmer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="account-field">
              <span>Password</span>
              <input
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div className="account-actions">
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign In'}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => { setTab('register'); setErrMsg(''); }}
              >
                Need an account? Register
              </button>
            </div>
          </form>
        )}

        {!state.farmerUser && tab === 'register' && (
          <form className="account-form" onSubmit={handleRegister}>
            <div className="account-grid-2">
              <label className="account-field">
                <span>Full Name *</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Karim Benali"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
              <label className="account-field">
                <span>Farm / Wilaya Name</span>
                <input
                  type="text"
                  placeholder="e.g. Ferme El-Hidhab Sétif"
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                />
              </label>
            </div>

            <div className="account-grid-2">
              <label className="account-field">
                <span>Email Address *</span>
                <input
                  type="email"
                  required
                  placeholder="farmer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="account-field">
                <span>Password (min 6 chars) *</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>

            <div className="account-grid-3">
              <label className="account-field">
                <span>Primary Region</span>
                <select value={defaultRegion} onChange={(e) => setDefaultRegion(e.target.value)}>
                  <option value="regionA">🇩🇿 Sétif / Algeria</option>
                  <option value="regionB">🇺🇸 Western Kansas</option>
                  <option value="regionC">🇮🇳 Central Punjab</option>
                </select>
              </label>
              <label className="account-field">
                <span>Preferred Language</span>
                <select value={preferredLang} onChange={(e) => setPreferredLang(e.target.value)}>
                  <option value="en">English (EN)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="ar">العربية (AR)</option>
                </select>
              </label>
              <label className="account-field">
                <span>Farm Size (ha)</span>
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={farmSizeHa}
                  onChange={(e) => setFarmSizeHa(e.target.value)}
                />
              </label>
            </div>

            <div className="account-actions">
              <button type="submit" className="btn primary" disabled={busy}>
                {busy ? 'Creating Account…' : 'Create PostgreSQL Farmer Account'}
              </button>
            </div>
          </form>
        )}

        {state.farmerUser && (
          <div className="account-profile">
            <div className="account-profile-summary">
              <div>
                <strong>{state.farmerUser.farm_name || 'Registered Farm'}</strong>
                <div className="muted" style={{ fontSize: '0.84rem' }}>
                  {state.farmerUser.email} · {state.farmerUser.farm_size_ha || 10} ha · Primary Region:{' '}
                  {REGIONS[state.farmerUser.default_region]?.short || state.farmerUser.default_region} · Storage:{' '}
                  <code>{dbBackend}</code>
                </div>
              </div>
              <button type="button" className="btn ghost sm" onClick={handleLogout}>
                Sign Out
              </button>
            </div>

            <form className="account-save-bar" onSubmit={handleSaveCurrentPlan}>
              <div style={{ flex: 1 }}>
                <label className="account-field" style={{ marginBottom: 0 }}>
                  <span>
                    Save Active Rotation ({REGIONS[state.region]?.short || state.region}:{' '}
                    <strong>{cropNames(state.rotation)}</strong>)
                  </span>
                  <input
                    type="text"
                    placeholder="Optional plan title (e.g. Sétif Drought-Safe 4-Year Rotation)"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                  />
                </label>
              </div>
              <button type="submit" className="btn primary" disabled={busy}>
                💾 Save Current Plan
              </button>
            </form>

            <div className="account-plans-section">
              <h3 style={{ margin: '12px 0 8px', fontSize: '0.96rem' }}>
                Saved Crop Rotation Plans ({(state.savedPlans || []).length})
              </h3>
              {(!state.savedPlans || state.savedPlans.length === 0) ? (
                <p className="muted" style={{ margin: 0 }}>
                  No saved plans yet. Click <strong>💾 Save Current Plan</strong> above to store your active rotation in PostgreSQL.
                </p>
              ) : (
                <div className="account-plans-list">
                  {state.savedPlans.map((p) => (
                    <div key={p.id} className="account-plan-item">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.93rem' }}>
                          {p.plan_name}{' '}
                          {p.top_score != null && (
                            <span className="account-score-pill">Top Score: {Math.round(p.top_score)}/100</span>
                          )}
                        </div>
                        <div className="muted" style={{ fontSize: '0.82rem' }}>
                          {REGIONS[p.region]?.short || p.region} · {p.rotation_years || (p.rotation || []).length} Years:{' '}
                          <strong>{cropNames(p.rotation || [])}</strong>
                        </div>
                      </div>
                      <div className="account-plan-btns">
                        <button
                          type="button"
                          className="btn secondary sm"
                          onClick={() => handleLoadPlan(p)}
                        >
                          Load into Planner
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => handleDeletePlan(p.id)}
                          aria-label={`Delete ${p.plan_name}`}
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
