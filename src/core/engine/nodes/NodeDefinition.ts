import { Signal } from '../../models/types';

export interface PinDefinition {
  name: string;
  type: 'input' | 'output' | 'bidir';
  pinNumber?: number; // Standard IC pin numbering (1..N)
  schematicSide?: 'left' | 'right' | 'top' | 'bottom';
  schematicRow?: number; // Logical index for schematic layout (1-indexed)
}

export interface NodeDefinition {
  type: string;
  label: string;
  numInputs: number; // Ignored if customPins is provided
  numOutputs: number; // Ignored if customPins is provided
  defaultProperties?: Record<string, any>;
  tags?: string[];
  renderAs?: 'GATE' | 'DIP' | 'BUS';
  customPins?: PinDefinition[];
  generatePins?: (properties: Record<string, any>) => PinDefinition[];
  /**
   * Evaluates the node logic.
   * @param inputs Array of signals corresponding to the input pins (ordered by index)
   * @param properties Custom properties for the node (e.g., clock interval, input value)
   * @param tickCount The current simulation tick count
   * @param internal Mutable per-node simulation state (registers, counters, last clock level).
   *   Owned by the simulation (`SimulationState.nodeStates`), so it is cleared on reset and
   *   never leaks into the persisted circuit. Sequential nodes must use this, not `properties`.
   * @returns Array of signals for the output pins (ordered by index)
   */
  evaluate: (inputs: Signal[], properties?: Record<string, any>, tickCount?: number, internal?: Record<string, any>) => Signal[];
}
