import { SchematicJunctionNode } from "./nodes/schematic/SchematicJunctionNode";
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { Tag, X, RotateCcw } from 'lucide-react';
import { useSimulatorStore, formatLabelFromPattern } from '../../store/useSimulatorStore';
import { Grid } from './Grid';
import { SchematicGateNode } from './nodes/schematic/SchematicGateNode';
import { SchematicIONode } from './nodes/schematic/SchematicIONode';
import { SchematicNetLabelNode, getNetLabelTextWidth } from './nodes/schematic/SchematicNetLabelNode';
import { SchematicICNode } from './nodes/schematic/SchematicICNode';
import { SchematicDipSwitchNode } from './nodes/schematic/SchematicDipSwitchNode';
import { WireRenderer, ViewportBounds } from './wires/WireRenderer';
import { getNodeDefinition } from '../../core/engine/nodes';
import { getSchematicDimensions, getSchematicAnchor } from '../../core/utils/schematicLayout';
import { computeAllWirePaths } from '../../core/engine/routing';
import { Schematic7SegNode } from './nodes/schematic/Schematic7SegNode';
import { SchematicBusNode } from './nodes/schematic/SchematicBusNode';
import { SchematicButtonNode } from './nodes/schematic/SchematicButtonNode';
import { SchematicLEDBarNode } from './nodes/schematic/SchematicLEDBarNode';
import { SchematicNCNode } from './nodes/schematic/SchematicNCNode';
import { SchematicKeypadNode } from './nodes/schematic/SchematicKeypadNode';
import {
  SchematicRegionBoxNode,
  SchematicTextLabelNode,
  SchematicStickyNoteNode,
  SchematicFsmDiagramNode,
} from './nodes/schematic/SchematicAnnotationNodes';


let lastNodesArray: any[] = [];
let nodeMapCache = new Map<string, any>();
let hasInitializedSchematicViewport = false;

function getNodeById(state: any, id: string) {
  if (state.nodes !== lastNodesArray) {
    nodeMapCache.clear();
    for (let i = 0; i < state.nodes.length; i++) {
      nodeMapCache.set(state.nodes[i].id, state.nodes[i]);
    }
    lastNodesArray = state.nodes;
  }
  return nodeMapCache.get(id);
}

import { LogicNode } from '../../core/models/types';

const SCHEMATIC_NODE_RENDERERS: Record<string, React.FC<{ node: LogicNode }>> = {
  NC: SchematicNCNode,
  '7_SEG_DISPLAY': Schematic7SegNode,
  DIP_SWITCH: SchematicDipSwitchNode,
  BUTTON: SchematicButtonNode,
  KEYPAD: SchematicKeypadNode,
  LED_BAR: SchematicLEDBarNode,
  INPUT: SchematicIONode,
  OUTPUT: SchematicIONode,
  CLOCK: SchematicIONode,
  VCC: SchematicIONode,
  GND: SchematicIONode,
  PULL_UP: SchematicIONode,
  PULL_DOWN: SchematicIONode,
  JUNCTION: SchematicJunctionNode,
  NET_LABEL: SchematicNetLabelNode,
  SUB_IN: SchematicNetLabelNode,
  SUB_OUT: SchematicNetLabelNode,
  SUB_IO: SchematicNetLabelNode,
  REGION_BOX: SchematicRegionBoxNode,
  TEXT_LABEL: SchematicTextLabelNode,
  STICKY_NOTE: SchematicStickyNoteNode,
  FSM_DIAGRAM: SchematicFsmDiagramNode,
};

const ConnectedNode = React.memo(({ id }: { id: string }) => {
  const node = useSimulatorStore(state => getNodeById(state, id));

  if (!node) return null;
  const SpecificRenderer = SCHEMATIC_NODE_RENDERERS[node.type];
  if (SpecificRenderer) return <SpecificRenderer node={node} />;

  const def = getNodeDefinition(node.type);
  if (def?.renderAs === 'DIP') return <SchematicICNode node={node} />;
  if (def?.renderAs === 'BUS') return <SchematicBusNode node={node} />;
  return <SchematicGateNode node={node} />;
});

