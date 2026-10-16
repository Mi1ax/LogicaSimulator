import React, { useRef } from 'react';
import { Group, Rect, Text, Line } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions, getSchematicAnchor } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';

interface Props {
  node: LogicNode;
}

export interface AnnotationColorTheme {
  id: string;
  label: string;
  stroke: string;
  fillRgb: string;
  textLight: string;
  textDark: string;
  cardBgLight: string;
  cardBgDark: string;
  headerBgLight: string;
  headerBgDark: string;
}

export const ANNOTATION_COLORS: Record<string, AnnotationColorTheme> = {
  blue: {
    id: 'blue',
    label: 'Blue',
    stroke: '#3b82f6',
    fillRgb: '59, 130, 246',
    textLight: '#1d4ed8',
    textDark: '#60a5fa',
    cardBgLight: '#eff6ff',
    cardBgDark: '#172554',
    headerBgLight: '#dbeafe',
    headerBgDark: '#1e3a8a',
  },
  emerald: {
    id: 'emerald',
    label: 'Green',
    stroke: '#10b981',
    fillRgb: '16, 185, 129',
    textLight: '#047857',
    textDark: '#34d399',
    cardBgLight: '#ecfdf5',
    cardBgDark: '#064e3b',
    headerBgLight: '#d1fae5',
    headerBgDark: '#065f46',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    stroke: '#f59e0b',
    fillRgb: '245, 158, 11',
    textLight: '#b45309',
    textDark: '#fbbf24',
    cardBgLight: '#fffbeb',
    cardBgDark: '#451a03',
    headerBgLight: '#fef3c7',
    headerBgDark: '#78350f',
  },
  rose: {
    id: 'rose',
    label: 'Rose',
    stroke: '#f43f5e',
    fillRgb: '244, 63, 94',
    textLight: '#be123c',
    textDark: '#fb7185',
    cardBgLight: '#fff1f2',
    cardBgDark: '#4c0519',
    headerBgLight: '#ffe4e6',
    headerBgDark: '#881337',
  },
  purple: {
    id: 'purple',
    label: 'Purple',
    stroke: '#a855f7',
    fillRgb: '168, 85, 247',
    textLight: '#7e22ce',
    textDark: '#c084fc',
    cardBgLight: '#faf5ff',
    cardBgDark: '#3b0764',
    headerBgLight: '#f3e8ff',
    headerBgDark: '#581c87',
  },
  cyan: {
    id: 'cyan',
    label: 'Cyan',
    stroke: '#06b6d4',
    fillRgb: '6, 182, 212',
    textLight: '#0e7490',
    textDark: '#22d3ee',
    cardBgLight: '#ecfeff',
    cardBgDark: '#083344',
    headerBgLight: '#cffafe',
    headerBgDark: '#164e63',
  },
  slate: {
    id: 'slate',
    label: 'Slate',
    stroke: '#64748b',
    fillRgb: '100, 116, 139',
    textLight: '#334155',
    textDark: '#94a3b8',
    cardBgLight: '#f8fafc',
    cardBgDark: '#1e293b',
    headerBgLight: '#e2e8f0',
    headerBgDark: '#334155',
  },
};

type HandleDir = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

const HANDLE_CURSORS: Record<HandleDir, string> = {
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
};

