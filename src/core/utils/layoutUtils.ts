import { Pin } from '../models/types';
import { getNodeDefinition } from '../engine/nodes';

export const getSafePinNumber = (nodeType: string, pin: Pick<Pin, 'name' | 'type' | 'pinNumber'>): number | undefined => {
  if (pin.pinNumber !== undefined) return pin.pinNumber;
  const def = getNodeDefinition(nodeType);
  if (def?.customPins) {
    const cp = def.customPins.find(c => c.name === pin.name && c.type === pin.type);
    return cp?.pinNumber;
  }
  return undefined;
};
