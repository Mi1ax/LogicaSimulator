import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Grid } from './Grid';
import { BoardGateNode } from './nodes/board/BoardGateNode';
import { BoardIONode } from './nodes/board/BoardIONode';
import { BoardICNode } from './nodes/board/BoardICNode';
import { BoardDipSwitchNode } from './nodes/board/BoardDipSwitchNode';
import { BoardTraceRenderer } from './wires/BoardTraceRenderer';
import { getNodeDefinition } from '../../core/engine/nodes';
import { getBoardDimensions } from '../../core/utils/boardLayout';

import { Board7SegNode } from './nodes/board/Board7SegNode';
import { useShallow } from 'zustand/react/shallow';
import { isTraceValid } from '../../core/utils/geometry';

const ConnectedNode = React.memo(({ id }: { id: string }) => {
  const node = useSimulatorStore(state => state.nodes.find(n => n.id === id));
  if (!node) return null;

  // Don't render abstract junctions on the physical board
  if (node.type === 'JUNCTION') return null;

  // Don't render on the board if it hasn't been explicitly placed yet
  if (node.boardX === undefined || node.boardY === undefined) return null;

  const def = getNodeDefinition(node.type);
  const boardNode = { ...node, x: node.boardX, y: node.boardY };
  
  if (node.type === '7_SEG_DISPLAY') return <Board7SegNode node={boardNode} />;
  if (node.type === 'DIP_SWITCH') return <BoardDipSwitchNode node={boardNode} />;
  if (def?.renderAs === 'DIP') return <BoardICNode node={boardNode} />;
  if (['INPUT', 'OUTPUT', 'CLOCK', 'VCC', 'GND'].includes(node.type)) return <BoardIONode node={boardNode} />;
  return <BoardGateNode node={boardNode} />;
});

