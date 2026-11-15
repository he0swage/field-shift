import { I18nProvider, useT } from './i18n/I18nContext';
import { FarmProvider } from './state/FarmContext';
import { JOURNEY, NavProvider, useNav } from './state/NavContext';
import { ToastProvider } from './state/ToastContext';
import { AnalysisProvider } from './state/AnalysisContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import LoginView from './views/LoginView';
import { useEffect } from 'react';
import Header from './components/layout/Header';
import Progress from './components/layout/Progress';
import Footer from './components/layout/Footer';
import AboutView from './views/AboutView';
import RegionView from './views/RegionView';
import StrategyView from './views/StrategyView';
import ClimateView from './views/ClimateView';
import ExtremeView from './views/ExtremeView';
import MonthlyView from './views/MonthlyView';
import TopView from './views/TopView';
import AvoidView from './views/AvoidView';
import SummaryView from './views/SummaryView';
import MapView from './views/MapView';
import CompareView from './views/CompareView';
import Report from './views/Report';
import AgronomyAssistant from './components/AgronomyAssistant';
import FarmerAccountModal from './components/FarmerAccountModal';

const VIEWS = {
  region: RegionView,     // 1.2
  strategy: StrategyView, // 1.3
  climate: ClimateView,   // 2.1
  extreme: ExtremeView,   // 2.2
  monthly: MonthlyView,   // 2.3
  top: TopView,           // 3.1
  avoid: AvoidView,       // 3.2
  summary: SummaryView,   // 4.1
  map: MapView,           // additional: regional climate map
  compare: CompareView,   // additional: usual vs rank 1
  about: AboutView,       // data & resources, team, AI disclosure
};

/** Fade sections up as they scroll into view (elements with class "reveal"). */
function useReveal(key) {
  useEffect(() => {
    const els = [...document.querySelectorAll('.reveal:not(.in)')];
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return undefined; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  });
}

function Shell() {
  const t = useT();
  const { view } = useNav();
  const View = VIEWS[view];
  useReveal(view);
  const journey = JOURNEY.includes(view);
  return (
    <>
      <a className="skip" href="#main">{t('common.skip')}</a>
      <Header />
      {journey && <Progress />}
      {view === 'region' ? (
        <main id="main" tabIndex={-1} className="view" key="region"><View /></main>
      ) : (
        <main className="main" id="main" tabIndex={-1}>
          <div className="wrap view" key={view}><View /></div>
        </main>
      )}
      <Footer />
      <Report />
      <FarmerAccountModal />
      <AgronomyAssistant floating />
    </>
  );
}

/** Login first; once signed in (or as a guest) the app opens on the landing page. */
function Gate() {
  const { user } = useAuth();
  if (!user) return <LoginView />;
  return (
    <FarmProvider>
      <ToastProvider>
        <AnalysisProvider>
          <NavProvider>
            <Shell />
          </NavProvider>
        </AnalysisProvider>
      </ToastProvider>
    </FarmProvider>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </I18nProvider>
  );
}
