import { SchematicJunctionNode } from "./nodes/schematic/SchematicJunctionNode";
import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Grid } from './Grid';
import { SchematicGateNode } from './nodes/schematic/SchematicGateNode';
import { SchematicIONode } from './nodes/schematic/SchematicIONode';
import { SchematicNetLabelNode } from './nodes/schematic/SchematicNetLabelNode';
import { SchematicICNode } from './nodes/schematic/SchematicICNode';
import { SchematicDipSwitchNode } from './nodes/schematic/SchematicDipSwitchNode';
import { WireRenderer } from './wires/WireRenderer';
import { getNodeDefinition } from '../../core/engine/nodes';
import { getSchematicDimensions, getSchematicAnchor } from '../../core/utils/schematicLayout';
import { computeAllWirePaths } from '../../core/engine/routing';
import { Schematic7SegNode } from './nodes/schematic/Schematic7SegNode';
import { SchematicBusNode } from './nodes/schematic/SchematicBusNode';
import { SchematicButtonNode } from './nodes/schematic/SchematicButtonNode';
import { SchematicLEDBarNode } from './nodes/schematic/SchematicLEDBarNode';
import { SchematicNCNode } from './nodes/schematic/SchematicNCNode';
import { SchematicKeypadNode } from './nodes/schematic/SchematicKeypadNode';
import { useShallow } from 'zustand/react/shallow';


let lastNodesArray: any[] = [];
let nodeMapCache = new Map<string, any>();

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
  const isDrawingWire = useSimulatorStore(state => Boolean(state.draftWire));
  const updateDraftWire = useSimulatorStore(state => state.updateDraftWire);
  const select = useSimulatorStore(state => state.select);
  const settings = useSimulatorStore(state => state.settings);

  const initializedRef = useRef(false);
  const mainLayerRef = useRef<any>(null);
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelRafRef = useRef<number | null>(null);
  const pendingViewRef = useRef<{ x: number; y: number; scale: number } | null>(null);
  const isInteractingViewRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
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
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
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
      const code = e.code;
      const key = e.key.toLowerCase();
      
      if (e.ctrlKey || e.metaKey) {
        if (code === 'KeyZ' || key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            store.redo();
          } else {
            store.undo();
          }
          return;
        }
        if (code === 'KeyY' || key === 'y') {
          e.preventDefault();
          store.redo();
          return;
        }
        if (code === 'KeyC' || key === 'c') {
          store.copySelection();
          return;
        }
        if (code === 'KeyV' || key === 'v') {
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
        if (store.draftWire) store.cancelWire();
        if (store.placingNodeId) store.cancelPlacingNode();
        if (store.pastingNodeIds) store.cancelPastingNodes();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        store.deleteSelection();
      } else if ((code === 'KeyX' || key === 'x') && !e.ctrlKey && !e.metaKey) {
        const targetNodeId = store.placingNodeId || (store.selection?.type === 'node' ? store.selection.id : null);
        if (targetNodeId) {
          const node = store.nodes.find(n => n.id === targetNodeId);
          if (node && !getNodeDefinition(node.type)?.disableTransform) {
            const currentFlipX = node.properties?.flipX || false;
            store.updateNodeProperties(node.id, { flipX: !currentFlipX });
          }
        }
      } else if ((code === 'KeyY' || key === 'y') && !e.ctrlKey && !e.metaKey) {
        const targetNodeId = store.placingNodeId || (store.selection?.type === 'node' ? store.selection.id : null);
        if (targetNodeId) {
          const node = store.nodes.find(n => n.id === targetNodeId);
          if (node && !getNodeDefinition(node.type)?.disableTransform) {
            const currentFlipY = node.properties?.flipY || false;
            store.updateNodeProperties(node.id, { flipY: !currentFlipY });
          }
        }
      } else if ((code === 'KeyR' || key === 'r') && !e.ctrlKey && !e.metaKey) {
        const targetNodeId = store.placingNodeId || (store.selection?.type === 'node' ? store.selection.id : null);
        if (targetNodeId) {
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
      window.removeEventListener('keydown', handleGlobalKeyDown);
      window.removeEventListener('keyup', handleGlobalKeyUp);
    };
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
        draggable={!isDrawingWire && !selectionBox} // Disable stage dragging while drawing wire or selecting
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
        onDragStart={(e) => {
          if (e.target === e.target.getStage()) {
            if (!isInteractingViewRef.current && mainLayerRef.current) {
              isInteractingViewRef.current = true;
              mainLayerRef.current.listening(false);
            }
          }
        }}
        onDragEnd={(e) => {
          if (e.target === e.target.getStage()) {
            if (isInteractingViewRef.current && mainLayerRef.current) {
              isInteractingViewRef.current = false;
              mainLayerRef.current.listening(true);
              mainLayerRef.current.drawHit();
            }
            setStagePos({ x: e.target.x(), y: e.target.y() });
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

          if (!isInteractingViewRef.current && mainLayerRef.current) {
            isInteractingViewRef.current = true;
            mainLayerRef.current.listening(false);
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
            });
          }

          if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
          wheelTimeoutRef.current = setTimeout(() => {
            const finalView = pendingViewRef.current;
            pendingViewRef.current = null;
            if (isInteractingViewRef.current && mainLayerRef.current) {
              isInteractingViewRef.current = false;
              mainLayerRef.current.listening(true);
              mainLayerRef.current.drawHit();
            }
            if (finalView) {
              setStagePos({ x: finalView.x, y: finalView.y });
              if (finalView.scale !== scale) {
                setScale(finalView.scale);
              }
            }
          }, 150);
        }}
        onMouseMove={(e) => {
          const store = useSimulatorStore.getState();
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

              const p1 = getPt(0, 0);
              const p2 = getPt(width, 0);
              const p3 = getPt(0, height);
              const p4 = getPt(width, height);

              const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
              const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
              const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
              const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);

              if (minX < x2 && maxX > x1 && minY < y2 && maxY > y1) {
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
          if (e.target === e.target.getStage() && e.evt.shiftKey && !store.draftWire && (!store.placingNodeId && !store.pastingNodeIds)) {
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
            if (store.draftWire) store.cancelWire();
            if (store.pastingNodeIds) store.cancelPastingNodes();
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

        <Layer ref={mainLayerRef}>
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