const QuickLabelOverlay: React.FC = React.memo(() => {
  const labelTool = useSimulatorStore(s => s.labelTool);
  const setLabelTool = useSimulatorStore(s => s.setLabelTool);
  const applyLabelToolToSelection = useSimulatorStore(s => s.applyLabelToolToSelection);
  const multiSelection = useSimulatorStore(s => s.multiSelection);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevPrefixRef = useRef<string>('');

  useEffect(() => {
    if (labelTool.active) {
      prevPrefixRef.current = labelTool.pattern.split(/[#\[]/)[0];
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [labelTool.active]);

  if (!labelTool.active) return null;

  const nextPreview = formatLabelFromPattern(labelTool.pattern, labelTool.nextIndex);

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-blue-400/60 dark:border-blue-500/50 shadow-lg text-xs select-none"
    >
      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-semibold pr-1 border-r border-gray-200 dark:border-slate-700">
        <Tag size={13} />
        <span>Quick Label</span>
      </div>

      <label className="flex items-center gap-1.5">
        <span className="text-[11px] text-gray-500 dark:text-slate-400">Pattern:</span>
        <input
          ref={inputRef}
          type="text"
          value={labelTool.pattern}
          onChange={(e) => {
            const val = e.target.value;
            const newPrefix = val.split(/[#\[]/)[0];
            const shouldReset = newPrefix !== prevPrefixRef.current;
            prevPrefixRef.current = newPrefix;
            setLabelTool({
              pattern: val,
              ...(shouldReset ? { nextIndex: 0 } : {}),
            });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setLabelTool({ active: false });
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (multiSelection.length > 1) {
                applyLabelToolToSelection();
              } else {
                e.currentTarget.blur();
              }
            }
          }}
          placeholder="IP[#]"
          className="w-28 px-2 py-1 text-xs font-mono rounded bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </label>

      <label className="flex items-center gap-1">
        <span className="text-[11px] text-gray-500 dark:text-slate-400">#</span>
        <input
          type="number"
          min={0}
          value={labelTool.nextIndex}
          onChange={(e) =>
            setLabelTool({ nextIndex: Math.max(0, parseInt(e.target.value, 10) || 0) })
          }
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setLabelTool({ active: false });
            } else if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          className="w-12 px-1.5 py-1 text-xs font-mono text-center rounded bg-gray-50 dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          title="Current index for #"
        />
      </label>

      <button
        type="button"
        onClick={() => setLabelTool({ nextIndex: 0 })}
        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
        title="Reset # to 0"
      >
        <RotateCcw size={12} />
      </button>

      <button
        type="button"
        onClick={() => setLabelTool({ step: labelTool.step === 1 ? -1 : 1 })}
        className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600"
        title="Toggle increment (+1) or decrement (-1)"
      >
        {labelTool.step === 1 ? '+1' : '-1'}
      </button>

      <div
        className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/70 text-[11px] font-mono text-blue-700 dark:text-blue-300"
        title="Click any Net Label or I/O node on the canvas to assign this name"
      >
        Next: <span className="font-bold">{nextPreview}</span>
      </div>

      {multiSelection.length > 1 && (
        <button
          type="button"
          onClick={applyLabelToolToSelection}
          className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-medium text-[11px] transition-colors"
          title="Number all currently selected nodes (top-to-bottom, left-to-right)"
        >
          Label Selected ({multiSelection.length})
        </button>
      )}

      <button
        type="button"
        onClick={() => setLabelTool({ active: false })}
        className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 rounded hover:bg-gray-100 dark:hover:bg-slate-700 ml-0.5"
        title="Close Quick Label tool (Esc)"
      >
        <X size={14} />
      </button>
    </div>
  );
});

export const SchematicCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, width: number, height: number } | null>(null);
  const initialStore = useSimulatorStore.getState();
  const viewRef = useRef({
    x: initialStore.schematicPos.x,
    y: initialStore.schematicPos.y,
    scale: initialStore.schematicScale,
  });
  const [cullView, setCullView] = useState(() => ({
    x: initialStore.schematicPos.x,
    y: initialStore.schematicPos.y,
    scale: initialStore.schematicScale,
  }));
  
  const nodes = useSimulatorStore(state => state.nodes);
  const placingNodeId = useSimulatorStore(state => state.placingNodeId);
  const pastingNodeIds = useSimulatorStore(state => state.pastingNodeIds);
  const isDrawingWire = useSimulatorStore(state => Boolean(state.draftWire));
  const updateDraftWire = useSimulatorStore(state => state.updateDraftWire);
  const select = useSimulatorStore(state => state.select);
  const settings = useSimulatorStore(state => state.settings);

  const shouldUseViewportCulling = nodes.length > 2000;
  const shouldUseViewportCullingRef = useRef(shouldUseViewportCulling);
  shouldUseViewportCullingRef.current = shouldUseViewportCulling;

  const bgLayerRef = useRef<any>(null);
  const mainLayerRef = useRef<any>(null);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelRafRef = useRef<number | null>(null);
  const pendingViewRef = useRef<{ x: number; y: number; scale: number } | null>(null);
  const isWheelPanningRef = useRef(false);
  const forceHitDrawRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  const refreshLayerHits = () => {
    forceHitDrawRef.current = true;
    bgLayerRef.current?.drawHit();
    mainLayerRef.current?.drawHit();
    forceHitDrawRef.current = false;
  };

  const syncCommittedView = (nextX: number, nextY: number, nextScale: number) => {
    viewRef.current = { x: nextX, y: nextY, scale: nextScale };
    isWheelPanningRef.current = false;
    refreshLayerHits();
    const st = useSimulatorStore.getState();
    if (st.schematicPos.x !== nextX || st.schematicPos.y !== nextY) {
      st.setSchematicPos({ x: nextX, y: nextY });
    }
    if (st.schematicScale !== nextScale) {
      st.setSchematicScale(nextScale);
    }
    if (shouldUseViewportCullingRef.current) {
      setCullView({ x: nextX, y: nextY, scale: nextScale });
    }
  };

  const viewportBounds = useMemo<ViewportBounds | null>(() => {
    if (!shouldUseViewportCulling || dimensions.width <= 0 || dimensions.height <= 0 || cullView.scale <= 0) return null;
    // Use a generous 1000px screen-space margin so smooth panning/zooming never causes visible pop-in
    const pad = 1000 / cullView.scale;
    return {
      minX: -cullView.x / cullView.scale - pad,
      maxX: (dimensions.width - cullView.x) / cullView.scale + pad,
      minY: -cullView.y / cullView.scale - pad,
      maxY: (dimensions.height - cullView.y) / cullView.scale + pad,
    };
  }, [shouldUseViewportCulling, dimensions.width, dimensions.height, cullView.x, cullView.y, cullView.scale]);

  const { backgroundNodeIds, foregroundNodeIds } = useMemo(() => {
    const bg: string[] = [];
    const fg: string[] = [];
    const shouldCull = Boolean(viewportBounds);
    const pastingSet = pastingNodeIds && pastingNodeIds.length > 0 ? new Set(pastingNodeIds) : null;

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const isBg = n.type === 'REGION_BOX' || n.type === 'FSM_DIAGRAM';
      if (shouldCull && viewportBounds && n.id !== placingNodeId && (!pastingSet || !pastingSet.has(n.id))) {
        const w = isBg ? (n.properties?.width || 640) : 320;
        const h = isBg ? (n.properties?.height || 440) : 320;
        if (
          n.x + w < viewportBounds.minX ||
          n.x - 160 > viewportBounds.maxX ||
          n.y + h < viewportBounds.minY ||
          n.y - 160 > viewportBounds.maxY
        ) {
          continue;
        }
      }
      if (isBg) {
        bg.push(n.id);
      } else {
        fg.push(n.id);
      }
    }
    return { backgroundNodeIds: bg, foregroundNodeIds: fg };
  }, [nodes, viewportBounds, placingNodeId, pastingNodeIds]);

  useEffect(() => {
    const patchLayerDrawHit = (layer: any) => {
      if (!layer || layer._logicaPatchedDrawHit) return;
      const origDrawHit = layer.drawHit.bind(layer);
      layer._logicaPatchedDrawHit = true;
      layer.drawHit = function (can?: any, top?: any) {
        if (!forceHitDrawRef.current) {
          if (isWheelPanningRef.current || useSimulatorStore.getState().simRunning) {
            return this;
          }
        }
        return origDrawHit(can, top);
      };
    };
    patchLayerDrawHit(bgLayerRef.current);
    patchLayerDrawHit(mainLayerRef.current);
  }, [dimensions.width, dimensions.height]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        setDimensions({ width: w, height: h });
        if (!hasInitializedSchematicViewport && w > 0 && h > 0) {
          const cur = useSimulatorStore.getState().schematicPos;
          if (cur.x === 0 && cur.y === 0) {
            viewRef.current.x = w / 2;
            viewRef.current.y = h / 2;
            useSimulatorStore.getState().setSchematicPos({ x: w / 2, y: h / 2 });
          }
          hasInitializedSchematicViewport = true;
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const flushPendingWheelView = () => {
      isWheelPanningRef.current = false;
      if (wheelRafRef.current !== null) {
        cancelAnimationFrame(wheelRafRef.current);
        wheelRafRef.current = null;
      }
      if (pendingViewRef.current) {
        const pending = pendingViewRef.current;
        pendingViewRef.current = null;
        if (wheelTimeoutRef.current) {
          clearTimeout(wheelTimeoutRef.current);
          wheelTimeoutRef.current = null;
        }
        viewRef.current = { x: pending.x, y: pending.y, scale: pending.scale };
      }
      const st = useSimulatorStore.getState();
      const cur = viewRef.current;
      if (st.schematicPos.x !== cur.x || st.schematicPos.y !== cur.y) {
        st.setSchematicPos({ x: cur.x, y: cur.y });
      }
      if (st.schematicScale !== cur.scale) {
        st.setSchematicScale(cur.scale);
      }
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // If a button in the Toolbox/Topbar still holds focus, blur it so key events don't trigger button/scroll defaults
      if (document.activeElement instanceof HTMLButtonElement) {
        document.activeElement.blur();
      }
      
      const store = useSimulatorStore.getState();
      if (store.simRunning) return;
      const code = e.code;
      const key = e.key.toLowerCase();
      
      if (e.ctrlKey || e.metaKey) {
        if (code === 'KeyZ' || key === 'z') {
          e.preventDefault();
          flushPendingWheelView();
          if (e.shiftKey) {
            store.redo();
          } else {
            store.undo();
          }
          return;
        }
        if (code === 'KeyY' || key === 'y') {
          e.preventDefault();
          flushPendingWheelView();
          store.redo();
          return;
        }
        if (code === 'KeyC' || key === 'c') {
          e.preventDefault();
          store.copySelection();
          return;
        }
        if (code === 'KeyV' || key === 'v') {
          e.preventDefault();
          flushPendingWheelView();
          const { x, y } = lastMousePosRef.current;
          const gridX = Math.round(x / 20) * 20;
          const gridY = Math.round(y / 20) * 20;
          store.pasteClipboard(gridX, gridY);
          return;
        }
      }
      
      if (e.key === 'Shift') {
        if (store.draftWire) store.setDraftWireManhattan(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        flushPendingWheelView();
        if (store.draftWire) store.cancelWire();
        if (store.placingNodeId) store.cancelPlacingNode();
        if (store.pastingNodeIds) store.cancelPastingNodes();
        if (store.labelTool.active) store.setLabelTool({ active: false });
      } else if ((code === 'KeyL' || key === 'l') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        flushPendingWheelView();
        store.setLabelTool({ active: !store.labelTool.active });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        flushPendingWheelView();
        store.deleteSelection();
      } else if ((code === 'KeyX' || key === 'x') && !e.ctrlKey && !e.metaKey) {
        const targetNodeId = store.placingNodeId || (store.selection?.type === 'node' ? store.selection.id : null);
        if (targetNodeId) {
          e.preventDefault();
          flushPendingWheelView();
          const node = store.nodes.find(n => n.id === targetNodeId);
          if (node && !getNodeDefinition(node.type)?.disableTransform) {
            const currentFlipX = node.properties?.flipX || false;
            store.updateNodeProperties(node.id, { flipX: !currentFlipX });
          }
        }
      } else if ((code === 'KeyY' || key === 'y') && !e.ctrlKey && !e.metaKey) {
        const targetNodeId = store.placingNodeId || (store.selection?.type === 'node' ? store.selection.id : null);
        if (targetNodeId) {
          e.preventDefault();
          flushPendingWheelView();
          const node = store.nodes.find(n => n.id === targetNodeId);
          if (node && !getNodeDefinition(node.type)?.disableTransform) {
            const currentFlipY = node.properties?.flipY || false;
            store.updateNodeProperties(node.id, { flipY: !currentFlipY });
          }
        }
      } else if (((code === 'KeyR' || key === 'r') || e.key === 'Tab') && !e.ctrlKey && !e.metaKey) {
        const targetNodeId = store.placingNodeId || (store.selection?.type === 'node' ? store.selection.id : null);
        if (targetNodeId) {
          e.preventDefault();
          flushPendingWheelView();
          const node = store.nodes.find(n => n.id === targetNodeId);
          if (node && !getNodeDefinition(node.type)?.disableTransform) {
            const currentRot = node.properties?.rotation || 0;
            store.updateNodeProperties(node.id, { rotation: (currentRot + 90) % 360 });
          }
        }
      } else if ((code === 'KeyA' || key === 'a') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        let lastType = store.lastPlacedNodeType;
        if (!lastType) {
          try {
            const stored = localStorage.getItem('logica-recent-nodes');
            const parsed = stored ? JSON.parse(stored) : [];
            if (Array.isArray(parsed) && parsed.length > 0) {
              lastType = parsed[0];
            }
          } catch {
            // ignore
          }
        }
        if (lastType && getNodeDefinition(lastType)) {
          e.preventDefault();
          flushPendingWheelView();
          store.startPlacingNode(lastType);
          const updatedStore = useSimulatorStore.getState();
          if (updatedStore.placingNodeId) {
            const newNode = updatedStore.nodes.find(n => n.id === updatedStore.placingNodeId);
            const anchor = newNode ? getSchematicAnchor(newNode) : { x: 0, y: 0 };
            const { x, y } = lastMousePosRef.current;
            const gridX = Math.round((x - anchor.x) / 20) * 20;
            const gridY = Math.round((y - anchor.y) / 20) * 20;
            updatedStore.updatePlacingNode(gridX, gridY);
          }
        }
      }
    };
    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        const store = useSimulatorStore.getState();
        if (store.draftWire) store.setDraftWireManhattan(false);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('keyup', handleGlobalKeyUp);
    return () => {
      flushPendingWheelView();
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="flex-1 h-full bg-slate-50 dark:bg-slate-900 overflow-hidden outline-none relative"
      tabIndex={0}
    >
      <QuickLabelOverlay />
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          width={dimensions.width}
          height={dimensions.height}
        draggable={!isDrawingWire && !selectionBox && !placingNodeId && !pastingNodeIds} // Disable stage dragging while drawing wire, selecting, or placing/pasting
        x={viewRef.current.x}
        y={viewRef.current.y}
        scaleX={viewRef.current.scale}
        scaleY={viewRef.current.scale}
        onDragMove={(e) => {
          if (e.target === e.target.getStage()) {
            viewRef.current.x = e.target.x();
            viewRef.current.y = e.target.y();
          }
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            syncCommittedView(e.target.x(), e.target.y(), viewRef.current.scale);
          }
        }}
        onWheel={(e) => {
          e.evt.preventDefault();
          const stage = e.target.getStage();
          if (!stage) return;
          
          const { deltaX, deltaY, ctrlKey, shiftKey } = e.evt;

          const currentScale = pendingViewRef.current ? pendingViewRef.current.scale : stage.scaleX();
          const currentX = pendingViewRef.current ? pendingViewRef.current.x : stage.x();
          const currentY = pendingViewRef.current ? pendingViewRef.current.y : stage.y();

          const isTrackpadPinch = ctrlKey;
          const forceZoom = isTrackpadPinch || (settings.mouseWheelBehavior === 'zoom' && !shiftKey);
          
          let nextScale = currentScale;
          let nextX = currentX;
          let nextY = currentY;

          if (forceZoom) {
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            
            const mousePointTo = {
              x: (pointer.x - currentX) / currentScale,
              y: (pointer.y - currentY) / currentScale,
            };

            let direction = deltaY > 0 ? -1 : 1;
            if (settings.invertZoom) direction = -direction;
            
            const zoomAmount = Math.max(0.01, Math.abs(deltaY) * 0.01 * settings.zoomSensitivity);
            const scaleBy = 1 + Math.min(zoomAmount, 0.5);
            
            const candidateScale = direction > 0 ? currentScale * scaleBy : currentScale / scaleBy;
            if (candidateScale < 0.2 || candidateScale > 5) return;
            
            nextScale = candidateScale;
            nextX = pointer.x - mousePointTo.x * nextScale;
            nextY = pointer.y - mousePointTo.y * nextScale;
          } else {
            let panX = deltaX;
            let panY = deltaY;

            if (shiftKey && !isTrackpadPinch) {
              panX = deltaY;
              panY = deltaX;
            }

            nextX = currentX - panX * settings.panSpeed;
            nextY = currentY - panY * settings.panSpeed;
          }

          pendingViewRef.current = { x: nextX, y: nextY, scale: nextScale };
          viewRef.current = { x: nextX, y: nextY, scale: nextScale };
          isWheelPanningRef.current = true;

          const pointer = stage.getPointerPosition();
          if (pointer) {
            const worldPos = {
              x: (pointer.x - nextX) / nextScale,
              y: (pointer.y - nextY) / nextScale,
            };
            lastMousePosRef.current = worldPos;
          }

          if (wheelRafRef.current === null) {
            wheelRafRef.current = requestAnimationFrame(() => {
              wheelRafRef.current = null;
              const pending = pendingViewRef.current;
              if (!pending) return;

              const applyTransform = () => {
                if (stage.scaleX() !== pending.scale || stage.scaleY() !== pending.scale) {
                  stage.scale({ x: pending.scale, y: pending.scale });
                }
                stage.position({ x: pending.x, y: pending.y });
              };

              if (typeof (stage as any)._batchTransformChanges === 'function') {
                (stage as any)._batchTransformChanges(applyTransform);
              } else {
                applyTransform();
              }

              const store = useSimulatorStore.getState();
              if (!store.simRunning) {
                const pos = lastMousePosRef.current;
                if (store.draftWire) {
                  updateDraftWire(Math.round(pos.x / 20) * 20, Math.round(pos.y / 20) * 20, shiftKey);
                } else if (store.pastingNodeIds) {
                  store.updatePastingNodes(Math.round(pos.x / 20) * 20, Math.round(pos.y / 20) * 20);
                } else if (store.placingNodeId) {
                  const node = store.nodes.find(n => n.id === store.placingNodeId);
                  const anchor = node ? getSchematicAnchor(node) : { x: 0, y: 0 };
                  store.updatePlacingNode(
                    Math.round((pos.x - anchor.x) / 20) * 20,
                    Math.round((pos.y - anchor.y) / 20) * 20
                  );
                }
              }
            });
          }

          if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
          wheelTimeoutRef.current = setTimeout(() => {
            const finalView = pendingViewRef.current;
            pendingViewRef.current = null;
            if (finalView) {
              syncCommittedView(finalView.x, finalView.y, finalView.scale);
            }
          }, 150);
        }}
        onMouseMove={(e) => {
          const store = useSimulatorStore.getState();
          if (store.simRunning) return;
          const stage = e.target.getStage();
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          const transform = stage.getAbsoluteTransform().copy().invert();
          const pos = transform.point(pointer);
          lastMousePosRef.current = pos;

          if (selectionBox) {
            setSelectionBox({
              ...selectionBox,
              width: pos.x - selectionBox.startX,
              height: pos.y - selectionBox.startY
            });
            return;
          }

          if (store.draftWire) {
            updateDraftWire(Math.round(pos.x / 20) * 20, Math.round(pos.y / 20) * 20, e.evt.shiftKey);
          } else if (store.pastingNodeIds) {
            const gridX = Math.round(pos.x / 20) * 20;
            const gridY = Math.round(pos.y / 20) * 20;
            store.updatePastingNodes(gridX, gridY);
          } else if (store.placingNodeId) {
            const node = store.nodes.find(n => n.id === store.placingNodeId);
            let offsetX = 0;
            let offsetY = 0;
            if (node) {
              const anchor = getSchematicAnchor(node);
              offsetX = anchor.x;
              offsetY = anchor.y;
            }
            const gridX = Math.round((pos.x - offsetX) / 20) * 20;
            const gridY = Math.round((pos.y - offsetY) / 20) * 20;
            store.updatePlacingNode(gridX, gridY);
          }
        }}
        onMouseUp={(e) => {
          if (selectionBox) {
            const x1 = Math.min(selectionBox.startX, selectionBox.startX + selectionBox.width);
            const y1 = Math.min(selectionBox.startY, selectionBox.startY + selectionBox.height);
            const x2 = Math.max(selectionBox.startX, selectionBox.startX + selectionBox.width);
            const y2 = Math.max(selectionBox.startY, selectionBox.startY + selectionBox.height);
            
            const store = useSimulatorStore.getState();
            const selectedIds: string[] = [];
            store.nodes.forEach(node => {
              if (node.type === 'JUNCTION' || node.type === 'NC') {
                if (node.x >= x1 - 6 && node.x <= x2 + 6 && node.y >= y1 - 6 && node.y <= y2 + 6) {
                  selectedIds.push(node.id);
                }
                return;
              }

              const { width, height } = getSchematicDimensions(node);
              const { x: anchorX, y: anchorY } = getSchematicAnchor(node);
              
              const rot = (node.properties?.rotation || 0) * Math.PI / 180;
              const cos = Math.cos(rot);
              const sin = Math.sin(rot);
              const flipX = node.properties?.flipX ? -1 : 1;
              const flipY = node.properties?.flipY ? -1 : 1;

              const getPt = (px: number, py: number) => {
                let dx = px - anchorX;
                let dy = py - anchorY;
                dx *= flipX;
                dy *= flipY;
                const rx = dx * cos - dy * sin;
                const ry = dx * sin + dy * cos;
                return { x: node.x + anchorX + rx, y: node.y + anchorY + ry };
              };

              let lx1 = 0, ly1 = 0, lx2 = width, ly2 = height;
              if (node.type === 'NET_LABEL' || node.type.startsWith('SUB_')) {
                const isInputSide = node.type === 'SUB_OUT' || (node.type === 'SUB_IO' && node.properties?.flipX);
                const name = String(node.properties?.label || (node.type === 'SUB_IN' ? 'IN' : node.type === 'SUB_OUT' ? 'OUT' : node.type === 'SUB_IO' ? 'I/O' : 'NET'));
                const tw = getNetLabelTextWidth(name, node.type.startsWith('SUB_'));
                lx1 = isInputSide ? 0 : (width - 10) - tw;
                lx2 = isInputSide ? 10 + tw : width;
                ly1 = height / 2 - 10;
                ly2 = height / 2 + 10;
              }

              const p1 = getPt(lx1, ly1);
              const p2 = getPt(lx2, ly1);
              const p3 = getPt(lx1, ly2);
              const p4 = getPt(lx2, ly2);

              const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
              const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
              const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
              const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);

              if (node.type === 'REGION_BOX' || node.type === 'FSM_DIAGRAM') {
                // Only select a Region Box / FSM Diagram via marquee if the marquee encloses the entire box
                if (minX >= x1 && maxX <= x2 && minY >= y1 && maxY <= y2) {
                  selectedIds.push(node.id);
                }
              } else if (minX < x2 && maxX > x1 && minY < y2 && maxY > y1) {
                selectedIds.push(node.id);
              }
            });
            
            const { wirePaths } = computeAllWirePaths(store.wires, store.nodes);
            store.wires.forEach(wire => {
              const pathData = wirePaths.get(wire.id);
              if (pathData) {
                wire.waypoints?.forEach((wp, index) => {
                  if (wp.x >= x1 && wp.x <= x2 && wp.y >= y1 && wp.y <= y2) {
                    selectedIds.push(`wp:${wire.id}:${index}`);
                  }
                });
                const inside = pathData.points.some(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);
                if (inside) selectedIds.push(wire.id);
              }
            });
            
            if (selectedIds.length > 0) {
              store.setMultiSelection(selectedIds);
            }
            setSelectionBox(null);
            return;
          }
          if (e.target === e.target.getStage()) {
            const store = useSimulatorStore.getState();
            const container = e.target.getStage()?.container();
            if (container && !store.draftWire && (!store.placingNodeId && !store.pastingNodeIds)) container.style.cursor = 'grab';
          }
        }}
        onClick={(e) => {
          const store = useSimulatorStore.getState();
          if (store.pastingNodeIds) {
            store.finishPastingNodes();
            return;
          }
          if (store.placingNodeId) {
            store.finishPlacingNode();
            return;
          }

          const isBackground = e.target === e.target.getStage() || e.target.name() === 'grid';
          if (isBackground) {
            if (store.draftWire) {
              const stage = e.target.getStage();
              const pointer = stage?.getPointerPosition();
              if (stage && pointer) {
                const transform = stage.getAbsoluteTransform().copy().invert();
                const pos = transform.point(pointer);
                // Snap to grid
                const nx = Math.round(pos.x / 20) * 20;
                const ny = Math.round(pos.y / 20) * 20;
                store.addWaypoint(nx, ny, e.evt.shiftKey);
              }
            } else {
              select(null);
            }
          }
        }}
        onMouseDown={(e) => {
          const store = useSimulatorStore.getState();
          if (e.evt.button === 2) {
            // Right click
            if (store.draftWire) store.cancelWire();
            if (store.placingNodeId) store.cancelPlacingNode();
            if (store.pastingNodeIds) store.cancelPastingNodes();
            return;
          }
          if (e.evt.button === 0) {
            if (store.pastingNodeIds) {
              store.finishPastingNodes();
              return;
            }
            if (store.placingNodeId) {
              store.finishPlacingNode();
              return;
            }
          }
          if (e.target === e.target.getStage() && e.evt.shiftKey && !store.simRunning && !store.draftWire && (!store.placingNodeId && !store.pastingNodeIds)) {
            const stage = e.target.getStage();
            const pointer = stage?.getPointerPosition();
            if (stage && pointer) {
              const transform = stage.getAbsoluteTransform().copy().invert();
              const pos = transform.point(pointer);
              setSelectionBox({ startX: pos.x, startY: pos.y, width: 0, height: 0 });
              select(null);
            }
            return;
          }
          if (e.target === e.target.getStage()) {
            select(null);
            if (!store.draftWire) {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'grabbing';
            }
          }
        }}
        onContextMenu={(e) => e.evt.preventDefault()}
        style={{ cursor: isDrawingWire ? 'crosshair' : 'grab' }}
      >
        <Grid 
          width={dimensions.width} 
          height={dimensions.height} 
        />

        <Layer ref={bgLayerRef}>
          {backgroundNodeIds.map((id) => (
            <ConnectedNode key={id} id={id} />
          ))}
        </Layer>

        <Layer ref={mainLayerRef}>
          <WireRenderer viewportBounds={viewportBounds} />
          {selectionBox && (
            <Rect
              x={selectionBox.width < 0 ? selectionBox.startX + selectionBox.width : selectionBox.startX}
              y={selectionBox.height < 0 ? selectionBox.startY + selectionBox.height : selectionBox.startY}
              width={Math.abs(selectionBox.width)}
              height={Math.abs(selectionBox.height)}
              fill="rgba(59, 130, 246, 0.2)"
              stroke="#3b82f6"
              strokeWidth={1}
              listening={false}
            />
          )}
          {foregroundNodeIds.map((id) => (
            <ConnectedNode key={id} id={id} />
          ))}
        </Layer>
      </Stage>
      )}
    </div>
  );
};
