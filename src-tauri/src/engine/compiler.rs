use std::collections::HashMap;
use super::chips::pld::compile_jedec;
use super::simulator::RustSimulator;
use super::types::{
    CompiledNet, CompiledNode, Ne555Mode, NodeDto, NodeInternalState, NodeKind, WireDto, SIG_HIGH,
    SIG_LOW, SIG_Z,
};

const PIN_FLAG_OUTPUT: u8 = 1 << 0;
const PIN_FLAG_WEAK: u8 = 1 << 1;
const PIN_FLAG_DYNAMIC_WEAK: u8 = 1 << 2;
const PIN_FLAG_CONNECTED: u8 = 1 << 3;

#[inline]
fn find_root_idx(parent: &mut [usize], mut i: usize) -> usize {
    while parent[i] != i {
        let p = parent[i];
        parent[i] = parent[p];
        i = p;
    }
    i
}

#[inline]
fn union_pin_indices(parent: &mut [usize], a: usize, b: usize) {
    let ra = find_root_idx(parent, a);
    let rb = find_root_idx(parent, b);
    if ra != rb {
        parent[ra] = rb;
    }
}

impl RustSimulator {
    pub fn compile(&mut self, dto_nodes: Vec<NodeDto>, dto_wires: Vec<WireDto>) -> Vec<String> {
        self.compile_with_options(dto_nodes, dto_wires, false)
    }

