import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { NodeType } from '../../core/models/types';
import { BoxSelect, Cpu, ToggleLeft, Lightbulb, Timer } from 'lucide-react';

import { getNodeDefinition } from '../../core/engine/nodes';

const TOOLS: { type: NodeType; icon: React.ReactNode }[] = [
  { type: 'INPUT', icon: <ToggleLeft size={18} /> },
  { type: 'OUTPUT', icon: <Lightbulb size={18} /> },
  { type: 'CLOCK', icon: <Timer size={18} /> },
  { type: 'AND', icon: <Cpu size={18} /> },
  { type: 'OR', icon: <Cpu size={18} /> },
  { type: 'NOT', icon: <BoxSelect size={18} /> },
];

export const Toolbox: React.FC = () => {
  const addNode = useSimulatorStore((state) => state.addNode);

  const handleAddNode = (type: NodeType) => {
    // Add to center of screen roughly
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    addNode(type, centerX, centerY);
  };

  return (
    <div className="w-64 bg-gray-100 dark:bg-slate-800 border-r border-gray-300 dark:border-slate-700 h-full flex flex-col p-4 shadow-sm z-10 relative transition-colors">
      <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-slate-100">Components</h2>
      <div className="flex flex-col gap-2">
        {TOOLS.map((tool) => (
          <button
            key={tool.type}
            onClick={() => handleAddNode(tool.type)}
            className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md hover:bg-blue-50 dark:hover:bg-slate-700 hover:border-blue-300 dark:hover:border-slate-600 transition-colors text-left text-sm font-medium text-gray-700 dark:text-slate-200 shadow-sm"
          >
            <span className="text-blue-600 dark:text-blue-400">{tool.icon}</span>
            {getNodeDefinition(tool.type)?.label ?? tool.type}
          </button>
        ))}
      </div>
    </div>
  );
};
