import { useEffect, useRef } from 'react';
import { Topbar } from './ui/components/Topbar';
import { Bottombar } from './ui/components/Bottombar';
import { Toolbox } from './ui/components/Toolbox';
import { CanvasArea } from './ui/canvas/CanvasArea';
import { PropertiesPanel } from './ui/components/PropertiesPanel';
import { useSimulatorStore } from './store/useSimulatorStore';
import { ErrorBoundary } from './ui/components/ErrorBoundary';

import { RomEditorModal } from './ui/components/RomEditorModal';

function App() {
  const theme = useSimulatorStore(state => state.theme);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const stepSimulationBatch = useSimulatorStore(state => state.stepSimulationBatch);
  const openRomEditors = useSimulatorStore(state => state.openRomEditors);
  const toggleRomEditor = useSimulatorStore(state => state.toggleRomEditor);

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

    let reqId: number;

    const loop = (timestamp: number) => {
      if (lastSimTimeRef.current === 0) {
        lastSimTimeRef.current = timestamp;
      }

      const deltaTime = timestamp - lastSimTimeRef.current;
      lastSimTimeRef.current = timestamp;

      // Cap deltaTime at 100ms to avoid huge lag spikes if tab is suspended
      accumulatedTimeRef.current += Math.min(deltaTime, 100);

      const msPerTick = 1000 / simSpeed;
      
      if (accumulatedTimeRef.current >= msPerTick) {
        const ticksToRun = Math.floor(accumulatedTimeRef.current / msPerTick);
        accumulatedTimeRef.current -= ticksToRun * msPerTick;
        stepSimulationBatch(ticksToRun);
      }

      reqId = requestAnimationFrame(loop);
    };

    reqId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(reqId);
      lastSimTimeRef.current = 0;
      accumulatedTimeRef.current = 0;
    };
  }, [simRunning, simSpeed, stepSimulationBatch]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-sans transition-colors relative">
      <Topbar />
      <div className="flex flex-1 overflow-hidden relative">
        <Toolbox />
        <ErrorBoundary>
          <CanvasArea />
        </ErrorBoundary>
        <PropertiesPanel />
      </div>
      <Bottombar />
      
      {openRomEditors.map(id => (
        <RomEditorModal key={id} nodeId={id} onClose={() => toggleRomEditor(id, false)} />
      ))}
    </div>
  );
}

export default App;
