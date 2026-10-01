import { useEffect } from 'react';
import { Topbar } from './ui/components/Topbar';
import { Toolbox } from './ui/components/Toolbox';
import { CanvasArea } from './ui/canvas/CanvasArea';
import { PropertiesPanel } from './ui/components/PropertiesPanel';
import { useSimulatorStore } from './store/useSimulatorStore';
import { ErrorBoundary } from './ui/components/ErrorBoundary';

function App() {
  const theme = useSimulatorStore(state => state.theme);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const stepSimulation = useSimulatorStore(state => state.stepSimulation);

  // Theme Sync
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Simulation Loop
  useEffect(() => {
    if (!simRunning) return;
    const intervalMs = 1000 / simSpeed;
    const id = setInterval(stepSimulation, intervalMs);
    return () => clearInterval(id);
  }, [simRunning, simSpeed, stepSimulation]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-sans transition-colors">
      <Topbar />
      <div className="flex flex-1 overflow-hidden relative">
        <Toolbox />
        <ErrorBoundary>
          <CanvasArea />
        </ErrorBoundary>
        <PropertiesPanel />
      </div>
    </div>
  );
}

export default App;
