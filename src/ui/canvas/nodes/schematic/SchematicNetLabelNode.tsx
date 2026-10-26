import React from 'react';
import { Shape } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore, isIdSelected } from '../../../../store/useSimulatorStore';
import { Pin } from '../../primitives/Pin';
import { getSchematicDimensions } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface NetLabelProps {
  node: LogicNode;
}

const SELECTION_DASH = [2, 2];

let netLabelMeasureCtx: CanvasRenderingContext2D | null = null;
export function getNetLabelTextWidth(name: string, bold = false): number {
  if (typeof document !== 'undefined') {
    if (!netLabelMeasureCtx) {
      const canvas = document.createElement('canvas');
      netLabelMeasureCtx = canvas.getContext('2d');
    }
    if (netLabelMeasureCtx) {
      netLabelMeasureCtx.font = `${bold ? 'bold ' : ''}10px sans-serif`;
      return Math.max(24, Math.ceil(netLabelMeasureCtx.measureText(name).width + 8));
    }
  }
  return Math.max(24, Math.ceil(name.length * 6.5 + 8));
}

interface NetLabelSprite {
  canvas: HTMLCanvasElement;
  minX: number;
  width: number;
  height: number;
}

const netLabelSpriteCache = new Map<string, NetLabelSprite>();

function getNetLabelSprite(
  name: string,
  width: number,
  height: number,
  textWidth: number,
  boxX: number,
  isInputSide: boolean,
  isBold: boolean,
  flipX: boolean,
  flipY: boolean,
  isSelected: boolean,
  strokeColor: string,
  textColor: string
): NetLabelSprite | null {
  if (typeof document === 'undefined') return null;
  const key = `${name}|${width}|${height}|${textWidth}|${isInputSide ? 1 : 0}|${isBold ? 1 : 0}|${flipX ? 1 : 0}|${flipY ? 1 : 0}|${isSelected ? 1 : 0}|${strokeColor}|${textColor}`;
  const cached = netLabelSpriteCache.get(key);
  if (cached) return cached;

  const minX = Math.min(0, boxX - 2);
  const maxX = Math.max(width, boxX + textWidth + 2);
  const spriteW = maxX - minX;
  const spriteH = height;
  const pr = 2;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(spriteW * pr);
  canvas.height = Math.ceil(spriteH * pr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(pr, pr);
  ctx.translate(-minX, 0);

  // Stub line
  ctx.beginPath();
  if (isInputSide) {
    ctx.moveTo(0, height / 2);
    ctx.lineTo(10, height / 2);
  } else {
    ctx.moveTo(width - 10, height / 2);
    ctx.lineTo(width, height / 2);
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label text
  const boxCenterX = boxX + textWidth / 2;
  const alignRight = flipX ? isInputSide : !isInputSide;
  ctx.save();
  ctx.translate(boxCenterX, height / 2);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.font = `${isBold ? 'bold ' : ''}10px sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = alignRight ? 'right' : 'left';
  ctx.fillText(name, alignRight ? textWidth / 2 : -textWidth / 2, 0);
  ctx.restore();

  if (isSelected) {
    ctx.save();
    ctx.setLineDash(SELECTION_DASH);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(boxX, height / 2 - 8, textWidth, 16);
    ctx.restore();
  }

  if (netLabelSpriteCache.size > 1024) {
    netLabelSpriteCache.clear();
  }
  const entry: NetLabelSprite = { canvas, minX, width: spriteW, height: spriteH };
  netLabelSpriteCache.set(key, entry);
  return entry;
}

export const SchematicNetLabelNode: React.FC<NetLabelProps> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state => isIdSelected(state, node.id));
  const canvasTheme = getCanvasTheme(theme === 'dark');
  
  const { width, height } = getSchematicDimensions(node);
  const pin = node.inputs[0] || node.outputs[0];

  const isInputSide = node.type === 'SUB_OUT' || (node.type === 'SUB_IO' && node.properties?.flipX);
  const name = String(node.properties?.label || (node.type === 'SUB_IN' ? 'IN' : node.type === 'SUB_OUT' ? 'OUT' : node.type === 'SUB_IO' ? 'I/O' : 'NET'));
  const isBold = node.type.startsWith('SUB_');
  const textWidth = getNetLabelTextWidth(name, isBold);
  const boxX = isInputSide ? 10 : (width - 10) - textWidth;
  const hitX = isInputSide ? 0 : boxX;
  const hitWidth = textWidth + 10;
  const flipX = Boolean(node.properties?.flipX);
  const flipY = Boolean(node.properties?.flipY);
  const strokeColor = isSelected ? canvasTheme.selectedNodeColor : canvasTheme.nodeBorder;
  const textColor = isSelected ? canvasTheme.selectedNodeColor : canvasTheme.textColor;

  const sprite = getNetLabelSprite(
    name,
    width,
    height,
    textWidth,
    boxX,
    Boolean(isInputSide),
    isBold,
    flipX,
    flipY,
    isSelected,
    strokeColor,
    textColor
  );

  return (
    <SchematicNodeWrapper
      node={node}
      cursor={(node.type === 'SUB_IN' || node.type === 'SUB_IO') ? 'pointer' : 'grab'}
      onClickExtra={() => {
        const store = useSimulatorStore.getState();
        if (node.type === 'SUB_IN') {
          const currentValue = node.properties?.value === 1 ? 1 : 0;
          store.updateNodeProperties(node.id, { value: currentValue === 1 ? 0 : 1 });
        } else if (node.type === 'SUB_IO') {
          let nextValue: any = undefined;
          if (node.properties?.value === undefined) nextValue = 0;
          else if (node.properties?.value === 0) nextValue = 1;
          else if (node.properties?.value === 1) nextValue = undefined;
          store.updateNodeProperties(node.id, { value: nextValue });
        }
      }}
    >
      <Shape
        fill="#000000"
        perfectDrawEnabled={false}
        shadowForStrokeEnabled={false}
        sceneFunc={(ctx) => {
          if (sprite) {
            ctx.drawImage(sprite.canvas, sprite.minX, 0, sprite.width, sprite.height);
          }
        }}
        hitFunc={(ctx, shape) => {
          ctx.beginPath();
          ctx.rect(hitX, height / 2 - 10, hitWidth, 20);
          ctx.closePath();
          ctx.fillStrokeShape(shape);
        }}
      />
      
      {pin && (
        <Pin
          id={pin.id}
          nodeId={node.id}
          x={isInputSide ? 0 : width}
          y={height / 2}
          type={pin.type}
        />
      )}
    </SchematicNodeWrapper>
  );
});

