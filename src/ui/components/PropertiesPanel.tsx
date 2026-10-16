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
  const simSpeed = useSimulatorStore(state => state.simSpeed);
  const simRunning = useSimulatorStore(state => state.simRunning);
  const toggleInputNode = useSimulatorStore(state => state.toggleInputNode);

  const node = selection?.type === 'node' ? nodes.find(n => n.id === selection.id) : undefined;

  const [localLabel, setLocalLabel] = React.useState(node?.properties?.label || '');
  
  React.useEffect(() => {
    setLocalLabel(node?.properties?.label || '');
  }, [node?.id, node?.properties?.label]);

  if (multiSelection && multiSelection.length > 1) return null;

  if (!node || node.type === 'JUNCTION') return null;

  const def = getNodeDefinition(node.type);
  if (!def) return null;

  const isClock = node.type === 'CLOCK';
  const isClockLike = node.type === 'CLOCK' || node.type === 'NE555';

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

        {/* Flip Controls (Schematic Only) */}
        {appMode === 'schematic' && !def.disableTransform && (
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-slate-400 cursor-pointer" title="Hotkey: X">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-gray-50 dark:bg-slate-900"
                checked={!!node.properties?.flipX}
                onChange={(e) => updateNodeProperties(node.id, { flipX: e.target.checked })}
              />
              Flip X (X)
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-slate-400 cursor-pointer" title="Hotkey: Y">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-gray-50 dark:bg-slate-900"
                checked={!!node.properties?.flipY}
                onChange={(e) => updateNodeProperties(node.id, { flipY: e.target.checked })}
              />
              Flip Y (Y)
            </label>
          </div>
        )}

        {/* Annotation Controls (Region Box / Text Label / Sticky Note) */}
        {(node.type === 'REGION_BOX' || node.type === 'TEXT_LABEL' || node.type === 'STICKY_NOTE') && (() => {
          const colorSwatches = [
            ...(node.type === 'TEXT_LABEL' ? [{ id: 'default', label: 'Default', hex: '#94a3b8' }] : []),
            { id: 'blue', label: 'Blue', hex: '#3b82f6' },
            { id: 'emerald', label: 'Green', hex: '#10b981' },
            { id: 'amber', label: 'Amber', hex: '#f59e0b' },
            { id: 'rose', label: 'Rose', hex: '#f43f5e' },
            { id: 'purple', label: 'Purple', hex: '#a855f7' },
            { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
            { id: 'slate', label: 'Slate', hex: '#64748b' },
          ];
          const activeColor = node.properties?.color || (node.type === 'STICKY_NOTE' ? 'amber' : node.type === 'REGION_BOX' ? 'blue' : 'default');

          return (
            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-slate-700">
              {/* Color Picker */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">
                  Color Theme
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {colorSwatches.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      title={s.label}
                      onClick={() => updateNodeProperties(node.id, { color: s.id })}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        activeColor === s.id
                          ? 'border-gray-900 dark:border-white scale-110 shadow-sm'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: s.hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Dimensions for Region Box & Sticky Note */}
              {(node.type === 'REGION_BOX' || node.type === 'STICKY_NOTE') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Width (px)
                    </label>
                    <NumberInput
                      min={node.type === 'STICKY_NOTE' ? 100 : 60}
                      max={4000}
                      step={20}
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                      value={Number(node.properties?.width) || 240}
                      onChangeValue={(val) => updateNodeProperties(node.id, { width: Math.round(val / 20) * 20 })}
                      fallbackValue={240}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Height (px)
                    </label>
                    <NumberInput
                      min={60}
                      max={4000}
                      step={20}
                      className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                      value={Number(node.properties?.height) || 160}
                      onChangeValue={(val) => updateNodeProperties(node.id, { height: Math.round(val / 20) * 20 })}
                      fallbackValue={160}
                    />
                  </div>
                </div>
              )}

              {/* Region Box Border & Fill Opacity */}
              {node.type === 'REGION_BOX' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Border Style
                    </label>
                    <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-slate-900 p-1 rounded-md">
                      {(['dashed', 'solid', 'dotted'] as const).map(style => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => updateNodeProperties(node.id, { borderStyle: style })}
                          className={`py-1 text-xs font-medium rounded capitalize transition-colors ${
                            (node.properties?.borderStyle || 'dashed') === style
                              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Background Tint
                    </label>
                    <div className="grid grid-cols-5 gap-1 bg-gray-100 dark:bg-slate-900 p-1 rounded-md">
                      {[
                        { label: '0%', val: 0 },
                        { label: '4%', val: 0.04 },
                        { label: '8%', val: 0.08 },
                        { label: '15%', val: 0.15 },
                        { label: '25%', val: 0.25 },
                      ].map(opt => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => updateNodeProperties(node.id, { fillOpacity: opt.val })}
                          className={`py-1 text-[11px] font-medium rounded transition-colors ${
                            (node.properties?.fillOpacity ?? 0.08) === opt.val
                              ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                              : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Sticky Note Body Text */}
              {node.type === 'STICKY_NOTE' && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                    Note Text
                  </label>
                  <textarea
                    rows={5}
                    className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100 resize-y"
                    value={node.properties?.text ?? ''}
                    onChange={(e) => updateNodeProperties(node.id, { text: e.target.value })}
                    placeholder="Write notes, truth tables, or pin descriptions..."
                  />
                </div>
              )}

              {/* Typography Controls for Text Label & Sticky Note */}
              {(node.type === 'TEXT_LABEL' || node.type === 'STICKY_NOTE') && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Font Size (px)
                    </label>
                    <div className="flex gap-1.5 items-center">
                      <NumberInput
                        min={9}
                        max={96}
                        className="w-20 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                        value={Number(node.properties?.fontSize) || (node.type === 'TEXT_LABEL' ? 20 : 12)}
                        onChangeValue={(val) => updateNodeProperties(node.id, { fontSize: val })}
                        fallbackValue={node.type === 'TEXT_LABEL' ? 20 : 12}
                      />
                      {node.type === 'TEXT_LABEL' && (
                        <div className="flex gap-1 flex-1">
                          {[14, 20, 28, 36].map(sz => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => updateNodeProperties(node.id, { fontSize: sz })}
                              className={`flex-1 py-1 text-[11px] font-medium rounded border transition-colors ${
                                (Number(node.properties?.fontSize) || 20) === sz
                                  ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-400 text-blue-600 dark:text-blue-400'
                                  : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {node.type === 'TEXT_LABEL' && (
                      <>
                        <button
                          type="button"
                          onClick={() => updateNodeProperties(node.id, { bold: !(node.properties?.bold !== false) })}
                          className={`flex-1 py-1 text-xs font-bold rounded border transition-colors ${
                            node.properties?.bold !== false
                              ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-400 text-blue-600 dark:text-blue-400'
                              : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                          }`}
                        >
                          B
                        </button>
                        <button
                          type="button"
                          onClick={() => updateNodeProperties(node.id, { italic: !node.properties?.italic })}
                          className={`flex-1 py-1 text-xs italic rounded border transition-colors ${
                            node.properties?.italic
                              ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-400 text-blue-600 dark:text-blue-400'
                              : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                          }`}
                        >
                          I
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        updateNodeProperties(node.id, {
                          fontFamily: node.properties?.fontFamily === 'mono' ? 'sans' : 'mono',
                        })
                      }
                      className={`flex-1 py-1 text-xs font-mono rounded border transition-colors ${
                        node.properties?.fontFamily === 'mono'
                          ? 'bg-blue-50 dark:bg-blue-900/40 border-blue-400 text-blue-600 dark:text-blue-400'
                          : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400'
                      }`}
                    >
                      Mono
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })()}

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

        {/* Button Active Low */}
        {node.type === 'BUTTON' && (
          <div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={!!node.properties?.activeLow}
                onChange={(e) => updateNodeProperties(node.id, { activeLow: e.target.checked })}
              />
              Active Low
            </label>
          </div>
        )}

        {/* Variable Inputs */}
        {def.variableInputs && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              {def.variableInputs.label || 'Number of Inputs'}
            </label>
            <NumberInput
              min={def.variableInputs.min}
              max={def.variableInputs.max}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
              value={node.inputs.length}
              onChangeValue={(val) => setNodeInputCount(node.id, val)}
              fallbackValue={node.inputs.length}
            />
          </div>
        )}

        {/* Variable Outputs */}
        {def.variableOutputs && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              {def.variableOutputs.label || 'Number of Outputs'}
            </label>
            <NumberInput
              min={def.variableOutputs.min}
              max={def.variableOutputs.max}
              className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
              value={node.outputs.length}
              onChangeValue={(val) => setNodeOutputCount(node.id, val)}
              fallbackValue={node.outputs.length}
            />
          </div>
        )}

        {/* Clock / NE555 Controls */}
        {isClockLike && (() => {
          const highTicks = Math.max(1, node.properties?.highTicks ?? node.properties?.interval ?? 5);
          const lowTicks = Math.max(1, node.properties?.lowTicks ?? node.properties?.interval ?? 5);
          const periodTicks = highTicks + lowTicks;
          const freqHz = simSpeed / periodTicks;
          const dutyCycle = Math.round((highTicks / periodTicks) * 100);
          const mode = node.properties?.mode || 'auto';
          const isManual = isClock && mode === 'manual';

          return (
            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-slate-700">
              {isClock && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                    Clock Mode
                  </label>
                  <div className="grid grid-cols-2 gap-1 bg-gray-100 dark:bg-slate-900 p-1 rounded-md">
                    <button
                      type="button"
                      onClick={() => updateNodeProperties(node.id, { mode: 'auto' })}
                      className={`py-1 text-xs font-medium rounded transition-colors ${
                        !isManual
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Auto (OSC)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateNodeProperties(node.id, { mode: 'manual' })}
                      className={`py-1 text-xs font-medium rounded transition-colors ${
                        isManual
                          ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Manual
                    </button>
                  </div>
                </div>
              )}

              {isManual ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={!simRunning}
                    onClick={() => toggleInputNode(node.id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-1.5 px-3 rounded transition-colors text-xs"
                  >
                    Toggle Clock ({node.properties?.manualValue === 1 ? 'HIGH → LOW' : 'LOW → HIGH'})
                  </button>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400">
                    Tip: Click the clock directly on the canvas while simulation is running to toggle its state.
                  </p>
                </div>
              ) : (
                <>
                  {/* Frequency, Period & Duty Cycle Readout */}
                  <div className="bg-gray-50 dark:bg-slate-900/70 border border-gray-200 dark:border-slate-700 rounded-md p-2.5 flex justify-between items-center text-xs">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">Frequency</div>
                      <div className="font-mono font-semibold text-gray-900 dark:text-slate-100">
                        {freqHz >= 1000
                          ? `${(freqHz / 1000).toFixed(2)} kHz`
                          : freqHz >= 10
                          ? `${freqHz.toFixed(1)} Hz`
                          : `${freqHz.toFixed(2)} Hz`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500">Duty / Period</div>
                      <div className="font-mono text-gray-700 dark:text-slate-300">
                        {dutyCycle}% (
                        {freqHz > 0
                          ? 1 / freqHz < 1
                            ? `${((1000) / freqHz).toFixed(1)} ms`
                            : `${(1 / freqHz).toFixed(2)} s`
                          : `${periodTicks}T`}
                        )
                      </div>
                    </div>
                  </div>

                  {/* Target Frequency Presets (50% Duty) */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Target Frequency (50% Duty)
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {[
                        { label: '0.5Hz', hz: 0.5, title: '0.5 Hz (2 Sec period)' },
                        { label: '1Hz', hz: 1, title: '1 Hz (1 Sec period)' },
                        { label: '62.5Hz', hz: 62.5, title: '62.5 Hz (16 ms period)' },
                        { label: '100Hz', hz: 100, title: '100 Hz (10 ms period)' },
                        { label: '1kHz', hz: 1000, title: '1 kHz (1 ms period @ 2000 Hz sim speed)' },
                      ].map((preset) => {
                        const isMatch = Math.abs(freqHz - preset.hz) < 0.05 && highTicks === lowTicks;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            title={preset.title}
                            onClick={() => {
                              const store = useSimulatorStore.getState();
                              // Ensure simulation speed is high enough (2000 Hz base works cleanly for 1kHz, 62.5Hz/16ms, 100Hz, 1Hz, 0.5Hz/2s)
                              const targetSimSpeed =
                                store.simSpeed >= 2000 && store.simSpeed % (preset.hz * 2) === 0
                                  ? store.simSpeed
                                  : Math.max(store.simSpeed, 2000);
                              const halfPeriod = Math.max(1, Math.round(targetSimSpeed / (preset.hz * 2)));
                              const exactSpeed = Math.round(halfPeriod * 2 * preset.hz);
                              if (store.simSpeed !== exactSpeed && (preset.hz >= 50 || store.simSpeed < exactSpeed)) {
                                store.setSimSpeed(exactSpeed);
                              }
                              const finalSpeed =
                                preset.hz >= 50 || store.simSpeed < exactSpeed ? exactSpeed : store.simSpeed;
                              const ticks = Math.max(1, Math.round(finalSpeed / (preset.hz * 2)));
                              updateNodeProperties(node.id, { highTicks: ticks, lowTicks: ticks });
                            }}
                            className={`py-1 text-[11px] font-mono rounded border transition-colors ${
                              isMatch
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-400'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Ticks Presets */}
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                      Quick Ticks (High / Low)
                    </label>
                    <div className="grid grid-cols-5 gap-1">
                      {[1, 2, 5, 16, 100].map((t) => {
                        const active = highTicks === t && lowTicks === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => updateNodeProperties(node.id, { highTicks: t, lowTicks: t })}
                            className={`py-1 text-xs font-mono rounded border transition-colors ${
                              active
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-400'
                            }`}
                          >
                            {t}T
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                        High Ticks
                      </label>
                      <NumberInput
                        min={1}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                        value={highTicks}
                        onChangeValue={(val) => updateNodeProperties(node.id, { highTicks: val })}
                        fallbackValue={highTicks}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
                        Low Ticks
                      </label>
                      <NumberInput
                        min={1}
                        className="w-full bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-slate-100"
                        value={lowTicks}
                        onChangeValue={(val) => updateNodeProperties(node.id, { lowTicks: val })}
                        fallbackValue={lowTicks}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-gray-50 dark:bg-slate-900"
                        checked={node.properties?.startHigh === false}
                        onChange={(e) => updateNodeProperties(node.id, { startHigh: !e.target.checked })}
                      />
                      Invert Initial Phase (Start LOW)
                    </label>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Memory Editor Button */}
        {def.memorySize !== undefined && (
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

        {/* GAL22V10 JEDEC Loader & Code Editor */}
        {node.type === 'GAL22V10' && (
          <div className="mt-4 space-y-2">
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">
              PLD / JEDEC Programming
            </label>
            <button
              onClick={() => {
                const store = useSimulatorStore.getState();
                store.setSelectedMemoryNodeId(node.id);
                store.setAppMode('code');
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded transition-colors text-sm"
            >
              Open Code Editor (.pld)
            </button>
            <input
              type="file"
              accept=".jed"
              className="hidden"
              id="jedec-upload"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  const result = event.target?.result;
                  if (typeof result === 'string') {
                    // Store the raw string in properties
                    updateNodeProperties(node.id, { jedecString: result });
                  }
                };
                reader.readAsText(file);
                // reset input so it can be uploaded again
                e.target.value = '';
              }}
            />
            <button
              onClick={() => document.getElementById('jedec-upload')?.click()}
              className="w-full bg-slate-600 hover:bg-slate-700 text-white font-medium py-1.5 px-4 rounded transition-colors text-xs"
            >
              Load .jed File Directly
            </button>
            {node.properties?.jedecString && (
              <div className="mt-1 text-[10px] text-green-600 dark:text-green-400 text-center">
                ✓ JEDEC Loaded
              </div>
            )}
          </div>
        )}

        {/* DIP Pinout Diagram */}
        {!isClock && (node.properties?.renderAs === 'DIP' || def.renderAs === 'DIP') && (
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
