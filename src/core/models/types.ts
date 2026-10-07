export type BuiltinNodeType = 'AND' | 'OR' | 'NOR' | 'NOT' | 'XOR' | 'INPUT' | 'OUTPUT' | 'CLOCK' | 'VCC' | 'GND' | 'NET_LABEL';
// Allows IDE autocomplete for built-ins, but accepts ANY string for custom ICs
export type NodeType = BuiltinNodeType | (string & {});
export type Signal = 0 | 1 | undefined | 'X';

export interface Pin {
  id: string;
  nodeId: string;
  type: 'input' | 'output' | 'bidir';
  index: number;
  name?: string;
  pinNumber?: number;
}

export interface Wire {
  id: string;
  sourceNodeId: string;
  sourcePinId: string;
  targetNodeId: string;
  targetPinId: string;
  waypoints?: { x: number; y: number }[];
  wireType?: 'solder' | 'jumper'; // board mode routing type
}

export interface BoardTrace {
  id: string;
  type: 'solder' | 'jumper';
  points: { x: number; y: number }[];
}

export interface DraftWire {
  sourceNodeId: string;
  sourcePinId: string;
  sourceType: 'input' | 'output' | 'bidir';
  endX: number;
  endY: number;
  waypoints?: { x: number; y: number }[];
}

export interface LogicNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  boardX?: number;
  boardY?: number;
  inputs: Pin[];
  outputs: Pin[];
  properties?: Record<string, any>;
}
