import { Signal } from '../../models/types';

export interface PinDefinition {
  name: string;
  type: 'input' | 'output';
  pinNumber?: number; // Standard IC pin numbering (1..N)
}

export interface NodeDefinition {
  type: string;
  label: string;
  numInputs: number; // Ignored if customPins is provided
  numOutputs: number; // Ignored if customPins is provided
  defaultProperties?: Record<string, any>;
  renderAs?: 'GATE' | 'DIP';
  customPins?: PinDefinition[];
  /**
   * Evaluates the node logic.
   * @param inputs Array of signals corresponding to the input pins (ordered by index)
   * @param properties Custom properties for the node (e.g., clock interval, input value)
   * @param tickCount The current simulation tick count
   * @returns Array of signals for the output pins (ordered by index)
   */
  evaluate: (inputs: Signal[], properties?: Record<string, any>, tickCount?: number) => Signal[];
}
