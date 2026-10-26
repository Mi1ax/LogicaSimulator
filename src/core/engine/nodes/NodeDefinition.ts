export interface PinDefinition {
  name: string;
  type: 'input' | 'output' | 'bidir';
  pinNumber?: number; // Standard IC pin numbering (1..N)
  schematicSide?: 'left' | 'right' | 'top' | 'bottom';
  schematicRow?: number; // Logical index for schematic layout (1-indexed)
  internalNodeId?: string; // For SUBCIRCUIT pins to map to internal nodes
}

export interface NodeDefinition {
  type: string;
  label: string;
  category?: string; // Toolbox category path, e.g. 'Basic Logic' or 'Integrated Circuits/Counters & Timers'
  numInputs: number; // Ignored if customPins is provided
  numOutputs: number; // Ignored if customPins is provided
  defaultProperties?: Record<string, any>;
  tags?: string[];
  renderAs?: 'GATE' | 'DIP' | 'BUS';
  customPins?: PinDefinition[];
  generatePins?: (properties: Record<string, any>) => PinDefinition[];
  variableInputs?: { min: number; max: number; label?: string };
  variableOutputs?: { min: number; max: number; label?: string };
  memorySize?: number; // Byte size for memory chips (enables Hex Editor view)
  disableTransform?: boolean; // Disables rotation and flip (e.g. for JUNCTION, NC)
}
