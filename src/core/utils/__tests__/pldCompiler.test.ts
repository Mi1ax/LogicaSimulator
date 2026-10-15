import { describe, it, expect } from 'vitest';
import { compilePldToJedec } from '../pldCompiler';
import { IC_GAL22V10 } from '../../engine/nodes/ics/pld';
import { Signal } from '../../models/types';

/**
 * Helper to create a 24-pin input array for IC_GAL22V10.evaluate
 * Index 0 = Pin 1, Index 1..10 = Pins 2..11, Index 11 = Pin 12 (GND),
 * Index 12 = Pin 13, Index 13..22 = Pins 14..23 (IO14..IO23), Index 23 = Pin 24 (VCC)
 */
function makeGalInputs(pinValues: Record<number, Signal>): Signal[] {
  const inputs: Signal[] = new Array(24).fill(0);
  inputs[11] = 0; // Pin 12 GND
  inputs[23] = 1; // Pin 24 VCC
  for (const [pinStr, val] of Object.entries(pinValues)) {
    const pin = parseInt(pinStr, 10);
    if (pin >= 1 && pin <= 24) {
      inputs[pin - 1] = val;
    }
  }
  return inputs;
}

/**
 * Helper to read output of an OLMC pin (14..23) from IC_GAL22V10.evaluate result.
 * outputs[0] is IO14 (Pin 14) .. outputs[9] is IO23 (Pin 23).
 */
function getOlmcOutput(outputs: Signal[], pin: number): Signal {
  return outputs[pin - 14];
}

