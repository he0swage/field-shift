import { FarmProvider } from './state/FarmContext';
import { NavProvider, useNav } from './state/NavContext';
import { ToastProvider } from './state/ToastContext';
import { Header, StepMenu } from './components/Layout';
import RegionStep from './steps/RegionStep';
import RotationStep from './steps/RotationStep';
import PrioritiesStep from './steps/PrioritiesStep';
import ReviewStep from './steps/ReviewStep';
import ClimateStep from './steps/ClimateStep';
import RankingStep from './steps/RankingStep';

const STEP_COMPONENTS = {
  1: RegionStep,
  2: RotationStep,
  3: PrioritiesStep,
  4: ReviewStep,
  5: ClimateStep,
  6: RankingStep,
};

function CurrentStep() {
  const { step } = useNav();
  const Step = STEP_COMPONENTS[step];
  return <Step />;
}

export default function App() {
  return (
    <FarmProvider>
      <NavProvider>
        <ToastProvider>
          <a className="skip" href="#main">Skip to content</a>
          <Header />
          <StepMenu />
          <main className="main" id="main" tabIndex={-1}>
            <CurrentStep />
          </main>
        </ToastProvider>
      </NavProvider>
    </FarmProvider>
  );
}
