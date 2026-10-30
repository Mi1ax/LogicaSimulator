import React, { useEffect, useRef, useState } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { SchematicCanvas } from './SchematicCanvas';
import { HexEditorView } from './HexEditorView';
import { CodeEditorView } from './CodeEditorView';
import { DebugOverlay } from '../components/DebugOverlay';

const MODE_LABELS: Record<'schematic' | 'hex' | 'code', string> = {
  schematic: 'Loading Schematic Workspace...',
  hex: 'Opening Hex Memory Editor...',
  code: 'Opening PLD / CUPL Code Editor...',
};

export const CanvasLoadingOverlay: React.FC<{ label?: string }> = ({
  label = 'Loading view...',
}) => (
  <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-[2px] select-none pointer-events-auto">
    <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/20 overflow-hidden">
      <div className="h-full w-1/3 bg-blue-500 animate-pulse" />
    </div>
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-white/95 dark:bg-slate-800/95 border border-gray-200 dark:border-slate-700 shadow-lg">
      <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
      <span className="text-xs font-mono font-medium text-gray-700 dark:text-slate-200">
        {label}
      </span>
    </div>
  </div>
);

export const CanvasArea: React.FC = () => {
  const appMode = useSimulatorStore(state => state.appMode);
  const activeSubcircuitId = useSimulatorStore(state => state.activeSubcircuitId);
  const savedCircuits = useSimulatorStore(state => state.savedCircuits);

  const [renderedMode, setRenderedMode] = useState(appMode);
  const [subcircuitLoadingLabel, setSubcircuitLoadingLabel] = useState<string | null>(null);
  const prevSubcircuitIdRef = useRef(activeSubcircuitId);

  // Switch renderedMode on the next animation frame so Topbar button highlights immediately on frame 0
  useEffect(() => {
    if (appMode === renderedMode) return;
    const raf = requestAnimationFrame(() => {
      setRenderedMode(appMode);
    });
    return () => cancelAnimationFrame(raf);
  }, [appMode, renderedMode]);

  // Brief visual indicator when switching between subcircuit tabs
  useEffect(() => {
    if (prevSubcircuitIdRef.current === activeSubcircuitId) return;
    prevSubcircuitIdRef.current = activeSubcircuitId;
    const subName = savedCircuits[activeSubcircuitId]?.name || 'Subcircuit';
    setSubcircuitLoadingLabel(`Loading "${subName}"...`);
    const timer = window.setTimeout(() => {
      setSubcircuitLoadingLabel(null);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [activeSubcircuitId, savedCircuits]);

  const activeOverlayLabel =
    appMode !== renderedMode ? MODE_LABELS[appMode] : subcircuitLoadingLabel;

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {activeOverlayLabel && <CanvasLoadingOverlay label={activeOverlayLabel} />}

      {renderedMode === 'schematic' && <SchematicCanvas />}
      {renderedMode === 'hex' && <HexEditorView />}
      {renderedMode === 'code' && <CodeEditorView />}
      {import.meta.env.DEV && <DebugOverlay />}
    </div>
  );
};