const ResizeHandles: React.FC<{
  node: LogicNode;
  width: number;
  height: number;
  minW?: number;
  minH?: number;
  accentColor: string;
}> = ({ node, width, height, minW = 60, minH = 60, accentColor }) => {
  const updateNodeProperties = useSimulatorStore(state => state.updateNodeProperties);
  const updateNodePosition = useSimulatorStore(state => state.updateNodePosition);
  const dragInitRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  const getHandleCoords = (dir: HandleDir, w: number, h: number): { x: number; y: number } => {
    switch (dir) {
      case 'nw': return { x: 0, y: 0 };
      case 'n':  return { x: w / 2, y: 0 };
      case 'ne': return { x: w, y: 0 };
      case 'e':  return { x: w, y: h / 2 };
      case 'se': return { x: w, y: h };
      case 's':  return { x: w / 2, y: h };
      case 'sw': return { x: 0, y: h };
      case 'w':  return { x: 0, y: h / 2 };
    }
  };

  const directions: HandleDir[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  const hs = 8;

  const applyResize = (dir: HandleDir, e: any) => {
    e.cancelBubble = true;
    const init = dragInitRef.current;
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!init || !stage || !pointer) return;

    const worldPos = stage.getAbsoluteTransform().copy().invert().point(pointer);
    const snapX = Math.round(worldPos.x / 20) * 20;
    const snapY = Math.round(worldPos.y / 20) * 20;

    const right = init.startX + init.startW;
    const bottom = init.startY + init.startH;

    let newX = init.startX;
    let newY = init.startY;
    let newW = init.startW;
    let newH = init.startH;

    if (dir.includes('e')) {
      newW = Math.max(minW, snapX - init.startX);
    }
    if (dir.includes('s')) {
      newH = Math.max(minH, snapY - init.startY);
    }
    if (dir.includes('w')) {
      newX = Math.min(right - minW, snapX);
      newW = right - newX;
    }
    if (dir.includes('n')) {
      newY = Math.min(bottom - minH, snapY);
      newH = bottom - newY;
    }

    const pos = getHandleCoords(dir, newW, newH);
    e.target.position({ x: pos.x - hs / 2, y: pos.y - hs / 2 });

    if (newX !== node.x || newY !== node.y) {
      updateNodePosition(node.id, newX, newY);
    }
    if (newW !== width || newH !== height) {
      updateNodeProperties(node.id, { width: newW, height: newH });
    }
  };

  return (
    <>
      {directions.map((dir) => {
        const pos = getHandleCoords(dir, width, height);
        return (
          <Rect
            key={dir}
            x={pos.x - hs / 2}
            y={pos.y - hs / 2}
            width={hs}
            height={hs}
            fill="#ffffff"
            stroke={accentColor}
            strokeWidth={2}
            cornerRadius={2}
            hitStrokeWidth={10}
            draggable
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onClick={(e) => {
              e.cancelBubble = true;
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              useSimulatorStore.getState().saveHistory();
              dragInitRef.current = {
                startX: node.x,
                startY: node.y,
                startW: width,
                startH: height,
              };
            }}
            onDragMove={(e) => applyResize(dir, e)}
            onDragEnd={(e) => {
              applyResize(dir, e);
              dragInitRef.current = null;
            }}
            onMouseEnter={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = HANDLE_CURSORS[dir];
            }}
            onMouseLeave={(e) => {
              const container = e.target.getStage()?.container();
              if (container) container.style.cursor = 'default';
            }}
          />
        );
      })}
    </>
  );
};

