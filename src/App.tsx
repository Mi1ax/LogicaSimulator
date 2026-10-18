import { useEffect, useRef, useState } from 'react';
import { Topbar } from './ui/components/Topbar';
import { Bottombar } from './ui/components/Bottombar';
import { Toolbox } from './ui/components/Toolbox';
import { CanvasArea } from './ui/canvas/CanvasArea';
import { PropertiesPanel } from './ui/components/PropertiesPanel';
import { useSimulatorStore } from './store/useSimulatorStore';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { CircuitTabs } from './ui/components/CircuitTabs';
import { LogicAnalyzerDrawer } from './ui/components/LogicAnalyzerDrawer';

function App() {
  const theme = useSimulatorStore(state => state.theme);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const stepSimulationBatch = useSimulatorStore(state => state.stepSimulationBatch);
  const [analyzerOpen, setAnalyzerOpen] = useState<boolean>(true);

  // Theme Sync
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Simulation Loop
  const lastSimTimeRef = useRef<number>(0);
  const accumulatedTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!simRunning) return;

    // Wake up only at the needed tick rate for low frequencies (e.g. 100ms for 10Hz),
    // and cap batch UI flushes at ~30 FPS (33ms) for high frequencies to avoid burning CPU/GPU at 60-165Hz.
    const intervalMs = Math.max(33, Math.floor(1000 / Math.max(1, simSpeed)));
    lastSimTimeRef.current = performance.now();
    accumulatedTimeRef.current = 0;

    const timerId = window.setInterval(() => {
      const now = performance.now();
      const deltaTime = now - lastSimTimeRef.current;
      lastSimTimeRef.current = now;

      // Cap deltaTime at 100ms to avoid huge lag spikes if tab is suspended
      accumulatedTimeRef.current += Math.min(deltaTime, 100);

      const msPerTick = 1000 / simSpeed;
      if (accumulatedTimeRef.current >= msPerTick) {
        const ticksToRun = Math.floor(accumulatedTimeRef.current / msPerTick);
        accumulatedTimeRef.current -= ticksToRun * msPerTick;
        stepSimulationBatch(ticksToRun);
      }
    }, intervalMs);

    return () => {
      window.clearInterval(timerId);
      lastSimTimeRef.current = 0;
      accumulatedTimeRef.current = 0;
    };
  }, [simRunning, simSpeed, stepSimulationBatch]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-sans transition-colors relative">
      <Topbar />
      <div className="flex flex-1 overflow-hidden relative">
        <Toolbox />
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <CircuitTabs />
          <ErrorBoundary>
            <CanvasArea />
          </ErrorBoundary>
          <LogicAnalyzerDrawer
            isOpen={analyzerOpen}
            onToggleOpen={() => setAnalyzerOpen(prev => !prev)}
          />
        </div>
        <PropertiesPanel />
      </div>
      <Bottombar
        analyzerOpen={analyzerOpen}
        onToggleAnalyzer={() => setAnalyzerOpen(prev => !prev)}
      />
    </div>
  );
}

export default App;
