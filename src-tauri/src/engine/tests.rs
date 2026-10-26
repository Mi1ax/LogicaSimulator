use super::simulator::RustSimulator;
use super::types::{AnalyzerChannelDto, BreakpointRuleDto, NodeDto, PinDto, WireDto, SIG_HIGH};

#[test]
fn test_rust_simulator_gates_and_74ls125() {
    let mut sim = RustSimulator::default();
    let nodes = vec![
        NodeDto {
            id: "in1".into(),
            node_type: "INPUT".into(),
            inputs: vec![],
            outputs: vec![PinDto {
                id: "p_in1".into(),
                name: "OUT".into(),
            }],
            properties: serde_json::json!({ "value": 1 }),
        },
        NodeDto {
            id: "gnd".into(),
            node_type: "GND".into(),
            inputs: vec![],
            outputs: vec![PinDto {
                id: "p_gnd".into(),
                name: "OUT".into(),
            }],
            properties: serde_json::json!({}),
        },
        NodeDto {
            id: "buf".into(),
            node_type: "74LS125".into(),
            inputs: vec![
                PinDto {
                    id: "1g".into(),
                    name: "1G'".into(),
                },
                PinDto {
                    id: "1a".into(),
                    name: "1A".into(),
                },
            ],
            outputs: vec![PinDto {
                id: "1y".into(),
                name: "1Y".into(),
            }],
            properties: serde_json::json!({}),
        },
    ];
    let wires = vec![
        WireDto {
            source_pin_id: "p_gnd".into(),
            target_pin_id: "1g".into(),
        },
        WireDto {
            source_pin_id: "p_in1".into(),
            target_pin_id: "1a".into(),
        },
    ];
    sim.compile(nodes, wires);
    sim.step_single_tick();
    let y_idx = sim.pin_id_to_idx["1y"];
    assert_eq!(sim.cur_buf[y_idx], SIG_HIGH);
}

#[test]
fn test_rust_keypad_and_breakpoints_and_sram() {
    let mut sim = RustSimulator::default();
    // Keypad with key 4 pressed (row 1 = R2, col 1 = C2)
    let nodes = vec![
        NodeDto {
            id: "vcc".into(),
            node_type: "VCC".into(),
            inputs: vec![],
            outputs: vec![PinDto {
                id: "p_vcc".into(),
                name: "OUT".into(),
            }],
            properties: serde_json::json!({}),
        },
        NodeDto {
            id: "kp".into(),
            node_type: "KEYPAD".into(),
            inputs: vec![
                PinDto { id: "r1".into(), name: "R1".into() },
                PinDto { id: "r2".into(), name: "R2".into() },
                PinDto { id: "r3".into(), name: "R3".into() },
                PinDto { id: "r4".into(), name: "R4".into() },
                PinDto { id: "c1".into(), name: "C1".into() },
                PinDto { id: "c2".into(), name: "C2".into() },
                PinDto { id: "c3".into(), name: "C3".into() },
            ],
            outputs: vec![],
            properties: serde_json::json!({ "pressedKey": 4 }),
        },
    ];
    let wires = vec![WireDto {
        source_pin_id: "p_vcc".into(),
        target_pin_id: "r2".into(),
    }];
    sim.compile(nodes, wires);

    let channels = vec![AnalyzerChannelDto {
        id: "ch_c2".into(),
        pin_ids: vec!["c2".into()],
    }];
    let bps = vec![BreakpointRuleDto {
        id: "bp1".into(),
        enabled: true,
        target_channel_id: "ch_c2".into(),
        condition_type: "high".into(),
        value: None,
    }];

    let (hit, tick, la_ticks, la_samples, _) = sim.step_batch(
        5,
        &["c2".to_string()],
        &bps,
        &channels,
        false,
        None,
    );
    // Should stop on tick 1 when c2 transitions to HIGH
    assert_eq!(hit.as_deref(), Some("bp1"));
    assert_eq!(tick, 1);
    assert_eq!(la_ticks, vec![1]);
    assert_eq!(la_samples, vec![SIG_HIGH]);
}

