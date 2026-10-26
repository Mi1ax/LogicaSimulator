use super::{inp, inp_or};
use crate::engine::types::{CompiledNode, NodeKind, SIG_HIGH, SIG_LOW, SIG_Z};

pub fn eval_basic(
    cn: &CompiledNode,
    inputs: &[u8],
    tick_count: u64,
    out: &mut Vec<u8>,
) {
    match cn.kind {
        NodeKind::Input => {
            out.push(cn.value.unwrap_or(SIG_LOW));
        }
        NodeKind::SubIn => {
            if cn.is_flattened {
                out.push(SIG_Z);
            } else {
                out.push(cn.value.unwrap_or(SIG_LOW));
            }
        }
        NodeKind::SubIo => {
            if cn.is_flattened {
                out.push(SIG_Z);
            } else {
                out.push(cn.value.unwrap_or(SIG_Z));
            }
        }
        NodeKind::Vcc | NodeKind::PullUp => {
            out.push(SIG_HIGH);
        }
        NodeKind::Gnd | NodeKind::PullDown => {
            out.push(SIG_LOW);
        }
        NodeKind::Button => {
            if cn.active_low {
                out.push(if cn.pressed { SIG_LOW } else { SIG_HIGH });
            } else {
                out.push(if cn.pressed { SIG_HIGH } else { SIG_LOW });
            }
        }
        NodeKind::DipSwitch => {
            let count = cn.num_outputs_prop.max(cn.output_pin_indices.len());
            for i in 0..count {
                out.push(if cn.switches.get(i).copied() == Some(SIG_HIGH) {
                    SIG_HIGH
                } else {
                    SIG_LOW
                });
            }
        }
        NodeKind::Clock => {
            if !inputs.is_empty() {
                let en = if inputs.len() == 1 {
                    inp_or(inputs, 0, SIG_HIGH)
                } else {
                    inp_or(inputs, 1, SIG_HIGH)
                };
                if en == SIG_LOW {
                    out.push(SIG_LOW);
                    return;
                }
            }
            if cn.clock_manual {
                out.push(cn.manual_value);
            } else {
                let period = cn.high_ticks + cn.low_ticks;
                if period == 0 {
                    out.push(SIG_LOW);
                } else {
                    let phase = tick_count % period;
                    let is_high = if cn.start_high {
                        phase < cn.high_ticks
                    } else {
                        phase >= cn.low_ticks
                    };
                    out.push(if is_high { SIG_HIGH } else { SIG_LOW });
                }
            }
        }
        NodeKind::Buffer => {
            let v = inp(inputs, 0);
            out.push(if v == SIG_Z {
                SIG_Z
            } else if v == SIG_HIGH {
                SIG_HIGH
            } else {
                SIG_LOW
            });
        }
        NodeKind::Not => {
            let v = inp(inputs, 0);
            out.push(if v == SIG_Z {
                SIG_Z
            } else if v == SIG_HIGH {
                SIG_LOW
            } else {
                SIG_HIGH
            });
        }
        NodeKind::And => {
            let mut all_one = true;
            for &v in inputs {
                if v == SIG_Z {
                    out.push(SIG_Z);
                    return;
                }
                if v != SIG_HIGH {
                    all_one = false;
                }
            }
            out.push(if all_one { SIG_HIGH } else { SIG_LOW });
        }
        NodeKind::Nand => {
            let mut all_one = true;
            for &v in inputs {
                if v == SIG_Z {
                    out.push(SIG_Z);
                    return;
                }
                if v != SIG_HIGH {
                    all_one = false;
                }
            }
            out.push(if all_one { SIG_LOW } else { SIG_HIGH });
        }
        NodeKind::Or => {
            let mut has_one = false;
            for &v in inputs {
                if v == SIG_Z {
                    out.push(SIG_Z);
                    return;
                }
                if v == SIG_HIGH {
                    has_one = true;
                }
            }
            out.push(if has_one { SIG_HIGH } else { SIG_LOW });
        }
        NodeKind::Nor => {
            let mut all_zero = true;
            for &v in inputs {
                if v == SIG_Z {
                    out.push(SIG_Z);
                    return;
                }
                if v != SIG_LOW {
                    all_zero = false;
                }
            }
            out.push(if all_zero { SIG_HIGH } else { SIG_LOW });
        }
        NodeKind::Xor => {
            let mut count = 0;
            for &v in inputs {
                if v == SIG_Z {
                    out.push(SIG_Z);
                    return;
                }
                if v == SIG_HIGH {
                    count += 1;
                }
            }
            out.push(if (count & 1) == 1 { SIG_HIGH } else { SIG_LOW });
        }
        NodeKind::Xnor => {
            let mut count = 0;
            for &v in inputs {
                if v == SIG_Z {
                    out.push(SIG_Z);
                    return;
                }
                if v == SIG_HIGH {
                    count += 1;
                }
            }
            out.push(if (count & 1) == 1 { SIG_LOW } else { SIG_HIGH });
        }
        _ => {}
    }
}