function getRegionBoxContainedIds(regionNode: LogicNode, width: number, height: number): string[] {
  const store = useSimulatorStore.getState();
  const x1 = regionNode.x;
  const y1 = regionNode.y;
  const x2 = regionNode.x + width;
  const y2 = regionNode.y + height;

  const containedIds: string[] = [];
  const containedNodeSet = new Set<string>();

  for (const other of store.nodes) {
    if (other.id === regionNode.id) continue;

    const { width: nw, height: nh } = getSchematicDimensions(other);
    const { x: anchorX, y: anchorY } = getSchematicAnchor(other);
    const rot = ((other.properties?.rotation || 0) * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const flipX = other.properties?.flipX ? -1 : 1;
    const flipY = other.properties?.flipY ? -1 : 1;

    const getPt = (px: number, py: number) => {
      const dx = (px - anchorX) * flipX;
      const dy = (py - anchorY) * flipY;
      return {
        x: other.x + anchorX + (dx * cos - dy * sin),
        y: other.y + anchorY + (dx * sin + dy * cos),
      };
    };

    const p1 = getPt(0, 0);
    const p2 = getPt(nw, 0);
    const p3 = getPt(0, nh);
    const p4 = getPt(nw, nh);

    const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
    const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
    const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
    const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    if (other.type === 'REGION_BOX') {
      if (minX >= x1 && maxX <= x2 && minY >= y1 && maxY <= y2) {
        containedIds.push(other.id);
        containedNodeSet.add(other.id);
      }
    } else if (cx >= x1 && cx <= x2 && cy >= y1 && cy <= y2) {
      containedIds.push(other.id);
      containedNodeSet.add(other.id);
    }
  }

  for (const wire of store.wires) {
    if (
      containedNodeSet.has(wire.sourceNodeId) &&
      wire.targetNodeId &&
      containedNodeSet.has(wire.targetNodeId)
    ) {
      containedIds.push(wire.id);
    } else if (wire.waypoints) {
      wire.waypoints.forEach((wp, idx) => {
        if (wp.x >= x1 && wp.x <= x2 && wp.y >= y1 && wp.y <= y2) {
          containedIds.push(`wp:${wire.id}:${idx}`);
        }
      });
    }
  }

  return containedIds;
}

let textMeasureCtx: CanvasRenderingContext2D | null = null;
function measureHeaderTextWidth(text: string): number {
  if (typeof document !== 'undefined') {
    if (!textMeasureCtx) {
      const canvas = document.createElement('canvas');
      textMeasureCtx = canvas.getContext('2d');
    }
    if (textMeasureCtx) {
      textMeasureCtx.font = 'bold 12px sans-serif';
      return textMeasureCtx.measureText(text).width;
    }
  }
  return text.length * 9.5;
}

export const SchematicRegionBoxNode: React.FC<Props> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const isPlacing = useSimulatorStore(
    state => state.placingNodeId === node.id || Boolean(state.pastingNodeIds && state.pastingNodeIds.includes(node.id))
  );
  const titleBarMouseDownRef = useRef<{ active: boolean; shiftKey: boolean }>({
    active: false,
    shiftKey: false,
  });

  const isDark = theme === 'dark';
  const canvasTheme = getCanvasTheme(isDark);
  const { width, height } = getSchematicDimensions(node);

  const colorKey = node.properties?.color || 'blue';
  const palette = ANNOTATION_COLORS[colorKey] || ANNOTATION_COLORS.blue;
  const borderStyle = node.properties?.borderStyle || 'dashed';
  const fillOpacity = typeof node.properties?.fillOpacity === 'number' ? node.properties.fillOpacity : 0.08;
  const title = node.properties?.label ?? 'Block Title';

  const dash =
    borderStyle === 'dashed'
      ? [8, 6]
      : borderStyle === 'dotted'
      ? [3, 5]
      : undefined;

  const measuredTextW = Math.ceil(measureHeaderTextWidth(title));
  const maxBadgeW = Math.max(44, width - 20);
  const isClampedToBox = measuredTextW + 20 > maxBadgeW;
  const headerBadgeWidth = Math.min(maxBadgeW, Math.max(40, measuredTextW + 20));

  return (
    <SchematicNodeWrapper
      node={node}
      getExtraDragIds={(e) => {
        const isTitleBar = titleBarMouseDownRef.current.active;
        const isShift = titleBarMouseDownRef.current.shiftKey || e.evt.shiftKey;
        titleBarMouseDownRef.current = { active: false, shiftKey: false };
        if (isTitleBar && isShift) {
          return getRegionBoxContainedIds(node, width, height);
        }
        return undefined;
      }}
    >
      {/* Translucent interior fill: non-listening so panning & marquee selection inside work seamlessly */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={`rgba(${palette.fillRgb}, ${fillOpacity})`}
        cornerRadius={8}
        listening={isPlacing}
        perfectDrawEnabled={false}
      />

      {/* Interactive border frame: fillEnabled=false so only the border stroke captures clicks/drags */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fillEnabled={false}
        stroke={isSelected ? canvasTheme.selectedNodeColor : palette.stroke}
        strokeWidth={isSelected ? 2.5 : 2}
        dash={dash}
        cornerRadius={8}
        hitStrokeWidth={16}
        perfectDrawEnabled={false}
        onMouseDown={() => {
          titleBarMouseDownRef.current = { active: false, shiftKey: false };
        }}
      />

      {/* Interactive Header Badge (Title Bar) */}
      {title && (
        <Group
          x={10}
          y={-12}
          onMouseDown={(e) => {
            titleBarMouseDownRef.current = {
              active: true,
              shiftKey: Boolean(e.evt.shiftKey),
            };
          }}
        >
          <Rect
            x={0}
            y={0}
            width={headerBadgeWidth}
            height={24}
            fill={isDark ? palette.headerBgDark : palette.headerBgLight}
            stroke={isSelected ? canvasTheme.selectedNodeColor : palette.stroke}
            strokeWidth={1.5}
            cornerRadius={5}
            perfectDrawEnabled={false}
          />
          <Text
            text={title}
            x={10}
            y={5}
            width={isClampedToBox ? headerBadgeWidth - 20 : undefined}
            fontSize={12}
            fontStyle="bold"
            fontFamily="sans-serif"
            fill={isDark ? palette.textDark : palette.textLight}
            wrap="none"
            ellipsis={isClampedToBox}
            listening={false}
            perfectDrawEnabled={false}
          />
        </Group>
      )}

      {isSelected && !isPlacing && (
        <ResizeHandles
          node={node}
          width={width}
          height={height}
          minW={60}
          minH={60}
          accentColor={canvasTheme.selectedNodeColor}
        />
      )}
    </SchematicNodeWrapper>
  );
});

export const SchematicTextLabelNode: React.FC<Props> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );

  const isDark = theme === 'dark';
  const canvasTheme = getCanvasTheme(isDark);
  const { width, height } = getSchematicDimensions(node);

  const text = node.properties?.label || 'Heading Text';
  const fontSize = Math.max(10, Number(node.properties?.fontSize) || 20);
  const colorKey = node.properties?.color || 'default';
  const bold = node.properties?.bold !== false;
  const italic = !!node.properties?.italic;
  const fontFamily = node.properties?.fontFamily === 'mono' ? 'monospace' : 'sans-serif';
  const align = node.properties?.align || 'left';

  const fontStyle =
    bold && italic ? 'bold italic' : bold ? 'bold' : italic ? 'italic' : 'normal';

  const palette = ANNOTATION_COLORS[colorKey];
  const fill = palette
    ? isDark
      ? palette.textDark
      : palette.textLight
    : canvasTheme.textColor;

  const invRot = -(node.properties?.rotation || 0);
  const flipScaleX = node.properties?.flipX ? -1 : 1;
  const flipScaleY = node.properties?.flipY ? -1 : 1;

  return (
    <SchematicNodeWrapper node={node}>
      <Rect
        x={-6}
        y={-4}
        width={width + 12}
        height={height + 8}
        fill={isSelected ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)') : 'transparent'}
        stroke={isSelected ? canvasTheme.selectedNodeColor : 'transparent'}
        strokeWidth={isSelected ? 1.5 : 0}
        dash={[4, 4]}
        cornerRadius={4}
        perfectDrawEnabled={false}
      />
      <Text
        text={text}
        x={0}
        y={0}
        width={width}
        align={align}
        wrap="none"
        fontSize={fontSize}
        fontStyle={fontStyle}
        fontFamily={fontFamily}
        fill={fill}
        lineHeight={1.25}
        scaleX={flipScaleX}
        scaleY={flipScaleY}
        rotation={invRot !== 0 ? 0 : 0}
        listening={false}
        perfectDrawEnabled={false}
      />
    </SchematicNodeWrapper>
  );
});