#[test]
fn test_rust_74ls161_counter_bus_breakpoint_and_sram_memory() {
    let mut sim = RustSimulator::default();
    let nodes = vec![
        NodeDto {
            id: "clk".into(),
            node_type: "CLOCK".into(),
            inputs: vec![],
            outputs: vec![PinDto {
                id: "p_clk".into(),
                name: "OUT".into(),
            }],
            properties: serde_json::json!({ "highTicks": 1, "lowTicks": 1, "startHigh": false }),
        },
        NodeDto {
            id: "cnt".into(),
            node_type: "74LS161".into(),
            inputs: vec![
                PinDto { id: "clr".into(), name: "~CLR".into() },
                PinDto { id: "c_clk".into(), name: "CLK".into() },
                PinDto { id: "a".into(), name: "A".into() },
                PinDto { id: "b".into(), name: "B".into() },
                PinDto { id: "c".into(), name: "C".into() },
                PinDto { id: "d".into(), name: "D".into() },
                PinDto { id: "enp".into(), name: "ENP".into() },
                PinDto { id: "gnd".into(), name: "GND".into() },
                PinDto { id: "load".into(), name: "~LOAD".into() },
                PinDto { id: "ent".into(), name: "ENT".into() },
                PinDto { id: "vcc".into(), name: "VCC".into() },
            ],
            outputs: vec![
                PinDto { id: "qd".into(), name: "QD".into() },
                PinDto { id: "qc".into(), name: "QC".into() },
                PinDto { id: "qb".into(), name: "QB".into() },
                PinDto { id: "qa".into(), name: "QA".into() },
                PinDto { id: "rco".into(), name: "RCO".into() },
            ],
            properties: serde_json::json!({}),
        },
        NodeDto {
            id: "ram".into(),
            node_type: "62256".into(),
            inputs: (0..28)
                .map(|i| PinDto {
                    id: format!("ram_in_{}", i),
                    name: format!("IN{}", i),
                })
                .collect(),
            outputs: (0..8)
                .map(|i| PinDto {
                    id: format!("ram_out_{}", i),
                    name: format!("D{}", i),
                })
                .collect(),
            properties: serde_json::json!({ "data": [0xAA, 0x55] }),
        },
    ];
    let wires = vec![WireDto {
        source_pin_id: "p_clk".into(),
        target_pin_id: "c_clk".into(),
    }];
    sim.compile(nodes, wires);

    let channels = vec![AnalyzerChannelDto {
        id: "bus_q".into(),
        pin_ids: vec!["qd".into(), "qc".into(), "qb".into(), "qa".into()],
    }];
    let bps = vec![BreakpointRuleDto {
        id: "bp_eq5".into(),
        enabled: true,
        target_channel_id: "bus_q".into(),
        condition_type: "equals".into(),
        value: Some("0x05".into()),
    }];

    let (hit, tick, la_ticks, _la_samples, sram_mem) = sim.step_batch(
        20,
        &["qd".into(), "qc".into(), "qb".into(), "qa".into()],
        &bps,
        &channels,
        false,
        Some("ram"),
    );

    assert_eq!(hit.as_deref(), Some("bp_eq5"));
    // Counter increments on each rising edge of clock (ticks 2, 4, 6, 8, 10) -> reaches 5 at tick 10
    assert_eq!(tick, 10);
    assert_eq!(la_ticks.len(), 10);
    let mem = sram_mem.expect("SRAM memory should be returned");
    assert_eq!(mem.len(), 32768);
    assert_eq!(mem[0], 0xAA);
    assert_eq!(mem[1], 0x55);
}

#[test]
fn test_rust_decoders_alu_and_ne555() {
    let mut sim = RustSimulator::default();
    let nodes = vec![
        NodeDto {
            id: "ne555".into(),
            node_type: "NE555".into(),
            inputs: vec![
                PinDto { id: "gnd".into(), name: "GND".into() },
                PinDto { id: "trig".into(), name: "~TRIG".into() },
                PinDto { id: "rst".into(), name: "~RST".into() },
                PinDto { id: "vcc".into(), name: "VCC".into() },
            ],
            outputs: vec![PinDto { id: "out555".into(), name: "OUT".into() }],
            properties: serde_json::json!({
                "ne555Mode": "astable",
                "highTicks": 2,
                "lowTicks": 2,
                "startHigh": true
            }),
        },
        NodeDto {
            id: "dec".into(),
            node_type: "74LS138".into(),
            inputs: vec![
                PinDto { id: "a".into(), name: "A".into() },
                PinDto { id: "b".into(), name: "B".into() },
                PinDto { id: "c".into(), name: "C".into() },
                PinDto { id: "g2a".into(), name: "~G2A".into() },
                PinDto { id: "g2b".into(), name: "~G2B".into() },
                PinDto { id: "g1".into(), name: "G1".into() },
            ],
            outputs: (0..8)
                .rev()
                .map(|i| PinDto {
                    id: format!("y{}", i),
                    name: format!("~Y{}", i),
                })
                .collect(),
            properties: serde_json::json!({}),
        },
    ];
    let wires = vec![WireDto {
        source_pin_id: "out555".into(),
        target_pin_id: "g1".into(),
    }];
    sim.compile(nodes, wires);
    sim.step_single_tick();
    // On tick 0 with startHigh=true, out555 is HIGH -> G1 is HIGH, but ~G2A/~G2B default to HIGH when unconnected -> all Y outputs HIGH
    let out555_idx = sim.pin_id_to_idx["out555"];
    assert_eq!(sim.cur_buf[out555_idx], SIG_HIGH);
}

