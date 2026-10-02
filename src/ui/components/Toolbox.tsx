import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { NodeType } from '../../core/models/types';
import { BoxSelect, Cpu, ToggleLeft, Lightbulb, Timer, Zap } from 'lucide-react';
import { getNodeDefinition } from '../../core/engine/nodes';

interface ToolCategory {
  name: string;
  items: { type: NodeType; icon: React.ReactNode }[];
}

const CATEGORIES: ToolCategory[] = [
  {
    name: 'Power & I/O',
    items: [
      { type: 'VCC', icon: <Zap size={18} /> },
      { type: 'GND', icon: <Zap size={18} /> },
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
      { type: '74LS161', icon: <Cpu size={18} /> },
    ]
  }
];

export const Toolbox: React.FC = () => {
  const startPlacingNode = useSimulatorStore((state) => state.startPlacingNode);
  const [search, setSearch] = React.useState('');

  const handleAddNode = (type: NodeType) => {
    startPlacingNode(type);
  };

  const filteredCategories = CATEGORIES.map(category => ({
    ...category,
    items: category.items.filter(tool => {
      const def = getNodeDefinition(tool.type);
      const label = def?.label ?? tool.type;
      return label.toLowerCase().includes(search.toLowerCase()) || tool.type.toLowerCase().includes(search.toLowerCase());
    })
  })).filter(category => category.items.length > 0);

  const appMode = useSimulatorStore(state => state.appMode);
  const nodes = useSimulatorStore(state => state.nodes);

  if (appMode === 'board') {
    const unplacedNodes = nodes.filter(n => n.boardX === undefined || n.boardY === undefined);
    
    return (
      <div className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col shadow-lg z-10 relative">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
            Unplaced Components
          </h2>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          {unplacedNodes.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-slate-400 text-center mt-4">
              <p>No components to place.</p>
              <p className="mt-2 text-xs">Switch to Schematic mode to add more.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {unplacedNodes.map(node => {
                const def = getNodeDefinition(node.type);
                const label = node.properties?.label || def?.label || node.type;
                return (
                  <button
                    key={node.id}
                    onClick={() => {
                      const startPlacingBoardNode = useSimulatorStore.getState().startPlacingBoardNode;
                      startPlacingBoardNode(node.id);
                    }}
                    className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded shadow-sm hover:border-blue-500 hover:shadow-md transition-all text-left group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 dark:text-slate-100 truncate">
                        {label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-slate-400">
                        {def?.label || node.type}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 bg-gray-100 dark:bg-slate-800 border-r border-gray-300 dark:border-slate-700 h-full flex flex-col shadow-sm z-10 relative transition-colors overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex flex-col gap-3">
        <h2 className="text-lg font-bold text-gray-800 dark:text-slate-100">Components</h2>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500"
        />
      </div>

      <div className="flex flex-col p-4 gap-6">
        {filteredCategories.map((category) => (
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
        {filteredCategories.length === 0 && (
          <div className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">
            No components found.
          </div>
        )}
      </div>
    </div>
  );
};
