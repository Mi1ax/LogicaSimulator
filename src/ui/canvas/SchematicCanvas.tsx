import { SchematicJunctionNode } from "./nodes/schematic/SchematicJunctionNode";
import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Grid } from './Grid';
import { SchematicGateNode } from './nodes/schematic/SchematicGateNode';
import { SchematicIONode } from './nodes/schematic/SchematicIONode';
import { SchematicICNode } from './nodes/schematic/SchematicICNode';
import { WireRenderer } from './wires/WireRenderer';
import { getNodeDefinition } from '../../core/engine/nodes';
import { getSchematicDimensions } from '../../core/utils/schematicLayout';

import { useShallow } from 'zustand/react/shallow';

const ConnectedNode = React.memo(({ id }: { id: string }) => {
  const node = useSimulatorStore(state => state.nodes.find(n => n.id === id));
  if (!node) return null;
  const def = getNodeDefinition(node.type);
  if (def?.renderAs === 'DIP') return <SchematicICNode node={node} />;
  if (['INPUT', 'OUTPUT', 'CLOCK', 'VCC', 'GND'].includes(node.type)) return <SchematicIONode node={node} />;
  if (node.type === 'JUNCTION') return <SchematicJunctionNode node={node} />;
  return <SchematicGateNode node={node} />;
});

export const SchematicCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  
  const nodeIds = useSimulatorStore(useShallow(state => state.nodes.map(n => n.id)));
  const draftWire = useSimulatorStore(state => state.draftWire);
  const updateDraftWire = useSimulatorStore(state => state.updateDraftWire);
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

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const store = useSimulatorStore.getState();
        if (store.draftWire) store.cancelWire();
        if (store.placingNodeId) store.cancelPlacingNode();
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
          if (store.draftWire) store.cancelWire();
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
        draggable={!draftWire} // Disable stage dragging while drawing wire
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

          if (draftWire) {
            updateDraftWire(Math.round(pos.x / 10) * 10, Math.round(pos.y / 10) * 10);
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
              if (store.addWaypoint) {
                store.addWaypoint(store.draftWire!.endX, store.draftWire!.endY);
              }
            } else {
              select(null);
            }
          }
        }}
        onMouseDown={(e) => {
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
          {nodeIds.map((id) => (
            <ConnectedNode key={id} id={id} />
          ))}
        </Layer>
      </Stage>
      )}
    </div>
  );
};
