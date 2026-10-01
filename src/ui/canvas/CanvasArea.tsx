import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { SchematicCanvas } from './SchematicCanvas';
import { BoardCanvas } from './BoardCanvas';

export const CanvasArea: React.FC = () => {
  const appMode = useSimulatorStore(state => state.appMode);
  
  if (appMode === 'schematic') {
    return <SchematicCanvas />;
  } else {
    return <BoardCanvas />;
  }
};
