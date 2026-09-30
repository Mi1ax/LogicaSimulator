import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer } from 'react-konva';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import { Grid } from './Grid';
import { GateNode } from './nodes/GateNode';
import { IONode } from './nodes/IONode';
import { WireRenderer } from './wires/WireRenderer';

export const CanvasArea: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  
  const nodes = useSimulatorStore(state => state.nodes);
  const draftWire = useSimulatorStore(state => state.draftWire);
  const updateDraftWire = useSimulatorStore(state => state.updateDraftWire);
  const cancelWire = useSimulatorStore(state => state.cancelWire);
  const select = useSimulatorStore(state => state.select);
  const deleteSelection = useSimulatorStore(state => state.deleteSelection);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
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
        if (e.key === 'Delete' || e.key === 'Backspace') {
          deleteSelection();
        }
      }}
    >
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
          
          const oldScale = stage.scaleX();
          const pointer = stage.getPointerPosition();
          if (!pointer) return;
          
          const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
          };

          let direction = e.evt.deltaY > 0 ? -1 : 1;
          if (e.evt.ctrlKey) {
            direction = -direction;
          }
          
          const scaleBy = 1.1;
          const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
          
          if (newScale < 0.2 || newScale > 5) return;
          
          setScale(newScale);
          setStagePos({
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
          });
        }}
        onMouseMove={(e) => {
          if (draftWire) {
            const stage = e.target.getStage();
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const transform = stage.getAbsoluteTransform().copy().invert();
            const pos = transform.point(pointer);
            updateDraftWire(pos.x, pos.y);
          }
        }}
        onMouseUp={(e) => {
          if (draftWire) {
            cancelWire();
          }
          if (e.target === e.target.getStage()) {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = 'grab';
          }
        }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            select(null);
            if (!draftWire) {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'grabbing';
            }
          }
        }}
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
          {nodes.map((node) => {
            if (node.type === 'INPUT' || node.type === 'OUTPUT' || node.type === 'CLOCK') {
              return <IONode key={node.id} node={node} />;
            }
            return <GateNode key={node.id} node={node} />;
          })}
        </Layer>
      </Stage>
    </div>
  );
};
