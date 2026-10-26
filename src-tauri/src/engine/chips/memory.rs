use super::{inp, inp_or};
use crate::engine::types::{CompiledNode, NodeKind, SIG_HIGH, SIG_LOW, SIG_X, SIG_Z};

pub fn eval_memory(cn: &mut CompiledNode, inputs: &[u8], out: &mut Vec<u8>) {
    match cn.kind {
        NodeKind::Rom27C256 => {
            // inputs[16] = /CE, inputs[17] = /OE
            let ce_l = inp_or(inputs, 16, SIG_LOW);
            let oe_l = inp_or(inputs, 17, SIG_LOW);
            if ce_l != SIG_LOW || oe_l != SIG_LOW {
                out.resize(8, SIG_Z);
            } else {
                let mut addr = 0usize;
                for i in 0..15 {
                    let v = inp(inputs, i);
                    if v == SIG_X {
                        out.resize(8, SIG_Z);
                        return;
                    }
                    if v == SIG_HIGH {
                        addr |= 1 << i;
                    }
                }
                let byte = cn.rom_data.get(addr).copied().unwrap_or(0);
                for i in 0..8 {
                    out.push(if (byte & (1 << i)) != 0 {
                        SIG_HIGH
                    } else {
                        SIG_LOW
                    });
                }
            }
        }
        NodeKind::Sram62256 => {
            // inputs: 0..14=A0..A14, 15..22=D0..D7, 23=/CE, 24=/OE, 25=/WE
            let ce_l = inp_or(inputs, 23, SIG_LOW);
            let oe_l = inp_or(inputs, 24, SIG_LOW);
            let we_l = inp_or(inputs, 25, SIG_HIGH);

            let mut addr = 0isize;
            for i in 0..15 {
                let v = inp(inputs, i);
                if v == SIG_HIGH {
                    addr |= 1 << i;
                } else if v == SIG_X {
                    addr = -1;
                    break;
                }
            }

            if ce_l == SIG_LOW && we_l == SIG_LOW && addr >= 0 {
                let mut data_in = 0u8;
                let mut valid = true;
                for i in 0..8 {
                    let v = inp(inputs, 15 + i);
                    if v == SIG_HIGH {
                        data_in |= 1 << i;
                    } else if v != SIG_LOW {
                        valid = false;
                    }
                }
                if valid && (addr as usize) < cn.sram.len() {
                    cn.sram[addr as usize] = data_in;
                }
            }

            if ce_l == SIG_LOW && oe_l == SIG_LOW && we_l != SIG_LOW {
                if addr < 0 {
                    out.resize(8, SIG_Z);
                } else {
                    let byte = cn.sram.get(addr as usize).copied().unwrap_or(0);
                    for i in 0..8 {
                        out.push(if (byte & (1 << i)) != 0 {
                            SIG_HIGH
                        } else {
                            SIG_LOW
                        });
                    }
                }
            } else {
                out.resize(8, SIG_Z);
            }
        }
        NodeKind::Sram6116 => {
            let decode_addr = |inp_slice: &[u8]| -> usize {
                let mut a = 0usize;
                if inp(inp_slice, 7) == SIG_HIGH { a |= 1; }
                if inp(inp_slice, 6) == SIG_HIGH { a |= 2; }
                if inp(inp_slice, 5) == SIG_HIGH { a |= 4; }
                if inp(inp_slice, 4) == SIG_HIGH { a |= 8; }
                if inp(inp_slice, 3) == SIG_HIGH { a |= 16; }
                if inp(inp_slice, 2) == SIG_HIGH { a |= 32; }
                if inp(inp_slice, 1) == SIG_HIGH { a |= 64; }
                if inp(inp_slice, 0) == SIG_HIGH { a |= 128; }
                if inp(inp_slice, 22) == SIG_HIGH { a |= 256; }
                if inp(inp_slice, 21) == SIG_HIGH { a |= 512; }
                if inp(inp_slice, 18) == SIG_HIGH { a |= 1024; }
                a
            };

            let p_inputs: &[u8] = if cn.prev_inputs.is_empty() {
                inputs
            } else {
                &cn.prev_inputs
            };
            let p_ce_n = inp_or(p_inputs, 17, SIG_HIGH);
            let p_we_n = inp_or(p_inputs, 20, SIG_HIGH);

            if p_ce_n == SIG_LOW && p_we_n == SIG_LOW {
                let p_addr = decode_addr(p_inputs);
                let mut p_data = 0u8;
                if inp(p_inputs, 8) == SIG_HIGH { p_data |= 1; }
                if inp(p_inputs, 9) == SIG_HIGH { p_data |= 2; }
                if inp(p_inputs, 10) == SIG_HIGH { p_data |= 4; }
                if inp(p_inputs, 12) == SIG_HIGH { p_data |= 8; }
                if inp(p_inputs, 13) == SIG_HIGH { p_data |= 16; }
                if inp(p_inputs, 14) == SIG_HIGH { p_data |= 32; }
                if inp(p_inputs, 15) == SIG_HIGH { p_data |= 64; }
                if inp(p_inputs, 16) == SIG_HIGH { p_data |= 128; }
                if p_addr < cn.sram.len() {
                    cn.sram[p_addr] = p_data;
                }
            }

            let ce_n = inp_or(inputs, 17, SIG_HIGH);
            let oe_n = inp_or(inputs, 19, SIG_HIGH);
            let we_n = inp_or(inputs, 20, SIG_HIGH);

            if ce_n == SIG_LOW && we_n == SIG_HIGH && oe_n == SIG_LOW {
                let addr = decode_addr(inputs);
                let byte = cn.sram.get(addr).copied().unwrap_or(0);
                for i in 0..8 {
                    out.push(if (byte & (1 << i)) != 0 {
                        SIG_HIGH
                    } else {
                        SIG_LOW
                    });
                }
            } else {
                out.resize(8, SIG_Z);
            }
        }
        _ => {}
    }
}
