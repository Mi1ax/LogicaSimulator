use super::{bit, inp, inp_or};
use crate::engine::types::{NodeKind, SIG_HIGH, SIG_LOW, SIG_X, SIG_Z};

pub fn eval_ttl_gate_or_buffer(kind: NodeKind, inputs: &[u8], out: &mut Vec<u8>) {
    match kind {
        NodeKind::Ic74LS08 => {
            // inputs[4] is GND, outputs are [1Y, 2Y, 4Y, 3Y]
            let pairs = [(0, 1), (2, 3), (5, 6), (7, 8)];
            for &(ia, ib) in &pairs {
                let a = inp(inputs, ia);
                let b = inp(inputs, ib);
                if a == SIG_Z || b == SIG_Z {
                    out.push(SIG_Z);
                } else if a == SIG_HIGH && b == SIG_HIGH {
                    out.push(SIG_HIGH);
                } else {
                    out.push(SIG_LOW);
                }
            }
        }
        NodeKind::Ic74LS00 | NodeKind::Ic74LS02 | NodeKind::Ic74LS32 | NodeKind::Ic74LS86 => {
            // inputs[4] is GND, outputs are [1Y, 2Y, 3Y, 4Y]
            let pairs = [(0, 1), (2, 3), (5, 6), (7, 8)];
            for &(ia, ib) in &pairs {
                let a = bit(inputs, ia) == 1;
                let b = bit(inputs, ib) == 1;
                let y = match kind {
                    NodeKind::Ic74LS00 => !(a && b),
                    NodeKind::Ic74LS02 => !(a || b),
                    NodeKind::Ic74LS32 => a || b,
                    _ => a ^ b,
                };
                out.push(if y { SIG_HIGH } else { SIG_LOW });
            }
        }
        NodeKind::Ic74LS04 => {
            // inputs[3] is GND
            let indices = [0, 1, 2, 4, 5, 6];
            for &idx in &indices {
                out.push(if bit(inputs, idx) == 1 {
                    SIG_LOW
                } else {
                    SIG_HIGH
                });
            }
        }
        NodeKind::Ic74LS30 => {
            let mut has_x = false;
            for i in 0..8 {
                let v = inp_or(inputs, i, SIG_HIGH);
                if v == SIG_LOW {
                    out.push(SIG_HIGH);
                    return;
                }
                if v == SIG_X {
                    has_x = true;
                }
            }
            out.push(if has_x { SIG_X } else { SIG_LOW });
        }
        NodeKind::Ic74LS125 => {
            // inputs: 0=1G', 1=1A, 2=2G', 3=2A, 4=GND, 5=3A, 6=3G', 7=4A, 8=4G', 9=VCC
            let g1_n = inp_or(inputs, 0, SIG_HIGH);
            let g2_n = inp_or(inputs, 2, SIG_HIGH);
            let g3_n = inp_or(inputs, 6, SIG_HIGH);
            let g4_n = inp_or(inputs, 8, SIG_HIGH);
            out.push(if g1_n == SIG_LOW { inp(inputs, 1) } else { SIG_Z });
            out.push(if g2_n == SIG_LOW { inp(inputs, 3) } else { SIG_Z });
            out.push(if g3_n == SIG_LOW { inp(inputs, 5) } else { SIG_Z });
            out.push(if g4_n == SIG_LOW { inp(inputs, 7) } else { SIG_Z });
        }
        NodeKind::Ic74LS241 => {
            let g1_n = inp_or(inputs, 8, SIG_HIGH);
            let g2 = inp_or(inputs, 9, SIG_LOW);
            for i in 0..4 {
                out.push(if g1_n == SIG_LOW { inp(inputs, i) } else { SIG_Z });
            }
            for i in 4..8 {
                out.push(if g2 == SIG_HIGH { inp(inputs, i) } else { SIG_Z });
            }
        }
        NodeKind::Ic74LS244 => {
            let g1_n = inp_or(inputs, 8, SIG_HIGH);
            let g2_n = inp_or(inputs, 9, SIG_HIGH);
            for i in 0..4 {
                out.push(if g1_n == SIG_LOW { inp(inputs, i) } else { SIG_Z });
            }
            for i in 4..8 {
                out.push(if g2_n == SIG_LOW { inp(inputs, i) } else { SIG_Z });
            }
        }
        NodeKind::Ic74LS245 => {
            let oe_n = if inp(inputs, 18) == SIG_LOW { 0 } else { 1 };
            out.resize(16, SIG_Z);
            if oe_n == 0 {
                let dir = if inp(inputs, 0) == SIG_LOW { 0 } else { 1 };
                if dir == 1 {
                    for i in 0..8 {
                        out[15 - i] = inp(inputs, 1 + i);
                    }
                } else {
                    for i in 0..8 {
                        out[i] = inp(inputs, 17 - i);
                    }
                }
            }
        }
        NodeKind::Ic74LS541 => {
            let oe1_n = inp_or(inputs, 0, SIG_HIGH);
            let oe2_n = inp_or(inputs, 10, SIG_HIGH);
            if oe1_n != SIG_LOW || oe2_n != SIG_LOW {
                out.resize(8, SIG_Z);
            } else {
                for i in (1..=8).rev() {
                    out.push(inp(inputs, i));
                }
            }
        }
        _ => {}
    }
}
