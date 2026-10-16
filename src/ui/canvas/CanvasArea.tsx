import React, { Suspense, lazy } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { SchematicCanvas } from './SchematicCanvas';

const HexEditorView = lazy(() =>
  import('./HexEditorView').then(m => ({ default: m.HexEditorView }))
);
const CodeEditorView = lazy(() =>
  import('./CodeEditorView').then(m => ({ default: m.CodeEditorView }))
);
const Ne555LabView = lazy(() =>
  import('./Ne555LabView').then(m => ({ default: m.Ne555LabView }))
);

export const CanvasArea: React.FC = () => {
  const appMode = useSimulatorStore(state => state.appMode);

  if (appMode === 'schematic') {
    return <SchematicCanvas />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center text-xs font-mono text-gray-400 dark:text-slate-500">
          Loading view...
        </div>
      }
    >
      {appMode === 'hex' && <HexEditorView />}
      {appMode === 'code' && <CodeEditorView />}
      {appMode === 'ne555' && <Ne555LabView />}
    </Suspense>
  );
};