    pub fn compile_with_options(
        &mut self,
        dto_nodes: Vec<NodeDto>,
        dto_wires: Vec<WireDto>,
        preserve_state: bool,
    ) -> Vec<String> {
        let mut old_node_states: HashMap<String, (NodeInternalState, Vec<u8>, Vec<u8>)> =
            HashMap::new();
        let mut old_pin_signals: HashMap<String, (u8, u8, u8)> = HashMap::new();

        if preserve_state {
            for (nid, idx) in self.node_id_to_idx.drain() {
                if let Some(cn) = self.nodes.get_mut(idx) {
                    old_node_states.insert(
                        nid,
                        (
                            cn.state,
                            std::mem::take(&mut cn.sram),
                            std::mem::take(&mut cn.prev_inputs),
                        ),
                    );
                }
            }
            for (idx, pid) in self.all_pin_ids.drain(..).enumerate() {
                let c = self.cur_buf.get(idx).copied().unwrap_or(SIG_Z);
                let p = self.prev_buf.get(idx).copied().unwrap_or(SIG_Z);
                let d = self.driver_buf.get(idx).copied().unwrap_or(SIG_Z);
                old_pin_signals.insert(pid, (c, p, d));
            }
        } else {
            self.tick_count = 0;
            self.all_pin_ids.clear();
            self.node_id_to_idx.clear();
        }

        self.pin_id_to_idx.clear();
        self.nodes.clear();
        self.nets.clear();
        self.disconnected_input_indices.clear();
        self.tick_root_nodes.clear();
        self.prev_input_nodes.clear();
        self.stateful_nodes.clear();
        self.forced_dirty_nodes.clear();
        self.initial_settled = false;

        let estimated_pins = dto_nodes.len() * 8 + dto_wires.len() * 2;
        let mut uf_parent: Vec<usize> = Vec::with_capacity(estimated_pins);
        let mut pin_flags: Vec<u8> = Vec::with_capacity(estimated_pins);

        let get_or_assign_pin = |pid: &str,
                                 all_pin_ids: &mut Vec<String>,
                                 pin_id_to_idx: &mut HashMap<String, usize>,
                                 uf_parent: &mut Vec<usize>,
                                 pin_flags: &mut Vec<u8>|
         -> usize {
            if let Some(&idx) = pin_id_to_idx.get(pid) {
                idx
            } else {
                let idx = all_pin_ids.len();
                let owned = pid.to_string();
                all_pin_ids.push(owned.clone());
                pin_id_to_idx.insert(owned, idx);
                uf_parent.push(idx);
                pin_flags.push(0);
                idx
            }
        };

        let mut net_labels_by_name: HashMap<String, Vec<usize>> = HashMap::new();

        for n in &dto_nodes {
            for p in &n.inputs {
                let _ = get_or_assign_pin(
                    &p.id,
                    &mut self.all_pin_ids,
                    &mut self.pin_id_to_idx,
                    &mut uf_parent,
                    &mut pin_flags,
                );
            }
            for p in &n.outputs {
                let _ = get_or_assign_pin(
                    &p.id,
                    &mut self.all_pin_ids,
                    &mut self.pin_id_to_idx,
                    &mut uf_parent,
                    &mut pin_flags,
                );
            }

            if n.node_type == "NET_LABEL" {
                if let Some(label) = n.properties.get("label").and_then(|v| v.as_str()) {
                    let name = label.trim();
                    if !name.is_empty() {
                        if let Some(pin) = n.inputs.first() {
                            let idx = self.pin_id_to_idx[&pin.id];
                            net_labels_by_name
                                .entry(name.to_string())
                                .or_default()
                                .push(idx);
                        }
                    }
                }
            } else if n.node_type == "BUS_BREAKOUT" {
                if let Some(label) = n.properties.get("label").and_then(|v| v.as_str()) {
                    let prefix = label.trim();
                    if !prefix.is_empty() {
                        let base_name = prefix.split('[').next().unwrap_or(prefix);
                        for pin in &n.inputs {
                            if !pin.name.is_empty() && pin.name.chars().all(|c| c.is_ascii_digit())
                            {
                                let idx = self.pin_id_to_idx[&pin.id];
                                let net_name = format!("{}[{}]", base_name, pin.name);
                                net_labels_by_name
                                    .entry(net_name)
                                    .or_default()
                                    .push(idx);
                            }
                        }
                    }
                }
            }
        }

        for w in &dto_wires {
            let src_idx = get_or_assign_pin(
                &w.source_pin_id,
                &mut self.all_pin_ids,
                &mut self.pin_id_to_idx,
                &mut uf_parent,
                &mut pin_flags,
            );
            let tgt_idx = get_or_assign_pin(
                &w.target_pin_id,
                &mut self.all_pin_ids,
                &mut self.pin_id_to_idx,
                &mut uf_parent,
                &mut pin_flags,
            );
            union_pin_indices(&mut uf_parent, src_idx, tgt_idx);
        }

        for pins in net_labels_by_name.values() {
            for i in 1..pins.len() {
                union_pin_indices(&mut uf_parent, pins[0], pins[i]);
            }
        }

        for n in &dto_nodes {
            if n.node_type == "JUNCTION" && !n.inputs.is_empty() && !n.outputs.is_empty() {
                let in_idx = self.pin_id_to_idx[&n.inputs[0].id];
                let out_idx = self.pin_id_to_idx[&n.outputs[0].id];
                union_pin_indices(&mut uf_parent, in_idx, out_idx);
            } else if n.node_type == "KEYPAD" && n.inputs.len() >= 7 {
                let pressed_key = n
                    .properties
                    .get("pressedKey")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(-1);
                if (0..12).contains(&pressed_key) {
                    let row = (pressed_key / 3) as usize;
                    let col = (pressed_key % 3) as usize;
                    let r_idx = self.pin_id_to_idx[&n.inputs[row].id];
                    let c_idx = self.pin_id_to_idx[&n.inputs[4 + col].id];
                    union_pin_indices(&mut uf_parent, r_idx, c_idx);
                }
            }
        }

        // Connect bit pins (0..7) of BUS_BREAKOUT nodes whose BUS pins are in the same net
        let bus_breakouts: Vec<&NodeDto> = dto_nodes
            .iter()
            .filter(|n| n.node_type == "BUS_BREAKOUT")
            .collect();
        for i in 0..bus_breakouts.len() {
            let Some(bus_pin_a) = bus_breakouts[i].inputs.iter().find(|p| p.name == "BUS") else {
                continue;
            };
            let idx_a = self.pin_id_to_idx[&bus_pin_a.id];
            let root_a = find_root_idx(&mut uf_parent, idx_a);

            for bus_b in bus_breakouts.iter().skip(i + 1) {
                let Some(bus_pin_b) = bus_b.inputs.iter().find(|p| p.name == "BUS") else {
                    continue;
                };
                let idx_b = self.pin_id_to_idx[&bus_pin_b.id];
                let root_b = find_root_idx(&mut uf_parent, idx_b);
                if root_a == root_b {
                    for pin_a in &bus_breakouts[i].inputs {
                        if !pin_a.name.is_empty()
                            && pin_a.name.chars().all(|c| c.is_ascii_digit())
                        {
                            if let Some(pin_b) =
                                bus_b.inputs.iter().find(|p| p.name == pin_a.name)
                            {
                                let bit_a = self.pin_id_to_idx[&pin_a.id];
                                let bit_b = self.pin_id_to_idx[&pin_b.id];
                                union_pin_indices(&mut uf_parent, bit_a, bit_b);
                            }
                        }
                    }
                }
            }
        }

        // Compile active nodes
        for n in &dto_nodes {
            if NodeKind::is_passive_or_visual(&n.node_type) {
                continue;
            }

            let kind = NodeKind::from_type_str(&n.node_type);
            let is_pull = kind.is_weak_pull();
            let is_button = kind.is_button();

            let mut input_pin_indices = Vec::with_capacity(n.inputs.len());
            let mut vcc_input_idx = -1isize;
            let mut gnd_input_idx = -1isize;

            for (i, p) in n.inputs.iter().enumerate() {
                let idx = self.pin_id_to_idx[&p.id];
                input_pin_indices.push(idx);
                if p.name == "VCC" {
                    vcc_input_idx = i as isize;
                } else if p.name == "GND" {
                    gnd_input_idx = i as isize;
                }
            }

            let mut output_pin_indices = Vec::with_capacity(n.outputs.len());
            let mut has_self_feedback = false;
            for p in &n.outputs {
                let idx = self.pin_id_to_idx[&p.id];
                output_pin_indices.push(idx);
                pin_flags[idx] |= PIN_FLAG_OUTPUT;
                if is_pull {
                    pin_flags[idx] |= PIN_FLAG_WEAK;
                } else if is_button {
                    pin_flags[idx] |= PIN_FLAG_DYNAMIC_WEAK;
                }
                if input_pin_indices.contains(&idx) {
                    has_self_feedback = true;
                }
            }

            let props = &n.properties;
            let value = props.get("value").and_then(|v| v.as_i64()).map(|v| {
                if v == 1 {
                    SIG_HIGH
                } else {
                    SIG_LOW
                }
            });
            let is_flattened = props
                .get("_isFlattened")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let pressed = props
                .get("pressed")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let active_low = props
                .get("activeLow")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let num_outputs_prop = props
                .get("numOutputs")
                .and_then(|v| v.as_u64())
                .unwrap_or(4) as usize;
            let switches = props
                .get("switches")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .map(|x| if x.as_i64() == Some(1) { SIG_HIGH } else { SIG_LOW })
                        .collect()
                })
                .unwrap_or_else(|| vec![SIG_LOW; 4]);
            let clock_manual = props
                .get("mode")
                .and_then(|v| v.as_str())
                .map(|s| s == "manual")
                .unwrap_or(false);
            let manual_value = if props.get("manualValue").and_then(|v| v.as_i64()) == Some(1) {
                SIG_HIGH
            } else {
                SIG_LOW
            };
            let interval = props.get("interval").and_then(|v| v.as_u64()).unwrap_or(5);
            let high_ticks = props
                .get("highTicks")
                .and_then(|v| v.as_u64())
                .unwrap_or(interval)
                .max(1);
            let low_ticks = props
                .get("lowTicks")
                .and_then(|v| v.as_u64())
                .unwrap_or(interval)
                .max(1);
            let pulse_ticks = props
                .get("pulseTicks")
                .and_then(|v| v.as_i64())
                .unwrap_or(high_ticks as i64)
                .max(1) as i32;
            let start_high = props
                .get("startHigh")
                .and_then(|v| v.as_bool())
                .unwrap_or(true);
            let ne555_mode = Ne555Mode::from_str(
                props
                    .get("ne555Mode")
                    .and_then(|v| v.as_str())
                    .unwrap_or("astable"),
            );

