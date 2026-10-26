pub mod basic;
pub mod decoders_alu;
pub mod memory;
pub mod pld;
pub mod sequential;
pub mod ttl_gates;

use super::types::{CompiledNode, NodeInternalState, NodeKind, SIG_HIGH, SIG_LOW, SIG_Z};

#[inline]
pub fn inp(inputs: &[u8], idx: usize) -> u8 {
    inputs.get(idx).copied().unwrap_or(SIG_Z)
}

#[inline]
pub fn inp_or(inputs: &[u8], idx: usize, def: u8) -> u8 {
    let v = inp(inputs, idx);
    if v == SIG_Z {
        def
    } else {
        v
    }
}

#[inline]
pub fn bit(inputs: &[u8], idx: usize) -> usize {
    if inp(inputs, idx) == SIG_HIGH {
        1
    } else {
        0
    }
}

pub fn evaluate_node(
    cn: &mut CompiledNode,
    inputs: &[u8],
    tick_count: u64,
    st: &mut NodeInternalState,
    out: &mut Vec<u8>,
) {
    match cn.kind {
        // Basic I/O, Sources, Switches, Clocks, and Primitive Logic Gates
        NodeKind::Input
        | NodeKind::SubIn
        | NodeKind::SubIo
        | NodeKind::Vcc
        | NodeKind::PullUp
        | NodeKind::Gnd
        | NodeKind::PullDown
        | NodeKind::Button
        | NodeKind::DipSwitch
        | NodeKind::Clock
        | NodeKind::Buffer
        | NodeKind::Not
        | NodeKind::And
        | NodeKind::Nand
        | NodeKind::Or
        | NodeKind::Nor
        | NodeKind::Xor
        | NodeKind::Xnor => basic::eval_basic(cn, inputs, tick_count, out),

        // 74LS Logic Gates & Tri-State Buffers / Transceivers
        NodeKind::Ic74LS00
        | NodeKind::Ic74LS02
        | NodeKind::Ic74LS04
        | NodeKind::Ic74LS08
        | NodeKind::Ic74LS30
        | NodeKind::Ic74LS32
        | NodeKind::Ic74LS86
        | NodeKind::Ic74LS125
        | NodeKind::Ic74LS241
        | NodeKind::Ic74LS244
        | NodeKind::Ic74LS245
        | NodeKind::Ic74LS541 => ttl_gates::eval_ttl_gate_or_buffer(cn.kind, inputs, out),

        // Decoders & Arithmetic Logic Units
        NodeKind::Ic74LS47
        | NodeKind::Ic74LS138
        | NodeKind::Ic74LS139
        | NodeKind::Ic74LS154
        | NodeKind::Ic74LS238
        | NodeKind::Ic74LS283
        | NodeKind::Ic74LS181 => decoders_alu::eval_decoder_or_alu(cn.kind, inputs, out),

        // Counters, Registers & NE555 Timer
        NodeKind::Ic74LS161
        | NodeKind::Ic74LS191
        | NodeKind::Ic74LS173
        | NodeKind::Ic74LS175
        | NodeKind::Ic74LS273
        | NodeKind::Ic74LS373
        | NodeKind::Ic74LS374
        | NodeKind::Ne555 => sequential::eval_sequential(cn, inputs, tick_count, st, out),

        // ROM & SRAM Memory ICs
        NodeKind::Rom27C256 | NodeKind::Sram62256 | NodeKind::Sram6116 => {
            memory::eval_memory(cn, inputs, out)
        }

        // Programmable Logic Devices (GAL22V10)
        NodeKind::Gal22V10 => pld::eval_gal22v10(cn, inputs, st, out),

        NodeKind::Unknown => {
            out.resize(cn.output_pin_indices.len(), SIG_LOW);
        }
    }
}
