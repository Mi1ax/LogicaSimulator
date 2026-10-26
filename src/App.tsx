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
import { ensureRustCircuitCompiled, isTauriEnvironment } from './core/engine/tauriBridge';

function App() {
  const theme = useSimulatorStore(state => state.theme);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const stepSimulationBatch = useSimulatorStore(state => state.stepSimulationBatch);
  const lastTriggeredBpId = useSimulatorStore(state => state.lastTriggeredBreakpointId);
  const [analyzerOpen, setAnalyzerOpen] = useState<boolean>(false);

  // Fade out the single #logica-boot-splash element once React + Konva layout + Rust warmup finish
  useEffect(() => {
    const splash = document.getElementById('logica-boot-splash');
    if (!splash) return;

    let cancelled = false;
    const st = useSimulatorStore.getState();
    const warmup = isTauriEnvironment()
      ? ensureRustCircuitCompiled(st.nodes, st.wires, st.savedCircuits).catch(() => {})
      : Promise.resolve();

    warmup.finally(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (cancelled) return;
          splash.style.opacity = '0';
          splash.style.pointerEvents = 'none';
          window.setTimeout(() => {
            splash.remove();
          }, 200);
        });
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (lastTriggeredBpId) {
      setAnalyzerOpen(true);
    }
  }, [lastTriggeredBpId]);

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

    const intervalMs = Math.max(16, Math.floor(1000 / Math.max(1, simSpeed)));
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
    <div
      onDragStart={(e) => e.preventDefault()}
      className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 dark:bg-slate-900 text-gray-900 dark:text-slate-100 font-sans transition-colors relative select-none"
    >
      <Topbar />
      <div className="flex flex-1 overflow-hidden relative">
        <Toolbox />
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <CircuitTabs />
          <ErrorBoundary>
            <CanvasArea />
          </ErrorBoundary>
          {analyzerOpen && (
            <LogicAnalyzerDrawer
              isOpen={analyzerOpen}
              onToggleOpen={() => setAnalyzerOpen(prev => !prev)}
            />
          )}
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