#[test]
fn test_compile_preserve_state_keeps_ticks_and_counter() {
    let mut sim = RustSimulator::default();
    let make_nodes = |pressed_key: Option<i64>| {
        vec![
            NodeDto {
                id: "clk".into(),
                node_type: "CLOCK".into(),
                inputs: vec![],
                outputs: vec![PinDto { id: "p_clk".into(), name: "OUT".into() }],
                properties: serde_json::json!({ "highTicks": 1, "lowTicks": 1, "startHigh": false }),
            },
            NodeDto {
                id: "cnt".into(),
                node_type: "74LS161".into(),
                inputs: vec![
                    PinDto { id: "clr".into(), name: "~CLR".into() },
                    PinDto { id: "c_clk".into(), name: "CLK".into() },
                    PinDto { id: "a".into(), name: "A".into() },
                    PinDto { id: "b".into(), name: "B".into() },
                    PinDto { id: "c".into(), name: "C".into() },
                    PinDto { id: "d".into(), name: "D".into() },
                    PinDto { id: "enp".into(), name: "ENP".into() },
                    PinDto { id: "gnd".into(), name: "GND".into() },
                    PinDto { id: "load".into(), name: "~LOAD".into() },
                    PinDto { id: "ent".into(), name: "ENT".into() },
                    PinDto { id: "vcc".into(), name: "VCC".into() },
                ],
                outputs: vec![
                    PinDto { id: "qd".into(), name: "QD".into() },
                    PinDto { id: "qc".into(), name: "QC".into() },
                    PinDto { id: "qb".into(), name: "QB".into() },
                    PinDto { id: "qa".into(), name: "QA".into() },
                    PinDto { id: "rco".into(), name: "RCO".into() },
                ],
                properties: serde_json::json!({}),
            },
            NodeDto {
                id: "kp".into(),
                node_type: "KEYPAD".into(),
                inputs: vec![
                    PinDto { id: "r1".into(), name: "R1".into() },
                    PinDto { id: "r2".into(), name: "R2".into() },
                    PinDto { id: "r3".into(), name: "R3".into() },
                    PinDto { id: "r4".into(), name: "R4".into() },
                    PinDto { id: "c1".into(), name: "C1".into() },
                    PinDto { id: "c2".into(), name: "C2".into() },
                    PinDto { id: "c3".into(), name: "C3".into() },
                ],
                outputs: vec![],
                properties: serde_json::json!({ "pressedKey": pressed_key }),
            },
        ]
    };
    let wires = vec![WireDto {
        source_pin_id: "p_clk".into(),
        target_pin_id: "c_clk".into(),
    }];

    sim.compile_with_options(make_nodes(None), wires.clone(), false);
    for _ in 0..6 {
        sim.step_single_tick();
    }
    assert_eq!(sim.tick_count, 6);
    assert_eq!(sim.nodes[1].state.counter, 3);

    // Pressing keypad key recompiles netlist with preserve_state = true
    sim.compile_with_options(make_nodes(Some(0)), wires, true);
    assert_eq!(sim.tick_count, 6);
    assert_eq!(sim.nodes[1].state.counter, 3);
}

