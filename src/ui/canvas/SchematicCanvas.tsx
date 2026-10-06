import { SchematicJunctionNode } from "./nodes/schematic/SchematicJunctionNode";
import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Grid } from './Grid';
import { SchematicGateNode } from './nodes/schematic/SchematicGateNode';
import { SchematicIONode } from './nodes/schematic/SchematicIONode';
import { SchematicICNode } from './nodes/schematic/SchematicICNode';
import { SchematicDipSwitchNode } from './nodes/schematic/SchematicDipSwitchNode';
import { WireRenderer } from './wires/WireRenderer';
import { getNodeDefinition } from '../../core/engine/nodes';
import { getSchematicDimensions, getSchematicAnchor } from '../../core/utils/schematicLayout';
import { computeAllWirePaths } from '../../core/engine/routing';
import { Schematic7SegNode } from './nodes/schematic/Schematic7SegNode';
import { useShallow } from 'zustand/react/shallow';

const ConnectedNode = React.memo(({ id }: { id: string }) => {
  const node = useSimulatorStore(state => state.nodes.find(n => n.id === id));
  if (!node) return null;
  const def = getNodeDefinition(node.type);
  if (node.type === '7_SEG_DISPLAY') return <Schematic7SegNode node={node} />;
  if (node.type === 'DIP_SWITCH') return <SchematicDipSwitchNode node={node} />;
  if (def?.renderAs === 'DIP') return <SchematicICNode node={node} />;
  if (['INPUT', 'OUTPUT', 'CLOCK', 'VCC', 'GND'].includes(node.type)) return <SchematicIONode node={node} />;
  if (node.type === 'JUNCTION') return <SchematicJunctionNode node={node} />;
  return <SchematicGateNode node={node} />;
});

