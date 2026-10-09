import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { SchematicCanvas } from './SchematicCanvas';
import { BoardCanvas } from './BoardCanvas';
import { HexEditorView } from './HexEditorView';
import { CodeEditorView } from './CodeEditorView';

export const CanvasArea: React.FC = () => {
  const appMode = useSimulatorStore(state => state.appMode);
  
  if (appMode === 'schematic') {
    return <SchematicCanvas />;
  } else if (appMode === 'board') {
    return <BoardCanvas />;
  } else if (appMode === 'hex') {
    return <HexEditorView />;
  } else if (appMode === 'code') {
    return <CodeEditorView />;
  }
  
  return null;
};
