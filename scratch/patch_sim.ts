import * as fs from 'fs';

let content = fs.readFileSync('src/core/engine/simulation.ts', 'utf8');

const replacement1 = `
  const wires = [...baseWires, ...virtualWires];

  // --- BUILD NETS ---
  const pinToNet = new Map<string, number>();
  const nets: string[][] = [];

  const union = (pin1: string, pin2: string) => {
    let net1 = pinToNet.get(pin1);
    let net2 = pinToNet.get(pin2);
    if (net1 !== undefined && net2 !== undefined) {
      if (net1 === net2) return;
      nets[net1].push(...nets[net2]);
      for (const p of nets[net2]) {
        pinToNet.set(p, net1);
      }
      nets[net2] = [];
    } else if (net1 !== undefined) {
      nets[net1].push(pin2);
      pinToNet.set(pin2, net1);
    } else if (net2 !== undefined) {
      nets[net2].push(pin1);
      pinToNet.set(pin1, net2);
    } else {
      const newNetIdx = nets.length;
      nets.push([pin1, pin2]);
      pinToNet.set(pin1, newNetIdx);
      pinToNet.set(pin2, newNetIdx);
    }
  };

  wires.forEach(w => union(w.sourcePinId, w.targetPinId));
  nodes.forEach(n => {
    if (n.type === 'JUNCTION') {
      union(n.inputs[0].id, n.outputs[0].id);
    }
  });

  const activeNets = nets.filter(n => n.length > 0);
  
  const outputPins = new Set<string>();
  nodes.forEach(n => {
    n.outputs.forEach(p => outputPins.add(p.id));
  });

  const connectedPins = new Set(activeNets.flat());
  // ------------------

  let currentPinStates: Record<string, Signal> = { ...prevState.pinStates };
`;

content = content.replace(/const wires = \[\.\.\.baseWires, \.\.\.virtualWires\];\n\n  let currentPinStates: Record<string, Signal> = { \.\.\.prevState\.pinStates };/, replacement1.trim());

const replacement2 = `
    // 2. Propagate through wires (Net resolution)
    activeNets.forEach(netPins => {
      let netValue: Signal = undefined;
      let collision = false;

      for (const pinId of netPins) {
        if (outputPins.has(pinId)) {
          let val = nextIterPinStates[pinId];
          if (val === undefined && !(pinId in nextIterPinStates)) {
             val = currentPinStates[pinId];
          }
          
          if (val !== undefined) {
            if (netValue === undefined) {
              netValue = val;
            } else if (netValue !== val) {
              collision = true;
            }
          }
        }
      }

      const finalVal = collision ? 'X' : netValue;
      
      netPins.forEach(pinId => {
        nextIterPinStates[pinId] = finalVal;
      });
    });

    wires.forEach(wire => {
      finalWireStates[wire.id] = nextIterPinStates[wire.sourcePinId];
    });

    // 3. Clear disconnected input pins
    nodes.forEach(node => {
      node.inputs.forEach(pin => {
        if (!connectedPins.has(pin.id) && !outputPins.has(pin.id)) {
          nextIterPinStates[pin.id] = undefined;
        }
      });
    });
`;

const regex2 = /\/\/ 2\. Propagate through wires[\s\S]*?\/\/ 3\. Clear disconnected input pins[\s\S]*?\}\);/m;
content = content.replace(regex2, replacement2.trim());

fs.writeFileSync('src/core/engine/simulation.ts', content);
console.log('Done');