export const SchematicCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, width: number, height: number } | null>(null);
  const stagePos = useSimulatorStore(state => state.schematicPos);
  const setStagePos = useSimulatorStore(state => state.setSchematicPos);
  const scale = useSimulatorStore(state => state.schematicScale);
  const setScale = useSimulatorStore(state => state.setSchematicScale);
  const setCanvasOffset = useSimulatorStore(state => state.setCanvasOffset);
  
  const nodeIds = useSimulatorStore(useShallow(state => state.nodes.map(n => n.id)));
  const draftWire = useSimulatorStore(state => state.draftWire);
  const updateDraftWire = useSimulatorStore(state => state.updateDraftWire);
  const select = useSimulatorStore(state => state.select);
  const settings = useSimulatorStore(state => state.settings);

  const initializedRef = useRef(false);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        setDimensions({ width: w, height: h });
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasOffset({ x: rect.left, y: rect.top });
        if (!initializedRef.current && w > 0 && h > 0) {
          setStagePos({ x: w / 2, y: h / 2 });
          initializedRef.current = true;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      
      const store = useSimulatorStore.getState();
      
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            store.redo();
          } else {
            store.undo();
          }
          return;
        }
        if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          store.redo();
          return;
        }
      }
      
      if (e.key === 'Escape') {
        if (store.draftWire) store.cancelWire();
        if (store.placingNodeId) store.cancelPlacingNode();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        store.deleteSelection();
      } else if (e.key.toLowerCase() === 'r') {
        const targetNodeId = store.placingNodeId || (store.selection?.type === 'node' ? store.selection.id : null);
        if (targetNodeId) {
          const node = store.nodes.find(n => n.id === targetNodeId);
          if (node && node.type !== 'JUNCTION') {
            const currentRot = node.properties?.rotation || 0;
            store.updateNodeProperties(node.id, { rotation: (currentRot + 90) % 360 });
          }
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="flex-1 h-full bg-slate-50 dark:bg-slate-900 overflow-hidden outline-none"
      tabIndex={0}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          width={dimensions.width}
          height={dimensions.height}
        draggable={!draftWire && !selectionBox} // Disable stage dragging while drawing wire or selecting
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        onDragMove={(e) => {
          if (e.target === e.target.getStage()) {
            window.dispatchEvent(new CustomEvent('schematic-drag', { detail: { x: e.target.x(), y: e.target.y() } }));
          }
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            setStagePos({ x: e.target.x(), y: e.target.y() });
          }
        }}
        onWheel={(e) => {
          e.evt.preventDefault();
          const stage = e.target.getStage();
          if (!stage) return;
          
          const { deltaX, deltaY, ctrlKey, shiftKey } = e.evt;

          // Determine if we are zooming or panning based on settings and modifiers
          const isTrackpadPinch = ctrlKey; // Browsers convert trackpad pinch to ctrlKey + wheel
          const forceZoom = isTrackpadPinch || (settings.mouseWheelBehavior === 'zoom' && !shiftKey);
          
          if (forceZoom) {
            // Zoom logic
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            
            const mousePointTo = {
              x: (pointer.x - stage.x()) / oldScale,
              y: (pointer.y - stage.y()) / oldScale,
            };

            let direction = deltaY > 0 ? -1 : 1;
            if (settings.invertZoom) direction = -direction;
            
            const zoomAmount = Math.max(0.01, Math.abs(deltaY) * 0.01 * settings.zoomSensitivity);
            // Limit scaleBy to prevent extreme jumps on high-sensitivity mice
            const scaleBy = 1 + Math.min(zoomAmount, 0.5);
            
            const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
            
            if (newScale < 0.2 || newScale > 5) return;
            
            const newX = pointer.x - mousePointTo.x * newScale;
            const newY = pointer.y - mousePointTo.y * newScale;
            
            stage.scale({ x: newScale, y: newScale });
            stage.position({ x: newX, y: newY });
            
            window.dispatchEvent(new CustomEvent('schematic-drag', { detail: { x: newX, y: newY, scale: newScale } }));
            
            if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
            wheelTimeoutRef.current = setTimeout(() => {
              setStagePos({ x: newX, y: newY });
              setScale(newScale);
            }, 100);
          } else {
            // Pan logic
            let panX = deltaX;
            let panY = deltaY;

            // If shift is held on a regular mouse, scroll horizontally
            if (shiftKey && !isTrackpadPinch) {
              panX = deltaY;
              panY = deltaX;
            }

            const newX = stage.x() - panX * settings.panSpeed;
            const newY = stage.y() - panY * settings.panSpeed;
            
            stage.position({ x: newX, y: newY });
            
            window.dispatchEvent(new CustomEvent('schematic-drag', { detail: { x: newX, y: newY, scale: stage.scaleX() } }));
            
            if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
            wheelTimeoutRef.current = setTimeout(() => {
              setStagePos({ x: newX, y: newY });
            }, 100);
          }
        }}
        onMouseMove={(e) => {
          const store = useSimulatorStore.getState();
          const stage = e.target.getStage();
          if (!stage) return;
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          const transform = stage.getAbsoluteTransform().copy().invert();
          const pos = transform.point(pointer);

          if (selectionBox) {
            setSelectionBox({
              ...selectionBox,
              width: pos.x - selectionBox.startX,
              height: pos.y - selectionBox.startY
            });
            return;
          }

          if (draftWire) {
            updateDraftWire(Math.round(pos.x / 20) * 20, Math.round(pos.y / 20) * 20);
          } else if (store.placingNodeId) {
            const node = store.nodes.find(n => n.id === store.placingNodeId);
            let offsetX = 0;
            let offsetY = 0;
            if (node) {
              const { width, height } = getSchematicDimensions(node);
              offsetX = width / 2;
              offsetY = height / 2;
            }
            store.updatePlacingNode(pos.x - offsetX, pos.y - offsetY);
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
              const { width, height } = getSchematicDimensions(node);
              const { x: anchorX, y: anchorY } = getSchematicAnchor(node);
              const nx1 = node.x - anchorX;
              const ny1 = node.y - anchorY;
              const nx2 = nx1 + width;
              const ny2 = ny1 + height;
              if (nx1 < x2 && nx2 > x1 && ny1 < y2 && ny2 > y1) {
                selectedIds.push(node.id);
              }
            });
            
            const { wirePaths } = computeAllWirePaths(store.wires, store.nodes);
            store.wires.forEach(wire => {
              const pathData = wirePaths.get(wire.id);
              if (pathData) {
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
            const container = e.target.getStage()?.container();
            if (container && !draftWire && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'grab';
          }
        }}
        onClick={(e) => {
          const store = useSimulatorStore.getState();
          if (store.placingNodeId) {
            store.finishPlacingNode();
            return;
          }

          const isBackground = e.target === e.target.getStage() || e.target.name() === 'grid';
          if (isBackground) {
            if (draftWire) {
              const stage = e.target.getStage();
              const pointer = stage?.getPointerPosition();
              if (stage && pointer) {
                const transform = stage.getAbsoluteTransform().copy().invert();
                const pos = transform.point(pointer);
                // Snap to grid
                const nx = Math.round(pos.x / 20) * 20;
                const ny = Math.round(pos.y / 20) * 20;
                store.addWaypoint(nx, ny);
              }
            } else {
              select(null);
            }
          }
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage() && e.evt.shiftKey && !draftWire && !useSimulatorStore.getState().placingNodeId) {
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
          if (e.evt.button === 2) {
            // Right click
            const store = useSimulatorStore.getState();
            if (store.draftWire) store.cancelWire();
            return;
          }
          if (e.target === e.target.getStage()) {
            select(null);
            if (!draftWire) {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'grabbing';
            }
          }
        }}
        onContextMenu={(e) => e.evt.preventDefault()}
        style={{ cursor: draftWire ? 'crosshair' : 'grab' }}
      >
        <Grid 
          width={dimensions.width} 
          height={dimensions.height} 
          scale={scale} 
          x={stagePos.x} 
          y={stagePos.y} 
        />

        <Layer>
          <WireRenderer />
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
          {nodeIds.map((id) => (
            <ConnectedNode key={id} id={id} />
          ))}
        </Layer>
      </Stage>
      )}
    </div>
  );
};
