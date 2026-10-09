import React from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { getNodeDefinition } from '../../core/engine/nodes';
import { getSafePinNumber } from '../../core/utils/layoutUtils';
import { NumberInput } from './NumberInput';

export const PropertiesPanel: React.FC = () => {
  const selection = useSimulatorStore(state => state.selection);
  const multiSelection = useSimulatorStore(state => state.multiSelection);
  const nodes = useSimulatorStore(state => state.nodes);
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const setNodeInputCount = useSimulatorStore(state => state.setNodeInputCount);
  const setNodeOutputCount = useSimulatorStore(state => state.setNodeOutputCount);
  const appMode = useSimulatorStore(state => state.appMode);

  const node = selection?.type === 'node' ? nodes.find(n => n.id === selection.id) : undefined;

  const [localLabel, setLocalLabel] = React.useState(node?.properties?.label || '');
  
  React.useEffect(() => {
    setLocalLabel(node?.properties?.label || '');
  }, [node?.id, node?.properties?.label]);

  if (multiSelection && multiSelection.length > 1) return null;

  if (!node || node.type === 'JUNCTION') return null;

  const def = getNodeDefinition(node.type);
  if (!def) return null;

  const isVariableInputGate = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'XNOR'].includes(node.type);
  const isVariableOutputGate = ['DIP_SWITCH'].includes(node.type);
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
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={() => {
              if (localLabel !== (node.properties?.label || '')) {
                updateNodeProperties(node.id, { label: localLabel });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur();
              }
            }}
            placeholder="e.g. Main Clock"
          />
        </div>

        {/* Rotation */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
            {appMode === 'board' ? 'Board Rotation' : 'Schematic Rotation'}
          </label>
          <select
            className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
            value={appMode === 'board' ? (node.properties?.boardRotation || 0) : (node.properties?.rotation || 0)}
            onChange={(e) => {
              if (appMode === 'board') {
                updateNodeProperties(node.id, { boardRotation: parseInt(e.target.value, 10) });
              } else {
                updateNodeProperties(node.id, { rotation: parseInt(e.target.value, 10) });
              }
            }}
          >
            <option value={0}>0°</option>
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </div>

        {/* Flip Controls (Schematic Only) */}
        {appMode === 'schematic' && (
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={!!node.properties?.flipX}
                onChange={(e) => updateNodeProperties(node.id, { flipX: e.target.checked })}
              />
              Flip X
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={!!node.properties?.flipY}
                onChange={(e) => updateNodeProperties(node.id, { flipY: e.target.checked })}
              />
              Flip Y
            </label>
          </div>
        )}

        {/* 7-Segment Type */}
        {node.type === '7_SEG_DISPLAY' && (
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={!!node.properties?.commonAnode}
                onChange={(e) => updateNodeProperties(node.id, { commonAnode: e.target.checked })}
              />
              Common Anode (Active Low)
            </label>
          </div>
        )}

        {/* Variable Inputs */}
        {isVariableInputGate && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              Number of Inputs
            </label>
            <NumberInput
              min={2}
              max={8}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
              value={node.inputs.length}
              onChangeValue={(val) => setNodeInputCount(node.id, val)}
              fallbackValue={node.inputs.length}
            />
          </div>
        )}

        {/* Variable Outputs */}
        {isVariableOutputGate && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              Number of Outputs (Switches)
            </label>
            <NumberInput
              min={1}
              max={12}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
              value={node.outputs.length}
              onChangeValue={(val) => setNodeOutputCount(node.id, val)}
              fallbackValue={node.outputs.length}
            />
          </div>
        )}

        {/* Clock Frequency */}
        {isClock && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                High Ticks
              </label>
              <NumberInput
                min={1}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                value={node.properties?.highTicks ?? node.properties?.interval ?? 5}
                onChangeValue={(val) => updateNodeProperties(node.id, { highTicks: val })}
                fallbackValue={node.properties?.highTicks ?? node.properties?.interval ?? 5}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                Low Ticks
              </label>
              <NumberInput
                min={1}
                className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                value={node.properties?.lowTicks ?? node.properties?.interval ?? 5}
                onChangeValue={(val) => updateNodeProperties(node.id, { lowTicks: val })}
                fallbackValue={node.properties?.lowTicks ?? node.properties?.interval ?? 5}
              />
            </div>
          </div>
        )}

        {/* Memory Editor Button */}
        {['27C256', '62256'].includes(node.type) && (
          <div className="mt-4">
            <button
              onClick={() => {
                const store = useSimulatorStore.getState();
                store.setSelectedMemoryNodeId(node.id);
                store.setAppMode('hex');
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors text-sm"
            >
              Open Hex Viewer
            </button>
          </div>
        )}

        {/* DIP Pinout Diagram */}
        {(node.properties?.renderAs === 'DIP' || def.renderAs === 'DIP') && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-3 text-center">
              DIP Pinout
            </label>
            <div className="flex justify-center">
              <div className="relative bg-slate-800 rounded-md border border-slate-900 shadow-inner w-32 py-2">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gray-50 dark:bg-slate-900 rounded-full"></div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 border border-slate-900 rounded-full clip-notch"></div>

                <div className="flex justify-between px-1">
                  {/* Left Pins */}
                  <div className="flex flex-col gap-1 items-start">
                    {(() => {
                      const allPins = [...node.inputs, ...node.outputs];
                      const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
                      const pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
                      const leftPins = Array.from({ length: pinsPerSide }, (_, i) => i + 1);
                      return leftPins.map(pinNum => {
                        const p = allPins.find(pin => getSafePinNumber(node.type, pin) === pinNum);
                        return (
                          <div key={`L${pinNum}`} className="flex items-center gap-1 text-[10px]">
                            <div className="w-4 h-2 bg-slate-300 rounded-sm flex items-center justify-center text-[8px] font-bold text-slate-800 -ml-3 z-10 border border-slate-400">{pinNum}</div>
                            <span className="text-slate-300 ml-1 font-mono">{p?.name || 'NC'}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                  
                  {/* Right Pins */}
                  <div className="flex flex-col gap-1 items-end">
                    {(() => {
                      const allPins = [...node.inputs, ...node.outputs];
                      const maxPinNumber = allPins.reduce((max, p) => Math.max(max, getSafePinNumber(node.type, p) ?? 0), 0);
                      const pinsPerSide = Math.max(Math.ceil(allPins.length / 2), Math.ceil(maxPinNumber / 2));
                      const rightPins = Array.from({ length: pinsPerSide }, (_, i) => pinsPerSide * 2 - i);
                      return rightPins.map(pinNum => {
                        const p = allPins.find(pin => getSafePinNumber(node.type, pin) === pinNum);
                        return (
                          <div key={`R${pinNum}`} className="flex items-center gap-1 text-[10px]">
                            <span className="text-slate-300 mr-1 font-mono">{p?.name || 'NC'}</span>
                            <div className="w-4 h-2 bg-slate-300 rounded-sm flex items-center justify-center text-[8px] font-bold text-slate-800 -mr-3 z-10 border border-slate-400">{pinNum}</div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
