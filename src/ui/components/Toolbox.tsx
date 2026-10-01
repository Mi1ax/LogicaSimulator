import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { NodeType } from '../../core/models/types';
import { BoxSelect, Cpu, ToggleLeft, Lightbulb, Timer } from 'lucide-react';
import { getNodeDefinition } from '../../core/engine/nodes';

interface ToolCategory {
  name: string;
  items: { type: NodeType; icon: React.ReactNode }[];
}

const CATEGORIES: ToolCategory[] = [
  {
    name: 'I/O & Timing',
    items: [
      { type: 'INPUT', icon: <ToggleLeft size={18} /> },
      { type: 'OUTPUT', icon: <Lightbulb size={18} /> },
      { type: 'CLOCK', icon: <Timer size={18} /> },
    ]
  },
  {
    name: 'Basic Logic',
    items: [
      { type: 'AND', icon: <Cpu size={18} /> },
      { type: 'OR', icon: <Cpu size={18} /> },
      { type: 'NOR', icon: <Cpu size={18} /> },
      { type: 'NOT', icon: <BoxSelect size={18} /> },
      { type: 'XOR', icon: <Cpu size={18} /> },
    ]
  },
  {
    name: 'Integrated Circuits',
    items: [
      { type: '74LS08', icon: <Cpu size={18} /> },
    ]
  }
];

export const Toolbox: React.FC = () => {
  const addNode = useSimulatorStore((state) => state.addNode);

  const handleAddNode = (type: NodeType) => {
    // Add to center of screen roughly, snapped to 20px grid
    const centerX = Math.round((window.innerWidth / 2) / 20) * 20;
    const centerY = Math.round((window.innerHeight / 2) / 20) * 20;
    addNode(type, centerX, centerY);
  };

  return (
    <div className="w-64 bg-gray-100 dark:bg-slate-800 border-r border-gray-300 dark:border-slate-700 h-full flex flex-col shadow-sm z-10 relative transition-colors overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">Components</h2>
      </div>

      <div className="flex flex-col p-4 gap-6">
        {CATEGORIES.map((category) => (
          <div key={category.name} className="flex flex-col gap-2">
            <h3 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider px-1">
              {category.name}
            </h3>
            <div className="flex flex-col gap-2">
              {category.items.map((tool) => (
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
        ))}
      </div>
    </div>
  );
};
