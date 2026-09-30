import { Signal } from '../../models/types';

export interface NodeDefinition {
  type: string;
  label: string;
  numInputs: number;
  numOutputs: number;
  defaultProperties?: Record<string, any>;
  /**
   * Evaluates the node logic.
   * @param inputs Array of signals corresponding to the input pins (ordered by index)
   * @param properties Custom properties for the node (e.g., clock interval, input value)
   * @param tickCount The current simulation tick count
   * @returns Array of signals for the output pins (ordered by index)
   */
  evaluate: (inputs: Signal[], properties?: Record<string, any>, tickCount?: number) => Signal[];
}