#[test]
fn test_rust_perf_large_circuit_compile_and_10k_ticks_benchmark() {
    use std::time::Instant;

    let mut sim = RustSimulator::default();
    let num_stages = 1000usize;
    let mut nodes = Vec::with_capacity(num_stages + 10);
    let mut wires = Vec::with_capacity(num_stages + 20);

    // Master Clock (toggles every tick)
    nodes.push(NodeDto {
        id: "clk".into(),
        node_type: "CLOCK".into(),
        inputs: vec![],
        outputs: vec![PinDto {
            id: "p_clk".into(),
            name: "OUT".into(),
        }],
        properties: serde_json::json!({ "highTicks": 1, "lowTicks": 1, "startHigh": false }),
    });

    // Static input source for a large idle combinational cloud (to verify event-driven zero-work on untouched cones)
    nodes.push(NodeDto {
        id: "in_static".into(),
        node_type: "INPUT".into(),
        inputs: vec![],
        outputs: vec![PinDto {
            id: "p_static_0".into(),
            name: "OUT".into(),
        }],
        properties: serde_json::json!({ "value": 1 }),
    });

    // 4-bit synchronous counter driven by clock
    nodes.push(NodeDto {
        id: "cnt".into(),
        node_type: "74LS161".into(),
        inputs: vec![
            PinDto { id: "clr".into(), name: "~CLR".into() },
            PinDto { id: "c_clk".into(), name: "CLK".into() },
            PinDto { id: "a".into(), name: "A".into() },
            PinDto { id: "b".into(), name: "B".into() },
            PinDto { id: "c".into(), name: "C".into() },
            PinDto { id: "d".into(), name: "D".into() },
            PinDto { id: "enp".into(), name: "ENP".into() },
            PinDto { id: "gnd".into(), name: "GND".into() },
            PinDto { id: "load".into(), name: "~LOAD".into() },
            PinDto { id: "ent".into(), name: "ENT".into() },
            PinDto { id: "vcc".into(), name: "VCC".into() },
        ],
        outputs: vec![
            PinDto { id: "qd".into(), name: "QD".into() },
            PinDto { id: "qc".into(), name: "QC".into() },
            PinDto { id: "qb".into(), name: "QB".into() },
            PinDto { id: "qa".into(), name: "QA".into() },
            PinDto { id: "rco".into(), name: "RCO".into() },
        ],
        properties: serde_json::json!({}),
    });
    wires.push(WireDto {
        source_pin_id: "p_clk".into(),
        target_pin_id: "c_clk".into(),
    });

    // 40 active logic gates chained from QA, plus 960 logic gates arranged in 32 parallel 30-stage pipelines from p_static_0
    let active_chain_len = 40usize;
    for i in 0..num_stages {
        let is_active_chain = i < active_chain_len;
        let prev_out = if is_active_chain {
            if i == 0 {
                "qa".to_string()
            } else {
                format!("g_out_{}", i - 1)
            }
        } else {
            let rel = i - active_chain_len;
            if rel % 30 == 0 {
                "p_static_0".to_string()
            } else {
                format!("g_out_{}", i - 1)
            }
        };

        let in_id = format!("g_in_{}", i);
        let out_id = format!("g_out_{}", i);
        nodes.push(NodeDto {
            id: format!("gate_{}", i),
            node_type: if i % 2 == 0 { "NOT".into() } else { "BUFFER".into() },
            inputs: vec![PinDto {
                id: in_id.clone(),
                name: "IN".into(),
            }],
            outputs: vec![PinDto {
                id: out_id,
                name: "OUT".into(),
            }],
            properties: serde_json::json!({}),
        });
        wires.push(WireDto {
            source_pin_id: prev_out,
            target_pin_id: in_id,
        });
    }

    let t_compile = Instant::now();
    let pin_ids = sim.compile(nodes, wires);
    let compile_us = t_compile.elapsed().as_micros();
    assert!(pin_ids.len() > 2000);
    assert!(
        compile_us < 50_000,
        "Expected compile of 1000+ nodes to take < 50ms, took {} us",
        compile_us
    );

    let tracked = vec![
        "qd".to_string(),
        "qc".to_string(),
        "qb".to_string(),
        "qa".to_string(),
        format!("g_out_{}", active_chain_len - 1),
    ];
    let channels = vec![AnalyzerChannelDto {
        id: "ch_q".into(),
        pin_ids: vec!["qd".into(), "qc".into(), "qb".into(), "qa".into()],
    }];
    let bps = vec![BreakpointRuleDto {
        id: "bp_never".into(),
        enabled: true,
        target_channel_id: "ch_q".into(),
        condition_type: "equals".into(),
        value: Some("0xFF".into()), // 4-bit counter never reaches 0xFF
    }];

    let t_sim = Instant::now();
    let (hit, _, la_ticks, la_samples, _) =
        sim.step_batch(10_000, &tracked, &bps, &channels, false, None);
    let sim_us = t_sim.elapsed().as_micros();

    assert!(hit.is_none());
    assert_eq!(sim.tick_count, 10_000);
    assert_eq!(la_ticks.len(), 1024);
    assert_eq!(la_samples.len(), 1024 * tracked.len());

    // Verify interactive input toggle wakes up the 900-gate static chain in 1 tick
    let last_static_idx = sim.pin_id_to_idx[&format!("g_out_{}", num_stages - 1)];
    let before_toggle = sim.cur_buf[last_static_idx];
    sim.update_node_input("in_static", &serde_json::json!({ "value": 0 }));
    sim.step_single_tick();
    let after_toggle = sim.cur_buf[last_static_idx];
    assert_ne!(before_toggle, after_toggle);

    println!(
        "[Rust Perf] 1003 nodes compile: {} us | 10,000 ticks + LA + BP: {} us ({:.2} us/tick)",
        compile_us,
        sim_us,
        sim_us as f64 / 10_000.0
    );
    assert!(
        sim_us < 250_000,
        "Expected 10,000 ticks on 1003-node circuit to take < 250ms, took {} us",
        sim_us
    );
}