export const BoardCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, width: number, height: number } | null>(null);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const scale = useSimulatorStore(state => state.boardScale);
  const setScale = useSimulatorStore(state => state.setBoardScale);
  
  const nodeIds = useSimulatorStore(useShallow(state => state.nodes.filter(n => n.type !== 'JUNCTION').map(n => n.id)));
  const draftBoardTrace = useSimulatorStore(state => state.draftBoardTrace);
  
  const updateDraftBoardTrace = useSimulatorStore(state => state.updateDraftBoardTrace);
  const addBoardTraceWaypoint = useSimulatorStore(state => state.addBoardTraceWaypoint);
  const completeBoardTrace = useSimulatorStore(state => state.completeBoardTrace);
  const cancelBoardTrace = useSimulatorStore(state => state.cancelBoardTrace);

  const select = useSimulatorStore(state => state.select);
  const deleteSelection = useSimulatorStore(state => state.deleteSelection);
  const settings = useSimulatorStore(state => state.settings);

  const initializedRef = useRef(false);
  const clickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        setDimensions({ width: w, height: h });
        if (!initializedRef.current && w > 0 && h > 0) {
          setStagePos({ x: w / 2, y: h / 2 });
          initializedRef.current = true;
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="flex-1 h-full bg-slate-50 dark:bg-slate-900 overflow-hidden outline-none"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.repeat) return; // Prevent holding down the key from firing rapidly
        
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
          if (store.draftBoardTrace) store.cancelBoardTrace();
          if (store.placingNodeId) store.cancelPlacingNode();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          deleteSelection();
        } else if (e.key.toLowerCase() === 'r') {
          const targetNodeId = store.placingNodeId || (store.selection?.type === 'node' ? store.selection.id : null);
          if (targetNodeId) {
            const node = store.nodes.find(n => n.id === targetNodeId);
            if (node && node.type !== 'JUNCTION') {
              const currentRot = node.properties?.boardRotation || 0;
              store.updateNodeProperties(node.id, { boardRotation: (currentRot + 90) % 360 });
            }
          }
        }
      }}
    >
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Stage
          width={dimensions.width}
          height={dimensions.height}
        draggable={!draftBoardTrace} // Disable stage dragging while drawing wire
        x={stagePos.x}
        y={stagePos.y}
        scaleX={scale}
        scaleY={scale}
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
            
            setScale(newScale);
            setStagePos({
              x: pointer.x - mousePointTo.x * newScale,
              y: pointer.y - mousePointTo.y * newScale,
            });
          } else {
            // Pan logic
            let panX = deltaX;
            let panY = deltaY;

            // If shift is held on a regular mouse, scroll horizontally
            if (shiftKey && !isTrackpadPinch) {
              panX = deltaY;
              panY = deltaX;
            }

            setStagePos((prev) => ({
              x: prev.x - panX * settings.panSpeed,
              y: prev.y - panY * settings.panSpeed,
            }));
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
          let gridX = Math.round(pos.x / 20) * 20;
          let gridY = Math.round(pos.y / 20) * 20;

          if (selectionBox) {
            setSelectionBox({
              ...selectionBox,
              width: pos.x - selectionBox.startX,
              height: pos.y - selectionBox.startY
            });
            return;
          }

          if (draftBoardTrace) {
            // Enforce strictly orthogonal 90-degree lines ONLY for solder
            if (draftBoardTrace.type === 'solder' && draftBoardTrace.points.length >= 2) {
              const lastCommitted = draftBoardTrace.points[draftBoardTrace.points.length - 2];
              const dx = Math.abs(gridX - lastCommitted.x);
              const dy = Math.abs(gridY - lastCommitted.y);
              
              if (dx > dy) {
                gridY = lastCommitted.y;
              } else {
                gridX = lastCommitted.x;
              }
            }
            
            updateDraftBoardTrace(gridX, gridY);
          } else if (store.placingNodeId) {
            const node = store.nodes.find(n => n.id === store.placingNodeId);
            let offsetX = 0;
            let offsetY = 0;
            if (node) {
              const { width, height } = getBoardDimensions(node); // false for board mode
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
              const { width, height } = getBoardDimensions(node);
              const nx1 = node.boardX ?? node.x;
              const ny1 = node.boardY ?? node.y;
              const nx2 = nx1 + width;
              const ny2 = ny1 + height;
              if (nx1 < x2 && nx2 > x1 && ny1 < y2 && ny2 > y1) {
                selectedIds.push(node.id);
              }
            });
            
            store.boardTraces.forEach(trace => {
              const inside = trace.points.some(p => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2);
              if (inside) selectedIds.push(trace.id);
            });
            
            if (selectedIds.length > 0) {
              store.setMultiSelection(selectedIds);
            }
            setSelectionBox(null);
            return;
          }
          if (e.target === e.target.getStage()) {
            const container = e.target.getStage()?.container();
            if (container && !draftBoardTrace && !useSimulatorStore.getState().placingNodeId) container.style.cursor = 'grab';
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
            const stage = e.target.getStage();
            if (stage) {
              const pointer = stage.getPointerPosition();
              if (pointer) {

                if (draftBoardTrace) {
                  // Validate overlap for solder
                  if (draftBoardTrace.type === 'solder') {
                    const store = useSimulatorStore.getState();
                    if (!isTraceValid(draftBoardTrace.points, store.boardTraces)) {
                      return; // Block click if invalid overlap
                    }
                  }

                  if (clickTimeout.current) clearTimeout(clickTimeout.current);
                  clickTimeout.current = setTimeout(() => {
                    // Check draftBoardTrace from store again in case it was cancelled
                    const currentDraft = useSimulatorStore.getState().draftBoardTrace;
                    if (!currentDraft) return;

                    if (currentDraft.type === 'jumper') {
                      completeBoardTrace();
                    } else {
                      addBoardTraceWaypoint();
                    }
                  }, 250);
                } else {
                  if (store.selection) {
                    select(null);
                    return;
                  }
                  
                  select(null);
                  
                  const transform = stage.getAbsoluteTransform().copy().invert();
                  const pos = transform.point(pointer);
                  const gridX = Math.round(pos.x / 20) * 20;
                  const gridY = Math.round(pos.y / 20) * 20;
                  
                  store.startBoardTrace(gridX, gridY);
                }
              }
            }
          }
        }}
        onDblClick={() => {
          if (clickTimeout.current) clearTimeout(clickTimeout.current);
          if (draftBoardTrace) {
            if (draftBoardTrace.type === 'solder') {
              const store = useSimulatorStore.getState();
              if (!isTraceValid(draftBoardTrace.points, store.boardTraces)) {
                return; // Block complete if invalid overlap
              }
            }
            completeBoardTrace();
          }
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage() && e.evt.shiftKey && !draftBoardTrace && !useSimulatorStore.getState().placingNodeId) {
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
            // Right click cancels
            if (draftBoardTrace) cancelBoardTrace();
            return;
          }
          if (e.target === e.target.getStage()) {
            if (!draftBoardTrace) {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'grabbing';
            }
          }
        }}
        onContextMenu={(e) => e.evt.preventDefault()}
        style={{ cursor: draftBoardTrace ? 'crosshair' : 'grab' }}
      >
        <Grid 
          width={dimensions.width} 
          height={dimensions.height} 
          scale={scale} 
          x={stagePos.x} 
          y={stagePos.y} 
        />

        <Layer>
          <BoardTraceRenderer />
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
