import { I18nProvider, useT } from './i18n/I18nContext';
import { FarmProvider } from './state/FarmContext';
import { NavProvider, useNav } from './state/NavContext';
import { ToastProvider } from './state/ToastContext';
import { AnalysisProvider } from './state/AnalysisContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import LoginView from './views/LoginView';
import Header from './components/layout/Header';
import Progress from './components/layout/Progress';
import Footer from './components/layout/Footer';
import Landing from './views/Landing';
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

const VIEWS = {
  home: Landing,          // 1.1
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
};

function Shell() {
  const t = useT();
  const { view } = useNav();
  const View = VIEWS[view];
  return (
    <>
      <a className="skip" href="#main">{t('common.skip')}</a>
      <Header />
      {view === 'home' ? (
        <>
          <main id="main" tabIndex={-1} className="view" key="home"><Landing /></main>
          <Footer />
        </>
      ) : (
        <div className="app-shell">
          <Progress />
          <div className="app-content">
            <main className="main" id="main" tabIndex={-1}>
              <div className="wrap view" key={view}><View /></div>
            </main>
            <Footer />
          </div>
        </div>
      )}
      <Report />
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
