import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Grid } from './Grid';
import { BoardGateNode } from './nodes/board/BoardGateNode';
import { BoardIONode } from './nodes/board/BoardIONode';
import { BoardICNode } from './nodes/board/BoardICNode';
import { BoardTraceRenderer } from './wires/BoardTraceRenderer';
import { getNodeDefinition } from '../../core/engine/nodes';
import { getBoardDimensions } from '../../core/utils/boardLayout';

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
  
  if (def?.renderAs === 'DIP') return <BoardICNode node={boardNode} />;
  if (['INPUT', 'OUTPUT', 'CLOCK', 'VCC', 'GND'].includes(node.type)) return <BoardIONode node={boardNode} />;
  return <BoardGateNode node={boardNode} />;
});

export const BoardCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
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

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        const h = containerRef.current.offsetHeight;
        setDimensions({ width: w, height: h });
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

                  if (draftBoardTrace.type === 'jumper') {
                    completeBoardTrace();
                  } else {
                    addBoardTraceWaypoint();
                  }
                } else {
                  select(null);
                }
              }
            }
          }
        }}
        onDblClick={() => {
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
          {nodeIds.map((id) => (
            <ConnectedNode key={id} id={id} />
          ))}
        </Layer>
      </Stage>
      )}
    </div>
  );
};
