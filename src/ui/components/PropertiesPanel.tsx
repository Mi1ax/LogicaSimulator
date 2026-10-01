import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { getNodeDefinition } from '../../core/engine/nodes';

export const PropertiesPanel: React.FC = () => {
  const selection = useSimulatorStore(state => state.selection);
  const nodes = useSimulatorStore(state => state.nodes);
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const setNodeInputCount = useSimulatorStore(state => state.setNodeInputCount);

  if (selection?.type !== 'node') return null;

  const node = nodes.find(n => n.id === selection.id);
  if (!node) return null;

  const def = getNodeDefinition(node.type);
  if (!def) return null;

  const isVariableInputGate = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'].includes(node.type);
  const isClock = node.type === 'CLOCK';

  return (
    <div className="w-64 bg-white dark:bg-slate-800 border-l border-gray-200 dark:border-slate-700 flex flex-col shadow-lg z-10 relative">
      <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 dark:text-slate-300">
          Properties
        </h2>
      </div>

      <div className="p-4 space-y-4 overflow-y-auto">
        {/* Node Type Info */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            Node Type
          </label>
          <div className="text-sm text-gray-900 dark:text-slate-100 font-medium">
            {def.label || def.type}
          </div>
        </div>

        {/* Custom Name / Label */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            Name / Label
          </label>
          <input
            type="text"
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
            value={node.properties?.label || ''}
            onChange={(e) => updateNodeProperties(node.id, { label: e.target.value })}
            placeholder="e.g. Main Clock"
          />
        </div>

        {/* Variable Inputs */}
        {isVariableInputGate && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              Number of Inputs
            </label>
            <input
              type="number"
              min={2}
              max={8}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
              value={node.inputs.length}
              onChange={(e) => {
                const count = parseInt(e.target.value, 10);
                if (!isNaN(count) && count >= 2 && count <= 8) {
                  setNodeInputCount(node.id, count);
                }
              }}
            />
          </div>
        )}

        {/* Clock Frequency */}
        {isClock && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              Toggle Interval (ticks)
            </label>
            <input
              type="number"
              min={1}
              max={100}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
              value={node.properties?.interval || 10}
              onChange={(e) => {
                const count = parseInt(e.target.value, 10);
                if (!isNaN(count) && count >= 1) {
                  updateNodeProperties(node.id, { interval: count });
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