describe('WinCUPL .pld to GAL22V10 JEDEC Compiler', () => {
  it('compiles combinatorial AND, OR, XOR, and active-low pins and simulates accurately in GAL22V10', () => {
    const pld = `
      Name     CombTest;
      Device   g22v10;

      PIN 2 = A;
      PIN 3 = B;
      PIN 4 = !CS;

      PIN 14 = Y_AND;
      PIN 15 = Y_OR;
      PIN 16 = Y_XOR;
      PIN 17 = !Y_NAND_LOW;

      Y_AND = A & B;
      Y_OR  = A # B;
      Y_XOR = A $ B;
      Y_NAND_LOW = CS & A & B;
    `;

    const res = compilePldToJedec(pld);
    expect(res.success).toBe(true);
    expect(res.errors).toHaveLength(0);

    const state: Record<string, any> = {};
    const props = { jedecString: res.jedec };

    // Case 1: A=0, B=0, Pin4(CS)=1 (so active-low CS is FALSE=0)
    let out = IC_GAL22V10.evaluate(makeGalInputs({ 2: 0, 3: 0, 4: 1 }), props, 0, state);
    expect(getOlmcOutput(out, 14)).toBe(0); // 0 & 0 = 0
    expect(getOlmcOutput(out, 15)).toBe(0); // 0 | 0 = 0
    expect(getOlmcOutput(out, 16)).toBe(0); // 0 ^ 0 = 0
    expect(getOlmcOutput(out, 17)).toBe(1); // active-low output: false -> 1

    // Case 2: A=1, B=0, Pin4(CS)=0 (CS is TRUE=1)
    out = IC_GAL22V10.evaluate(makeGalInputs({ 2: 1, 3: 0, 4: 0 }), props, 1, state);
    expect(getOlmcOutput(out, 14)).toBe(0); // 1 & 0 = 0
    expect(getOlmcOutput(out, 15)).toBe(1); // 1 | 0 = 1
    expect(getOlmcOutput(out, 16)).toBe(1); // 1 ^ 0 = 1
    expect(getOlmcOutput(out, 17)).toBe(1); // CS & A & B is 0 -> active-low is 1

    // Case 3: A=1, B=1, Pin4(CS)=0 (CS is TRUE=1)
    out = IC_GAL22V10.evaluate(makeGalInputs({ 2: 1, 3: 1, 4: 0 }), props, 2, state);
    expect(getOlmcOutput(out, 14)).toBe(1); // 1 & 1 = 1
    expect(getOlmcOutput(out, 15)).toBe(1); // 1 | 1 = 1
    expect(getOlmcOutput(out, 16)).toBe(0); // 1 ^ 1 = 0
    expect(getOlmcOutput(out, 17)).toBe(0); // CS & A & B is 1 -> active-low is 0
  });

  it('compiles registered (.d) counter with asynchronous reset (.ar) and simulates clock edges', () => {
    const pld = `
      Name     Counter2Bit;
      Device   g22v10;

      PIN 1 = CLK;
      PIN 2 = RST;
      PIN 14 = Q0;
      PIN 15 = Q1;

      Q0.ar = RST;
      Q1.ar = RST;

      Q0.d = !Q0;
      Q1.d = Q1 $ Q0;
    `;

    const res = compilePldToJedec(pld);
    expect(res.success).toBe(true);

    const state: Record<string, any> = {};
    const props = { jedecString: res.jedec };

    // Initial state: CLK=0, RST=0 -> Q1=0, Q0=0
    let out = IC_GAL22V10.evaluate(makeGalInputs({ 1: 0, 2: 0 }), props, 0, state);
    expect(getOlmcOutput(out, 14)).toBe(0);
    expect(getOlmcOutput(out, 15)).toBe(0);

    // Helper to pulse clock (rising edge on Pin 1) keeping feedback on Pins 14 & 15
    const stepClock = (clk: Signal, rst: Signal = 0) => {
      out = IC_GAL22V10.evaluate(
        makeGalInputs({
          1: clk,
          2: rst,
          14: out ? getOlmcOutput(out, 14) : 0,
          15: out ? getOlmcOutput(out, 15) : 0,
        }),
        props,
        0,
        state
      );
      return [getOlmcOutput(out, 15), getOlmcOutput(out, 14)];
    };

    // Pulse 1: 00 -> 01
    expect(stepClock(1)).toEqual([0, 1]);
    stepClock(0);

    // Pulse 2: 01 -> 10
    expect(stepClock(1)).toEqual([1, 0]);
    stepClock(0);

    // Pulse 3: 10 -> 11
    expect(stepClock(1)).toEqual([1, 1]);
    stepClock(0);

    // Async Reset (RST=1 without clock edge): 11 -> 00
    expect(stepClock(0, 1)).toEqual([0, 0]);
  });

  it('supports .oe tri-state output enable equations', () => {
    const pld = `
      Name     TriStateTest;
      Device   g22v10;

      PIN 2 = EN;
      PIN 3 = D0;
      PIN 14 = Y0;

      Y0 = D0;
      Y0.oe = EN;
    `;

    const res = compilePldToJedec(pld);
    expect(res.success).toBe(true);

    const state: Record<string, any> = {};
    const props = { jedecString: res.jedec };

    // When EN=0, output is High-Z (undefined)
    let out = IC_GAL22V10.evaluate(makeGalInputs({ 2: 0, 3: 1 }), props, 0, state);
    expect(getOlmcOutput(out, 14)).toBeUndefined();

    // When EN=1, output follows D0
    out = IC_GAL22V10.evaluate(makeGalInputs({ 2: 1, 3: 1 }), props, 1, state);
    expect(getOlmcOutput(out, 14)).toBe(1);
  });

  it('supports empty header fields (e.g. Location ;) and digit-leading pin names (16ms, 2Sec, 2Sec_Load)', () => {
    const pld = `
      Name     TimerFSM;
      PartNo   00;
      Date     15/10/2026;
      Revision 01;
      Designer Engineer;
      Company  University;
      Assembly None;
      Location ;
      Device   g22v10;

      PIN 6 = 16ms;
      PIN 7 = 2Sec;
      PIN 8 = S4;
      PIN 9 = S5;
      PIN 14 = 2Sec_Load;
      PIN 15 = 2Sec_Enable;

      !2Sec_Load = S4;
      2Sec_Enable = S4 # S5 # (16ms & 2Sec);
    `;

    const res = compilePldToJedec(pld);
    expect(res.errors).toEqual([]);
    expect(res.success).toBe(true);

    const state: Record<string, any> = {};
    const props = { jedecString: res.jedec };

    // S4 = 1 -> !2Sec_Load is true so Pin 14 is 0 (active-low), 2Sec_Enable (Pin 15) is 1
    const out1 = IC_GAL22V10.evaluate(makeGalInputs({ 6: 0, 7: 0, 8: 1, 9: 0 }), props, 0, state);
    expect(getOlmcOutput(out1, 14)).toBe(0);
    expect(getOlmcOutput(out1, 15)).toBe(1);

    // S4 = 0, S5 = 0, 16ms = 1, 2Sec = 1 -> Pin 14 is 1, Pin 15 is 1
    const out2 = IC_GAL22V10.evaluate(makeGalInputs({ 6: 1, 7: 1, 8: 0, 9: 0 }), props, 1, state);
    expect(getOlmcOutput(out2, 14)).toBe(1);
    expect(getOlmcOutput(out2, 15)).toBe(1);
  });
});
