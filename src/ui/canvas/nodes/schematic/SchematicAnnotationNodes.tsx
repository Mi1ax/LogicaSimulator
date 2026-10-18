import React, { useRef, useMemo } from 'react';
import { Group, Rect, Text, Line, Path, Circle } from 'react-konva';
import { LogicNode } from '../../../../core/models/types';
import { useSimulatorStore } from '../../../../store/useSimulatorStore';
import { getSchematicDimensions, getSchematicAnchor } from '../../../../core/utils/schematicLayout';
import { getCanvasTheme } from '../../theme';
import { SchematicNodeWrapper } from './SchematicNodeWrapper';
import { extractFsmFromPld, getLiveFsmStatus } from '../../../../core/utils/fsmExtractor';
import {
  customPositionsCache,
  FSM_CARD_WIDTH,
  getFsmCardHeight,
  getRectBorderPoint,
  computeDefaultFsmPositions,
} from '../../../components/FsmDiagramView';

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
  const isLowDetail = useSimulatorStore(state => state.schematicScale < 0.45);
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

      {/* Multiline Body Text (skipped at strong zoom-out to avoid expensive word-wrap layout) */}
      {!isLowDetail && bodyText && (
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
      )}

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

const FSM_HEADER_CORNER_RADIUS = [8, 8, 0, 0];
const FSM_CARD_HEADER_CORNER_RADIUS = [10, 10, 0, 0];
const FSM_CARD_DIVIDER_POINTS = [0, 32, FSM_CARD_WIDTH, 32];
const SELF_LOOP_DASH = [4, 3];
const NEXT_STATE_DASH = [5, 3];

function computeArrowPoints(ex: number, ey: number, tx: number, ty: number, len = 8.5, halfW = 4.2): number[] {
  const dx = ex - tx;
  const dy = ey - ty;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  return [
    ex,
    ey,
    ex - ux * len - uy * halfW,
    ey - uy * len + ux * halfW,
    ex - ux * len + uy * halfW,
    ey - uy * len - ux * halfW,
  ];
}