export const SchematicStickyNoteNode: React.FC<Props> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isSelected = useSimulatorStore(state =>
    (state.selection?.type === 'node' && state.selection.id === node.id) ||
    state.multiSelection.includes(node.id)
  );
  const isPlacing = useSimulatorStore(
    state => state.placingNodeId === node.id || Boolean(state.pastingNodeIds && state.pastingNodeIds.includes(node.id))
  );

  const isDark = theme === 'dark';
  const canvasTheme = getCanvasTheme(isDark);
  const { width, height } = getSchematicDimensions(node);

  const colorKey = node.properties?.color || 'amber';
  const palette = ANNOTATION_COLORS[colorKey] || ANNOTATION_COLORS.amber;
  const title = node.properties?.label ?? 'Note';
  const bodyText = node.properties?.text ?? '';
  const fontSize = Math.max(9, Number(node.properties?.fontSize) || 12);
  const fontFamily = node.properties?.fontFamily === 'mono' ? 'monospace' : 'sans-serif';

  const headerH = 26;

  return (
    <SchematicNodeWrapper node={node}>
      {/* Card Body */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={isDark ? palette.cardBgDark : palette.cardBgLight}
        stroke={isSelected ? canvasTheme.selectedNodeColor : palette.stroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={6}
        perfectDrawEnabled={false}
      />

      {/* Card Header Strip */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={headerH}
        fill={isDark ? palette.headerBgDark : palette.headerBgLight}
        cornerRadius={[6, 6, 0, 0]}
        listening={false}
        perfectDrawEnabled={false}
      />

      <Line
        points={[0, headerH, width, headerH]}
        stroke={palette.stroke}
        strokeWidth={1}
        opacity={0.5}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Header Title */}
      <Text
        text={title || 'Note'}
        x={10}
        y={7}
        width={width - 20}
        fontSize={12}
        fontStyle="bold"
        fontFamily="sans-serif"
        fill={isDark ? palette.textDark : palette.textLight}
        wrap="none"
        ellipsis={true}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Multiline Body Text */}
      <Text
        text={bodyText}
        x={10}
        y={headerH + 8}
        width={Math.max(20, width - 20)}
        height={Math.max(10, height - headerH - 14)}
        fontSize={fontSize}
        fontFamily={fontFamily}
        fill={canvasTheme.textColor}
        lineHeight={1.35}
        wrap="word"
        ellipsis={true}
        listening={false}
        perfectDrawEnabled={false}
      />

      {isSelected && !isPlacing && (
        <ResizeHandles
          node={node}
          width={width}
          height={height}
          minW={100}
          minH={60}
          accentColor={canvasTheme.selectedNodeColor}
        />
      )}
    </SchematicNodeWrapper>
  );
});
