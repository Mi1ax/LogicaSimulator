export type NodeType = 'AND' | 'OR' | 'NOT' | 'INPUT' | 'OUTPUT' | 'CLOCK';
export type Signal = 0 | 1 | undefined;

export interface Pin {
  id: string;
  nodeId: string;
  type: 'input' | 'output';
  index: number;
}

export interface Wire {
  id: string;
  sourceNodeId: string;
  sourcePinId: string;
  targetNodeId: string;
  targetPinId: string;
  midX?: number;
}

export interface DraftWire {
  sourceNodeId: string;
  sourcePinId: string;
  sourceType: 'input' | 'output';
  endX: number;
  endY: number;
}

export interface LogicNode {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  inputs: Pin[];
  outputs: Pin[];
  properties?: Record<string, any>;
}