export const SchematicFsmDiagramNode: React.FC<Props> = React.memo(({ node }) => {
  const theme = useSimulatorStore(state => state.theme);
  const isLowDetail = useSimulatorStore(state => state.schematicScale < 0.55);
  const nodes = useSimulatorStore(state => state.nodes);
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

  const colorKey = node.properties?.color || 'slate';
  const palette = ANNOTATION_COLORS[colorKey] || ANNOTATION_COLORS.slate;
  const headerH = 26;

  // Find target GAL22V10 node on the schematic
  const galNode = useMemo(() => {
    const targetId = node.properties?.targetNodeId;
    if (targetId) {
      const found = nodes.find(n => n.id === targetId && n.type === 'GAL22V10');
      if (found) return found;
    }
    return nodes.find(n => n.type === 'GAL22V10') || null;
  }, [nodes, node.properties?.targetNodeId]);

  const pldSource = galNode?.properties?.pldSource || '';
  const fsm = useMemo(() => extractFsmFromPld(pldSource), [pldSource]);

  // Subscribe ONLY to the resolved currentStateName + nextStateName string so clock edges (I/CLK)
  // or unrelated GAL22V10 input toggles that do not change the active/next state cause 0 re-renders.
  const liveStateSig = useSimulatorStore(state => {
    if (!galNode || !fsm.hasFsm) return '';
    const status = getLiveFsmStatus(fsm, galNode.id, state.simState.pinStates);
    return `${status.currentStateName || ''}|${status.currentStateCode}|${status.nextStateName || ''}`;
  });

  const liveStatus = useMemo(() => {
    if (!liveStateSig) {
      return { currentStateName: null, currentStateCode: '', nextStateName: null };
    }
    const [curName, curCode, nextName] = liveStateSig.split('|');
    return {
      currentStateName: curName || null,
      currentStateCode: curCode || '',
      nextStateName: nextName || null,
    };
  }, [liveStateSig]);

  const positions = useMemo(() => {
    const defaults = computeDefaultFsmPositions(fsm.states);
    const cached = (galNode && customPositionsCache.get(galNode.id)) || {};
    return { ...defaults, ...cached };
  }, [fsm.states, galNode]);

  // Compute bounding box of the FSM diagram to auto-fit inside the card body
  const layoutFit = useMemo(() => {
    if (!fsm.hasFsm || fsm.states.length === 0) {
      return { scale: 1, offsetX: 0, offsetY: 0 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    fsm.states.forEach((st, idx) => {
      const pos = positions[st.name] || { x: 300, y: 200 };
      const cardH = getFsmCardHeight(st, false);
      const left = pos.x - FSM_CARD_WIDTH / 2 - (idx === 0 ? 54 : 16);
      const right = pos.x + FSM_CARD_WIDTH / 2 + 16;
      const top = pos.y - cardH / 2 - 58; // Extra top room for self-loops
      const bottom = pos.y + cardH / 2 + 24;
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    });

    const contentW = Math.max(100, maxX - minX);
    const contentH = Math.max(100, maxY - minY);
    const availW = Math.max(60, width - 24);
    const availH = Math.max(60, height - headerH - 24);

    const scale = Math.min(1.15, availW / contentW, availH / contentH);
    const offsetX = 12 + (availW - contentW * scale) / 2 - minX * scale;
    const offsetY = headerH + 12 + (availH - contentH * scale) / 2 - minY * scale;

    return { scale, offsetX, offsetY };
  }, [fsm, positions, width, height]);

  const pairCounts = useMemo(() => {
    const counts = new Map<string, number>();
    fsm.transitions.forEach(t => {
      if (!t.isSelfLoop) {
        const key = [t.from, t.to].sort().join('--');
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return counts;
  }, [fsm.transitions]);

  // Precompute transition curves, arrow points, and pill geometry once per layout
  const precomputedTransitions = useMemo(() => {
    return fsm.transitions
      .map((t, idx) => {
        const fromState = fsm.states.find(s => s.name === t.from);
        const toState = fsm.states.find(s => s.name === t.to);
        if (!fromState || !toState) return null;

        const p1 = positions[t.from];
        const p2 = positions[t.to];
        if (!p1 || !p2) return null;

        const h1 = getFsmCardHeight(fromState, false);
        const h2 = getFsmCardHeight(toState, false);

        if (t.isSelfLoop) {
          const topY = p1.y - h1 / 2;
          const sx = p1.x - 28;
          const sy = topY;
          const ex = p1.x + 28;
          const ey = topY;
          const c1x = p1.x - 55;
          const c1y = topY - 52;
          const c2x = p1.x + 55;
          const c2y = topY - 52;
          const pathD = `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`;
          const labelX = p1.x;
          const labelY = topY - 44;
          const labelStr = t.guard.length > 22 ? t.guard.slice(0, 20) + '…' : t.guard;
          const pillW = Math.max(36, labelStr.length * 6.4 + 14);
          const arrowPts = computeArrowPoints(ex, ey, c2x, c2y);
          return {
            key: `${t.from}->${t.to}-${idx}`,
            from: t.from,
            to: t.to,
            isSelfLoop: true,
            pathD,
            arrowPts,
            labelX,
            labelY,
            labelStr,
            pillW,
          };
        }

        const pairKey = [t.from, t.to].sort().join('--');
        const hasReverse = (pairCounts.get(pairKey) || 0) > 1;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = -dy / dist;
        const ny = dx / dist;

        const curveOffset = hasReverse ? 42 : 18;
        const midX = (p1.x + p2.x) / 2 + nx * curveOffset;
        const midY = (p1.y + p2.y) / 2 + ny * curveOffset;

        const startPt = getRectBorderPoint(p1.x, p1.y, FSM_CARD_WIDTH, h1, midX, midY, 2);
        const endPt = getRectBorderPoint(p2.x, p2.y, FSM_CARD_WIDTH, h2, midX, midY, 6);

        const pathD = `M ${startPt.x} ${startPt.y} Q ${midX} ${midY} ${endPt.x} ${endPt.y}`;
        const labelX = 0.25 * startPt.x + 0.5 * midX + 0.25 * endPt.x;
        const labelY = 0.25 * startPt.y + 0.5 * midY + 0.25 * endPt.y;

        const labelStr =
          t.guard === '1'
            ? '1 (always)'
            : t.guard.length > 26
            ? t.guard.slice(0, 24) + '…'
            : t.guard;
        const pillW = Math.max(42, labelStr.length * 6.4 + 14);
        const arrowPts = computeArrowPoints(endPt.x, endPt.y, midX, midY);

        return {
          key: `${t.from}->${t.to}-${idx}`,
          from: t.from,
          to: t.to,
          isSelfLoop: false,
          pathD,
          arrowPts,
          labelX,
          labelY,
          labelStr,
          pillW,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [fsm.transitions, fsm.states, positions, pairCounts]);

  const initMarker = useMemo(() => {
    if (fsm.states.length === 0) return null;
    const first = fsm.states[0];
    const p = positions[first.name];
    if (!p) return null;
    const h = getFsmCardHeight(first, false);
    const targetX = p.x - FSM_CARD_WIDTH / 2 - 4;
    const targetY = p.y - h / 2 + 16;
    const startX = targetX - 34;
    const startY = targetY - 18;
    return {
      startX,
      startY,
      linePts: [startX, startY, targetX, targetY],
      arrowPts: computeArrowPoints(targetX, targetY, startX, startY),
    };
  }, [fsm.states, positions]);

  const headerLinePts = useMemo(() => [0, headerH, width, headerH], [width, headerH]);

  const titleText =
    node.properties?.label ||
    (fsm.deviceName ? `FSM State Machine — ${fsm.deviceName}` : 'FSM State Machine');

  const statusText = liveStatus.currentStateName
    ? `● ACTIVE: ${liveStatus.currentStateName} (${liveStatus.currentStateCode})${
        liveStatus.nextStateName ? `  →  NEXT: ${liveStatus.nextStateName}` : ''
      }`
    : '';

  return (
    <SchematicNodeWrapper node={node}>
      {/* Background Card Body */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill={isDark ? palette.cardBgDark : palette.cardBgLight}
        opacity={0.92}
        stroke={isSelected ? canvasTheme.selectedNodeColor : palette.stroke}
        strokeWidth={isSelected ? 2.5 : 1.5}
        cornerRadius={8}
        perfectDrawEnabled={false}
      />

      {/* Sticky-Note Header Strip */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={headerH}
        fill={isDark ? palette.headerBgDark : palette.headerBgLight}
        cornerRadius={FSM_HEADER_CORNER_RADIUS}
        listening={false}
        perfectDrawEnabled={false}
      />

      <Line
        points={headerLinePts}
        stroke={palette.stroke}
        strokeWidth={1}
        opacity={0.5}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Header Title */}
      <Text
        text={titleText}
        x={12}
        y={7}
        width={Math.max(40, width - (statusText ? 220 : 24))}
        fontSize={12}
        fontStyle="bold"
        fontFamily="sans-serif"
        fill={isDark ? palette.textDark : palette.textLight}
        wrap="none"
        ellipsis={true}
        listening={false}
        perfectDrawEnabled={false}
      />

      {/* Live Status Indicator in Header */}
      {!isLowDetail && statusText && width > 320 && (
        <Text
          text={statusText}
          x={width - 215}
          y={8}
          width={203}
          align="right"
          fontSize={10}
          fontStyle="bold"
          fontFamily="monospace"
          fill={isDark ? '#34d399' : '#047857'}
          wrap="none"
          ellipsis={true}
          listening={false}
          perfectDrawEnabled={false}
        />
      )}

      {/* Purely Informative Clipped Diagram Interior */}
      <Group
        clipX={2}
        clipY={headerH + 1}
        clipWidth={Math.max(10, width - 4)}
        clipHeight={Math.max(10, height - headerH - 3)}
        listening={false}
      >
        {!fsm.hasFsm ? (
          <Text
            text={
              galNode
                ? fsm.reason || 'No FSM state machine found in GAL22V10 equations.'
                : 'No GAL22V10 chip found on schematic.'
            }
            x={20}
            y={headerH + Math.max(20, (height - headerH) / 2 - 10)}
            width={Math.max(40, width - 40)}
            align="center"
            fontSize={12}
            fontFamily="sans-serif"
            fill={isDark ? '#94a3b8' : '#64748b'}
            listening={false}
            perfectDrawEnabled={false}
          />
        ) : (
          <Group
            x={layoutFit.offsetX}
            y={layoutFit.offsetY}
            scaleX={layoutFit.scale}
            scaleY={layoutFit.scale}
            listening={false}
          >
            {/* Transitions */}
            {precomputedTransitions.map(t => {
              const isLiveTransition =
                liveStatus.currentStateName === t.from && liveStatus.nextStateName === t.to;

              const strokeColor = isLiveTransition
                ? '#10b981'
                : isDark
                ? '#64748b'
                : '#94a3b8';
              const strokeWidth = isLiveTransition ? 2.6 : 1.6;

              if (t.isSelfLoop) {
                return (
                  <Group key={t.key}>
                    <Path
                      data={t.pathD}
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      dash={SELF_LOOP_DASH}
                      perfectDrawEnabled={false}
                    />
                    <Line
                      points={t.arrowPts}
                      fill={strokeColor}
                      closed={true}
                      perfectDrawEnabled={false}
                    />
                    {!isLowDetail && (
                      <>
                        <Rect
                          x={t.labelX - t.pillW / 2}
                          y={t.labelY - 10}
                          width={t.pillW}
                          height={19}
                          cornerRadius={5}
                          fill={isDark ? '#0f172a' : '#ffffff'}
                          stroke={isLiveTransition ? '#10b981' : isDark ? '#334155' : '#cbd5e1'}
                          strokeWidth={1}
                          perfectDrawEnabled={false}
                        />
                        <Text
                          text={t.labelStr}
                          x={t.labelX - t.pillW / 2}
                          y={t.labelY - 5}
                          width={t.pillW}
                          align="center"
                          fontSize={9.5}
                          fontFamily="monospace"
                          fontStyle={isLiveTransition ? 'bold' : 'normal'}
                          fill={
                            isLiveTransition
                              ? isDark
                                ? '#34d399'
                                : '#047857'
                              : isDark
                              ? '#94a3b8'
                              : '#475569'
                          }
                          perfectDrawEnabled={false}
                        />
                      </>
                    )}
                  </Group>
                );
              }

              return (
                <Group key={t.key}>
                  <Path
                    data={t.pathD}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    perfectDrawEnabled={false}
                  />
                  <Line
                    points={t.arrowPts}
                    fill={strokeColor}
                    closed={true}
                    perfectDrawEnabled={false}
                  />
                  {!isLowDetail && (
                    <>
                      <Rect
                        x={t.labelX - t.pillW / 2}
                        y={t.labelY - 10}
                        width={t.pillW}
                        height={19}
                        cornerRadius={5}
                        fill={
                          isLiveTransition
                            ? isDark
                              ? '#064e3b'
                              : '#ecfdf5'
                            : isDark
                            ? '#0f172a'
                            : '#ffffff'
                        }
                        stroke={isLiveTransition ? '#10b981' : isDark ? '#334155' : '#cbd5e1'}
                        strokeWidth={isLiveTransition ? 1.5 : 1}
                        perfectDrawEnabled={false}
                      />
                      <Text
                        text={t.labelStr}
                        x={t.labelX - t.pillW / 2}
                        y={t.labelY - 5}
                        width={t.pillW}
                        align="center"
                        fontSize={9.5}
                        fontFamily="monospace"
                        fontStyle="bold"
                        fill={
                          isLiveTransition
                            ? isDark
                              ? '#34d399'
                              : '#047857'
                            : isDark
                            ? '#cbd5e1'
                            : '#334155'
                        }
                        perfectDrawEnabled={false}
                      />
                    </>
                  )}
                </Group>
              );
            })}

            {/* Initial State Reset Marker */}
            {initMarker && (
              <Group>
                <Circle
                  x={initMarker.startX}
                  y={initMarker.startY}
                  radius={5.5}
                  fill={isDark ? '#94a3b8' : '#475569'}
                  perfectDrawEnabled={false}
                />
                <Line
                  points={initMarker.linePts}
                  stroke={isDark ? '#94a3b8' : '#475569'}
                  strokeWidth={2}
                  perfectDrawEnabled={false}
                />
                <Line
                  points={initMarker.arrowPts}
                  fill={isDark ? '#94a3b8' : '#475569'}
                  closed={true}
                  perfectDrawEnabled={false}
                />
              </Group>
            )}

            {/* UML State Nodes */}
            {fsm.states.map(st => {
              const pos = positions[st.name];
              if (!pos) return null;

              const cardH = getFsmCardHeight(st, false);
              const cardX = pos.x - FSM_CARD_WIDTH / 2;
              const cardY = pos.y - cardH / 2;
              const isCurrent = liveStatus.currentStateName === st.name;
              const isNext =
                liveStatus.nextStateName === st.name && liveStatus.currentStateName !== st.name;

              const visibleOutputs = st.outputs.filter(o => o.isActive || o.differsFromDefault);

              const cardStroke = isCurrent
                ? '#10b981'
                : isNext
                ? '#f59e0b'
                : isDark
                ? '#475569'
                : '#cbd5e1';

              const cardHeaderBg = isCurrent
                ? isDark
                  ? '#064e3b'
                  : '#d1fae5'
                : isDark
                ? '#1e293b'
                : '#f1f5f9';

              return (
                <Group key={st.name} x={cardX} y={cardY}>
                  {/* Active Glow Ring */}
                  {isCurrent && (
                    <Rect
                      x={-4}
                      y={-4}
                      width={FSM_CARD_WIDTH + 8}
                      height={cardH + 8}
                      cornerRadius={14}
                      fill="rgba(16, 185, 129, 0.16)"
                      perfectDrawEnabled={false}
                    />
                  )}

                  {/* State Card Frame */}
                  <Rect
                    x={0}
                    y={0}
                    width={FSM_CARD_WIDTH}
                    height={cardH}
                    cornerRadius={10}
                    fill={isDark ? '#0f172a' : '#ffffff'}
                    stroke={cardStroke}
                    strokeWidth={isCurrent ? 2.5 : 1.5}
                    dash={isNext ? NEXT_STATE_DASH : undefined}
                    perfectDrawEnabled={false}
                  />

                  {/* State Card Header */}
                  <Rect
                    x={0}
                    y={0}
                    width={FSM_CARD_WIDTH}
                    height={32}
                    cornerRadius={FSM_CARD_HEADER_CORNER_RADIUS}
                    fill={cardHeaderBg}
                    perfectDrawEnabled={false}
                  />

                  <Line
                    points={FSM_CARD_DIVIDER_POINTS}
                    stroke={cardStroke}
                    strokeWidth={1}
                    opacity={0.6}
                    perfectDrawEnabled={false}
                  />

                  {/* Active Dot + State Name */}
                  {isCurrent && (
                    <Circle
                      x={13}
                      y={16}
                      radius={4}
                      fill="#10b981"
                      perfectDrawEnabled={false}
                    />
                  )}
                  <Text
                    text={st.name}
                    x={isCurrent ? 22 : 12}
                    y={9}
                    width={FSM_CARD_WIDTH - 75}
                    fontSize={13}
                    fontStyle="bold"
                    fontFamily="sans-serif"
                    fill={
                      isCurrent
                        ? isDark
                          ? '#34d399'
                          : '#065f46'
                        : isDark
                        ? '#f1f5f9'
                        : '#1e293b'
                    }
                    wrap="none"
                    ellipsis={true}
                    perfectDrawEnabled={false}
                  />

                  {/* Bit Encoding Badge & Output Compartment Rows (hidden at zoom-out to save fillText calls) */}
                  {!isLowDetail && (
                    <>
                      <Rect
                        x={FSM_CARD_WIDTH - 48}
                        y={7}
                        width={38}
                        height={18}
                        cornerRadius={4}
                        fill={isDark ? '#090d16' : '#ffffff'}
                        stroke={isDark ? '#334155' : '#cbd5e1'}
                        strokeWidth={1}
                        perfectDrawEnabled={false}
                      />
                      <Text
                        text={st.code}
                        x={FSM_CARD_WIDTH - 48}
                        y={11}
                        width={38}
                        align="center"
                        fontSize={10}
                        fontFamily="monospace"
                        fill={isDark ? '#94a3b8' : '#64748b'}
                        perfectDrawEnabled={false}
                      />

                      {visibleOutputs.length === 0 ? (
                        <Text
                          text="all outputs = 0"
                          x={12}
                          y={42}
                          width={FSM_CARD_WIDTH - 24}
                          fontSize={10.5}
                          fontStyle="italic"
                          fontFamily="sans-serif"
                          fill={isDark ? '#64748b' : '#94a3b8'}
                          perfectDrawEnabled={false}
                        />
                      ) : (
                        visibleOutputs.map((out, rIdx) => {
                          const rowY = 40 + rIdx * 22;
                          const valColor =
                            out.value === '1'
                              ? isDark
                                ? '#34d399'
                                : '#047857'
                              : out.value === '0'
                              ? isDark
                                ? '#fb7185'
                                : '#be123c'
                              : isDark
                              ? '#fbbf24'
                              : '#b45309';
                          return (
                            <Group key={out.name} y={rowY}>
                              <Text
                                text={out.name}
                                x={12}
                                y={2}
                                width={FSM_CARD_WIDTH - 76}
                                fontSize={11}
                                fontStyle="bold"
                                fontFamily="monospace"
                                fill={isDark ? '#cbd5e1' : '#334155'}
                                wrap="none"
                                ellipsis={true}
                                perfectDrawEnabled={false}
                              />
                              <Text
                                text={`= ${out.value}`}
                                x={FSM_CARD_WIDTH - 64}
                                y={2}
                                width={52}
                                align="right"
                                fontSize={10.5}
                                fontStyle="bold"
                                fontFamily="monospace"
                                fill={valColor}
                                wrap="none"
                                ellipsis={true}
                                perfectDrawEnabled={false}
                              />
                            </Group>
                          );
                        })
                      )}
                    </>
                  )}
                </Group>
              );
            })}
          </Group>
        )}
      </Group>

      {isSelected && !isPlacing && (
        <ResizeHandles
          node={node}
          width={width}
          height={height}
          minW={260}
          minH={200}
          accentColor={canvasTheme.selectedNodeColor}
        />
      )}
    </SchematicNodeWrapper>
  );
});