            let rom_data: Vec<u8> = props
                .get("data")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .map(|x| (x.as_u64().unwrap_or(0) & 0xFF) as u8)
                        .collect()
                })
                .unwrap_or_default();

            let jedec_str = props
                .get("jedecString")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let compiled_jedec = if kind == NodeKind::Gal22V10 {
                Some(Box::new(compile_jedec(jedec_str)))
            } else {
                None
            };

            let mut sram = Vec::new();
            if kind == NodeKind::Sram62256 {
                sram = vec![0u8; 32768];
                let copy_len = rom_data.len().min(32768);
                sram[..copy_len].copy_from_slice(&rom_data[..copy_len]);
            } else if kind == NodeKind::Sram6116 {
                sram = vec![0u8; 2048];
                let copy_len = rom_data.len().min(2048);
                sram[..copy_len].copy_from_slice(&rom_data[..copy_len]);
            }

            let in_len = input_pin_indices.len();
            let mut state = NodeInternalState::default();
            let mut prev_inputs = vec![SIG_Z; in_len];
            if let Some((old_st, old_sram, old_prev_in)) = old_node_states.remove(&n.id) {
                state = old_st;
                if !old_sram.is_empty() && sram.len() == old_sram.len() {
                    sram = old_sram;
                }
                if old_prev_in.len() == in_len {
                    prev_inputs = old_prev_in;
                }
            }
            let idx = self.nodes.len();
            self.node_id_to_idx.insert(n.id.clone(), idx);
            if kind.is_tick_driven() {
                self.tick_root_nodes.push(idx);
            }
            if kind.uses_prev_inputs() {
                self.prev_input_nodes.push(idx);
            }
            if kind.has_sequential_state() {
                self.stateful_nodes.push(idx);
            }
            self.nodes.push(CompiledNode {
                kind,
                input_pin_indices,
                output_pin_indices,
                vcc_input_idx,
                gnd_input_idx,
                has_self_feedback,
                value,
                is_flattened,
                pressed,
                active_low,
                num_outputs_prop,
                switches,
                clock_manual,
                manual_value,
                high_ticks,
                low_ticks,
                pulse_ticks,
                start_high,
                ne555_mode,
                rom_data,
                compiled_jedec,
                state,
                next_state: state,
                sram,
                prev_inputs,
                last_inputs: vec![255u8; in_len],
            });
        }

        // Group pins into nets using integer Union-Find (zero String allocations)
        let total_pins = self.all_pin_ids.len();
        let mut root_to_group: Vec<isize> = vec![-1; total_pins];
        let mut net_groups: Vec<Vec<usize>> = Vec::new();

        for pin_idx in 0..total_pins {
            let root = find_root_idx(&mut uf_parent, pin_idx);
            if root != pin_idx {
                let g_idx = root_to_group[root];
                if g_idx >= 0 {
                    net_groups[g_idx as usize].push(pin_idx);
                } else {
                    let new_g = net_groups.len();
                    root_to_group[root] = new_g as isize;
                    net_groups.push(vec![root, pin_idx]);
                }
            }
        }

        for group in net_groups {
            let mut all_pin_indices = Vec::with_capacity(group.len());
            let mut strong_driver_indices = Vec::new();
            let mut weak_driver_indices = Vec::new();

            for idx in group {
                pin_flags[idx] |= PIN_FLAG_CONNECTED;
                all_pin_indices.push(idx);
                let flags = pin_flags[idx];
                if (flags & PIN_FLAG_OUTPUT) != 0 {
                    if (flags & PIN_FLAG_WEAK) != 0 {
                        weak_driver_indices.push(idx);
                    } else if (flags & PIN_FLAG_DYNAMIC_WEAK) != 0 {
                        strong_driver_indices.push(idx);
                        weak_driver_indices.push(idx);
                    } else {
                        strong_driver_indices.push(idx);
                    }
                }
            }

            self.nets.push(CompiledNet {
                all_pin_indices,
                strong_driver_indices,
                weak_driver_indices,
                fanout_node_indices: Vec::new(),
            });
        }

        for n in &dto_nodes {
            for p in &n.inputs {
                let idx = self.pin_id_to_idx[&p.id];
                if (pin_flags[idx] & (PIN_FLAG_CONNECTED | PIN_FLAG_OUTPUT)) == 0 {
                    self.disconnected_input_indices.push(idx);
                }
            }
        }

        self.pin_to_net = vec![-1isize; total_pins];
        for (net_idx, net) in self.nets.iter().enumerate() {
            for &pin_idx in &net.all_pin_indices {
                self.pin_to_net[pin_idx] = net_idx as isize;
            }
        }

        // Since node_idx is visited in strictly ascending order, deduplicating fanout_node_indices
        // only requires checking `.last() != Some(&node_idx)` (0 HashSet allocations, sorted for cache locality).
        for (node_idx, cn) in self.nodes.iter().enumerate() {
            for &in_pin_idx in &cn.input_pin_indices {
                let net_idx = self.pin_to_net[in_pin_idx];
                if net_idx >= 0 {
                    let fanout = &mut self.nets[net_idx as usize].fanout_node_indices;
                    if fanout.last() != Some(&node_idx) {
                        fanout.push(node_idx);
                    }
                }
            }
        }

        self.is_weak_pin = vec![false; total_pins];
        for (idx, &flags) in pin_flags.iter().enumerate() {
            if (flags & PIN_FLAG_WEAK) != 0 {
                self.is_weak_pin[idx] = true;
            }
        }

        self.cur_buf = vec![SIG_Z; total_pins];
        self.prev_buf = vec![SIG_Z; total_pins];
        self.driver_buf = vec![SIG_Z; total_pins];
        if preserve_state {
            for (pid, &idx) in &self.pin_id_to_idx {
                if let Some(&(c, p, d)) = old_pin_signals.get(pid) {
                    self.cur_buf[idx] = c;
                    self.prev_buf[idx] = p;
                    self.driver_buf[idx] = d;
                }
            }
        }
        self.dirty_net_flags = vec![0; self.nets.len()];
        self.dirty_node_flags = vec![0; self.nodes.len()];

        // Pre-allocate scratch vectors for zero-allocation tick stepping
        self.all_nets_indices = (0..self.nets.len()).collect();
        self.active_nodes_buf = Vec::with_capacity(self.nodes.len());
        self.next_dirty_nodes_buf = Vec::with_capacity(self.nodes.len());
        self.dirty_nets_buf = Vec::with_capacity(self.nets.len());
        self.in_vals_buf = Vec::with_capacity(32);
        self.out_vals_buf = Vec::with_capacity(32);

        self.all_pin_ids.clone()
    }
}
