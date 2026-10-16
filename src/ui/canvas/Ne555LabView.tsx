import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSimulatorStore } from '../../store/useSimulatorStore';
import {
  Play,
  Pause,
  RotateCcw,
  Cpu,
  Check,
  StepForward,
} from 'lucide-react';

type TopologyMode = 'astable' | 'monostable' | 'bistable';
type ResUnit = 'Ω' | 'kΩ' | 'MΩ';
type CapUnit = 'pF' | 'nF' | 'µF';

const RES_MULTIPLIER: Record<ResUnit, number> = {
  'Ω': 1,
  'kΩ': 1e3,
  'MΩ': 1e6,
};

const CAP_MULTIPLIER: Record<CapUnit, number> = {
  pF: 1e-12,
  nF: 1e-9,
  'µF': 1e-6,
};

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0 s';
  if (sec < 1e-6) return `${(sec * 1e9).toFixed(1)} ns`;
  if (sec < 1e-3) return `${(sec * 1e6).toFixed(1)} µs`;
  if (sec < 1) return `${(sec * 1e3).toFixed(2)} ms`;
  return `${sec.toFixed(2)} s`;
}

function formatFreq(hz: number): string {
  if (!Number.isFinite(hz) || hz <= 0) return '0 Hz';
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(2)} kHz`;
  if (hz >= 1) return `${hz.toFixed(2)} Hz`;
  return `${(hz * 1000).toFixed(1)} mHz`;
}

function ohmsToUnitVal(ohms: number): { val: number; unit: ResUnit } {
  const safe = Math.max(1, ohms);
  if (safe >= 1e6) {
    return { val: Number((safe / 1e6).toFixed(3)), unit: 'MΩ' };
  }
  if (safe >= 1e3) {
    return { val: Number((safe / 1e3).toFixed(3)), unit: 'kΩ' };
  }
  return { val: Number(safe.toFixed(1)), unit: 'Ω' };
}

const STANDARD_CAPS: Array<{ val: number; unit: CapUnit; farads: number }> = [
  { val: 100, unit: 'pF', farads: 100e-12 },
  { val: 1, unit: 'nF', farads: 1e-9 },
  { val: 10, unit: 'nF', farads: 10e-9 },
  { val: 100, unit: 'nF', farads: 100e-9 },
  { val: 1, unit: 'µF', farads: 1e-6 },
  { val: 10, unit: 'µF', farads: 10e-6 },
  { val: 47, unit: 'µF', farads: 47e-6 },
  { val: 100, unit: 'µF', farads: 100e-6 },
];

interface FloatInputProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  debounceMs?: number;
  className?: string;
}

const FloatInput: React.FC<FloatInputProps> = ({
  value,
  onChange,
  min = 0.01,
  max = 100000,
  debounceMs = 0,
  className,
}) => {
  const [text, setText] = useState<string>(String(value));
  const focusedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!focusedRef.current) {
      setText(String(value));
    }
  }, [value]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const commit = (raw: string) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const parsed = parseFloat(raw.replace(',', '.'));
    if (!Number.isNaN(parsed) && parsed > 0) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped);
      setText(String(clamped));
    } else {
      setText(String(value));
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        commit(text);
      }}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        const parsed = parseFloat(v.replace(',', '.'));
        if (!Number.isNaN(parsed) && parsed >= min && parsed <= max && !v.endsWith('.')) {
          if (debounceMs > 0) {
            timerRef.current = window.setTimeout(() => {
              onChange(parsed);
            }, debounceMs);
          } else {
            onChange(parsed);
          }
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit(text);
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
};

export const Ne555LabView: React.FC = () => {
  const nodes = useSimulatorStore((state) => state.nodes);
  const selection = useSimulatorStore((state) => state.selection);
  const simSpeed = useSimulatorStore((state) => state.simSpeed);
  const setSimSpeed = useSimulatorStore((state) => state.setSimSpeed);
  const setAppMode = useSimulatorStore((state) => state.setAppMode);
  const updateNodeProperties = useSimulatorStore((state) => state.updateNodeProperties);
  const startPlacingNode = useSimulatorStore((state) => state.startPlacingNode);

  const ne555Nodes = useMemo(() => nodes.filter((n) => n.type === 'NE555'), [nodes]);

  const initialChipId = useMemo(() => {
    if (selection?.type === 'node') {
      const selNode = ne555Nodes.find((n) => n.id === selection.id);
      if (selNode) return selNode.id;
    }
    return ne555Nodes[0]?.id || '';
  }, [selection, ne555Nodes]);

  const [selectedChipId, setSelectedChipId] = useState<string>(initialChipId);
  const activeChip = useMemo(
    () => ne555Nodes.find((n) => n.id === selectedChipId) || ne555Nodes[0] || null,
    [ne555Nodes, selectedChipId]
  );

  // On-demand UI toggles
  const [detailedView, setDetailedView] = useState<boolean>(false);
  const [openPresets, setOpenPresets] = useState<boolean>(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenPresets(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Analog Circuit Parameters
  const [topology, setTopology] = useState<TopologyMode>(
    () => (activeChip?.properties?.ne555Mode as TopologyMode) || 'astable'
  );
  const [vcc, setVcc] = useState<number>(() => Number(activeChip?.properties?.vcc) || 5.0);
  const [r1Value, setR1Value] = useState<number>(
    () => Number(activeChip?.properties?.r1Value) || 10
  );
  const [r1Unit, setR1Unit] = useState<ResUnit>(
    () => (activeChip?.properties?.r1Unit as ResUnit) || 'kΩ'
  );
  const [r2Value, setR2Value] = useState<number>(
    () => Number(activeChip?.properties?.r2Value) || 47
  );
  const [r2Unit, setR2Unit] = useState<ResUnit>(
    () => (activeChip?.properties?.r2Unit as ResUnit) || 'kΩ'
  );
  const [cValue, setCValue] = useState<number>(
    () => Number(activeChip?.properties?.cValue) || 10
  );
  const [cUnit, setCUnit] = useState<CapUnit>(
    () => (activeChip?.properties?.cUnit as CapUnit) || 'µF'
  );
  const [bypassDiode, setBypassDiode] = useState<boolean>(
    () => Boolean(activeChip?.properties?.bypassDiode)
  );

  // Sync parameters when switching target NE555 chip
  const lastLoadedChipIdRef = useRef<string | null>(activeChip?.id || null);
  useEffect(() => {
    if (activeChip && activeChip.id !== lastLoadedChipIdRef.current) {
      lastLoadedChipIdRef.current = activeChip.id;
      const p = activeChip.properties || {};
      if (p.ne555Mode) setTopology(p.ne555Mode);
      if (p.vcc) setVcc(Number(p.vcc));
      if (p.r1Value) setR1Value(Number(p.r1Value));
      if (p.r1Unit) setR1Unit(p.r1Unit);
      if (p.r2Value) setR2Value(Number(p.r2Value));
      if (p.r2Unit) setR2Unit(p.r2Unit);
      if (p.cValue) setCValue(Number(p.cValue));
      if (p.cUnit) setCUnit(p.cUnit);
      if (typeof p.bypassDiode === 'boolean') setBypassDiode(p.bypassDiode);
    }
  }, [activeChip]);

  // Analytical Timing Calculations
  const DIODE_VF = 0.65; // 1N4148 Silicon Diode forward voltage drop (~0.65V)

  const calc = useMemo(() => {
    const r1Ohms = Math.max(1, r1Value * RES_MULTIPLIER[r1Unit]);
    const r2Ohms = Math.max(1, r2Value * RES_MULTIPLIER[r2Unit]);
    const cFarads = Math.max(1e-15, cValue * CAP_MULTIPLIER[cUnit]);

    const vTh = (2 / 3) * vcc;
    const vTr = (1 / 3) * vcc;

    if (topology === 'astable') {
      const rCharge = bypassDiode ? r1Ohms : r1Ohms + r2Ohms;
      const rDischarge = r2Ohms;
      const tauCharge = rCharge * cFarads;
      const tauDischarge = rDischarge * cFarads;

      // With D1 across R2, Pin 7 is clamped to V_C + V_F, so C1 charges toward (VCC - V_F)
      // instead of VCC. This makes charging slower than ln(2)*R1*C1 and dependent on VCC!
      const vChargeTarget = bypassDiode ? Math.max(vTh + 0.1, vcc - DIODE_VF) : vcc;
      const chargeLnFactor = bypassDiode
        ? Math.log((vChargeTarget - vTr) / (vChargeTarget - vTh))
        : Math.LN2;

      const tHigh = chargeLnFactor * tauCharge;
      const tLow = Math.LN2 * tauDischarge;
      const period = tHigh + tLow;
      const freq = period > 0 ? 1 / period : 0;
      const duty = period > 0 ? (tHigh / period) * 100 : 50;

      const highTicks = Math.max(1, Math.round(tHigh * simSpeed));
      const lowTicks = Math.max(1, Math.round(tLow * simSpeed));

      return {
        r1Ohms,
        r2Ohms,
        cFarads,
        vTh,
        vTr,
        vChargeTarget,
        chargeLnFactor,
        tauCharge,
        tauDischarge,
        tHigh,
        tLow,
        period,
        freq,
        duty,
        highTicks,
        lowTicks,
        pulseTicks: highTicks,
      };
    }

    if (topology === 'monostable') {
      const tauCharge = r1Ohms * cFarads;
      const tauDischarge = Math.max(1e-6, 100 * cFarads); // Fast discharge via internal transistor
      const tPulse = Math.log(3) * tauCharge; // ln(3) * R1 * C1 ≈ 1.0986 * R1 * C1
      const pulseTicks = Math.max(1, Math.round(tPulse * simSpeed));

      return {
        r1Ohms,
        r2Ohms,
        cFarads,
        vTh,
        vTr,
        vChargeTarget: vcc,
        chargeLnFactor: Math.log(3),
        tauCharge,
        tauDischarge,
        tHigh: tPulse,
        tLow: 0,
        period: tPulse,
        freq: tPulse > 0 ? 1 / tPulse : 0,
        duty: 100,
        highTicks: pulseTicks,
        lowTicks: 1,
        pulseTicks,
      };
    }

    // Bistable
    return {
      r1Ohms,
      r2Ohms,
      cFarads,
      vTh,
      vTr,
      vChargeTarget: vcc,
      chargeLnFactor: Math.LN2,
      tauCharge: 0.1,
      tauDischarge: 0.1,
      tHigh: 0,
      tLow: 0,
      period: 0.2,
      freq: 0,
      duty: 50,
      highTicks: 5,
      lowTicks: 5,
      pulseTicks: 5,
    };
  }, [topology, vcc, r1Value, r1Unit, r2Value, r2Unit, cValue, cUnit, bypassDiode, simSpeed]);

  // Live Analog State & Real-Time ODE Solver
  const [isRunningPreview, setIsRunningPreview] = useState<boolean>(true);
  const [liveState, setLiveState] = useState<{
    vCap: number;
    latchQ: 0 | 1;
    trigPulsed: boolean;
    rstPulsed: boolean;
  }>({
    vCap: (1 / 3) * vcc,
    latchQ: 1,
    trigPulsed: false,
    rstPulsed: false,
  });

  const simRef = useRef({
    vCap: (1 / 3) * vcc,
    latchQ: 1 as 0 | 1,
    trigTimer: 0,
    rstTimer: 0,
  });

  // Clamp or initialize capacitor voltage when mode or VCC changes
  useEffect(() => {
    if (topology === 'monostable' || topology === 'bistable') {
      simRef.current.vCap = 0;
      simRef.current.latchQ = 0;
    } else {
      simRef.current.vCap = Math.min(vcc, Math.max(0, simRef.current.vCap));
    }
  }, [topology, vcc]);

  const stepPhysics = useCallback(
    (realDtSec: number) => {
      const s = simRef.current;
      // Scale simulation time so that 1 period takes ~2.2 seconds on screen
      const refPeriod = Math.max(1e-6, calc.period || 0.5);
      const effectivePeriodOnScreen = 2.2;
      const simDt = (realDtSec / effectivePeriodOnScreen) * refPeriod;

      if (s.trigTimer > 0) s.trigTimer = Math.max(0, s.trigTimer - realDtSec);
      if (s.rstTimer > 0) s.rstTimer = Math.max(0, s.rstTimer - realDtSec);

      if (s.rstTimer > 0) {
        s.latchQ = 0;
        s.vCap = s.vCap * Math.exp(-realDtSec * 18);
      } else if (topology === 'bistable') {
        if (s.trigTimer > 0) {
          s.latchQ = 1;
        }
        s.vCap = s.latchQ ? vcc : 0;
      } else if (topology === 'monostable') {
        if (s.trigTimer > 0) {
          s.latchQ = 1;
        }
        if (s.latchQ === 1) {
          // Charging C1 toward VCC through R1
          const tau = Math.max(1e-9, calc.tauCharge);
          s.vCap = vcc - (vcc - s.vCap) * Math.exp(-simDt / tau);
          if (s.vCap >= calc.vTh) {
            s.latchQ = 0;
          }
        } else {
          // Discharging C1 rapidly to 0V through Pin 7 NPN transistor
          s.vCap = s.vCap * Math.exp(-realDtSec * 22);
          if (s.vCap < 0.01) s.vCap = 0;
        }
      } else {
        // Astable Oscillator
        if (s.trigTimer > 0) {
          s.latchQ = 1;
        }
        if (s.latchQ === 1) {
          const tau = Math.max(1e-9, calc.tauCharge);
          const vTarget = calc.vChargeTarget;
          s.vCap = vTarget - (vTarget - s.vCap) * Math.exp(-simDt / tau);
          if (s.vCap >= calc.vTh && s.trigTimer <= 0) {
            s.vCap = calc.vTh;
            s.latchQ = 0;
          }
        } else {
          const tau = Math.max(1e-9, calc.tauDischarge);
          s.vCap = s.vCap * Math.exp(-simDt / tau);
          if (s.vCap <= calc.vTr) {
            s.vCap = calc.vTr;
            s.latchQ = 1;
          }
        }
      }

      const nextTrigPulsed = s.trigTimer > 0;
      const nextRstPulsed = s.rstTimer > 0;
      const roundedVCap = Math.round(s.vCap * 25) / 25;

      setLiveState((prev) => {
        if (
          prev.latchQ === s.latchQ &&
          prev.trigPulsed === nextTrigPulsed &&
          prev.rstPulsed === nextRstPulsed &&
          Math.abs(prev.vCap - roundedVCap) < 0.03
        ) {
          return prev;
        }
        return {
          vCap: roundedVCap,
          latchQ: s.latchQ,
          trigPulsed: nextTrigPulsed,
          rstPulsed: nextRstPulsed,
        };
      });
    },
    [calc, topology, vcc]
  );

  useEffect(() => {
    if (!isRunningPreview) return;
    let lastTime = performance.now();

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.15, Math.max(0.01, (now - lastTime) / 1000));
      lastTime = now;
      stepPhysics(dt);
    }, 100);

    return () => window.clearInterval(intervalId);
  }, [isRunningPreview, stepPhysics]);

  const handlePulseTrig = () => {
    simRef.current.trigTimer = 0.25;
    if (topology === 'monostable') {
      simRef.current.vCap = 0;
    }
    simRef.current.latchQ = 1;
    if (!isRunningPreview) {
      stepPhysics(0.05);
    }
  };

  const handlePulseRst = () => {
    simRef.current.rstTimer = 0.3;
    simRef.current.latchQ = 0;
    if (!isRunningPreview) {
      stepPhysics(0.05);
    }
  };

  const handleResetCap = () => {
    simRef.current.vCap = 0;
    simRef.current.latchQ = topology === 'astable' ? 1 : 0;
    setLiveState({
      vCap: 0,
      latchQ: simRef.current.latchQ,
      trigPulsed: false,
      rstPulsed: false,
    });
  };

  // Inverse RC Solver: Given target Frequency (Hz) and Duty Cycle (%), solve R1, R2, C1
  const applyTargetFreqAndDuty = (targetFreqHz: number, targetDutyPercent: number) => {
    const f = Math.min(1e6, Math.max(0.01, targetFreqHz));
    const duty = Math.min(99, Math.max(5, targetDutyPercent));
    const period = 1 / f;
    const tHigh = period * (duty / 100);
    const tLow = period * (1 - duty / 100);

    // Without bypass diode D1, duty cycle is strictly > 50% (since tHigh = ln(2)*(R1+R2)*C1 > tLow).
    // Automatically enable D1 when duty <= 51%, otherwise preserve current bypassDiode state.
    const useDiode = duty <= 51 ? true : bypassDiode;
    if (useDiode !== bypassDiode) {
      setBypassDiode(useDiode);
    }

    const vTh = (2 / 3) * vcc;
    const vTr = (1 / 3) * vcc;
    const vChargeTarget = useDiode ? Math.max(vTh + 0.1, vcc - DIODE_VF) : vcc;
    const chargeLn = useDiode
      ? Math.log((vChargeTarget - vTr) / (vChargeTarget - vTh))
      : Math.LN2;

    const computeResistors = (cFarads: number) => {
      const r2 = tLow / (Math.LN2 * cFarads);
      const r1 = useDiode
        ? tHigh / (chargeLn * cFarads)
        : Math.max(10, (tHigh - tLow) / (Math.LN2 * cFarads));
      return { r1, r2 };
    };

    // Check if current C1 keeps R1 & R2 in practical range [200 Ω .. 1 MΩ]
    let chosenCapVal = cValue;
    let chosenCapUnit = cUnit;
    let chosenCapFarads = Math.max(1e-15, cValue * CAP_MULTIPLIER[cUnit]);
    let { r1, r2 } = computeResistors(chosenCapFarads);

    if (r1 < 200 || r2 < 200 || r1 > 1e6 || r2 > 1e6) {
      // Pick the standard capacitor that brings geometric mean of (R1, R2) closest to ~10 kΩ
      let bestScore = Infinity;
      for (const cap of STANDARD_CAPS) {
        const cand = computeResistors(cap.farads);
        const geoMean = Math.sqrt(Math.max(1, cand.r1) * Math.max(1, cand.r2));
        const score = Math.abs(Math.log10(geoMean / 10000));
        if (score < bestScore) {
          bestScore = score;
          chosenCapVal = cap.val;
          chosenCapUnit = cap.unit;
          chosenCapFarads = cap.farads;
          r1 = cand.r1;
          r2 = cand.r2;
        }
      }
      setCValue(chosenCapVal);
      setCUnit(chosenCapUnit);
    }

    const r1Formatted = ohmsToUnitVal(r1);
    const r2Formatted = ohmsToUnitVal(r2);
    setR1Value(r1Formatted.val);
    setR1Unit(r1Formatted.unit);
    setR2Value(r2Formatted.val);
    setR2Unit(r2Formatted.unit);
  };

  // Inverse RC Solver for Monostable Pulse Width (in ms): t_p = ln(3) * R1 * C1
  const applyTargetPulseMs = (pulseMs: number) => {
    const tPulseSec = Math.min(3600, Math.max(1e-6, pulseMs / 1000));
    const ln3 = Math.log(3);

    let chosenCapVal = cValue;
    let chosenCapUnit = cUnit;
    let chosenCapFarads = Math.max(1e-15, cValue * CAP_MULTIPLIER[cUnit]);
    let r1 = tPulseSec / (ln3 * chosenCapFarads);

    if (r1 < 200 || r1 > 1e6) {
      let bestScore = Infinity;
      for (const cap of STANDARD_CAPS) {
        const candR1 = tPulseSec / (ln3 * cap.farads);
        const score = Math.abs(Math.log10(Math.max(1, candR1) / 15000));
        if (score < bestScore) {
          bestScore = score;
          chosenCapVal = cap.val;
          chosenCapUnit = cap.unit;
          chosenCapFarads = cap.farads;
          r1 = candR1;
        }
      }
      setCValue(chosenCapVal);
      setCUnit(chosenCapUnit);
    }

    const r1Formatted = ohmsToUnitVal(r1);
    setR1Value(r1Formatted.val);
    setR1Unit(r1Formatted.unit);
  };

  const handleApplyToSchematic = () => {
    // Auto-bump simSpeed if the target frequency is faster than current simSpeed allows
    let targetSpeed = simSpeed;
    if (topology === 'astable' && calc.freq > 0) {
      const minRequiredSpeed = Math.ceil(calc.freq * 2);
      if (targetSpeed < minRequiredSpeed) {
        targetSpeed = Math.min(4000, Math.max(minRequiredSpeed, 2000));
        setSimSpeed(targetSpeed);
      }
    }

    const highTicks = Math.max(1, Math.round(calc.tHigh * targetSpeed));
    const lowTicks = Math.max(1, Math.round(calc.tLow * targetSpeed));
    const pulseTicks = Math.max(1, Math.round(calc.tHigh * targetSpeed));

    const propsToSave = {
      ne555Mode: topology,
      vcc,
      r1Value,
      r1Unit,
      r2Value,
      r2Unit,
      cValue,
      cUnit,
      bypassDiode,
      highTicks,
      lowTicks,
      pulseTicks,
    };

    if (activeChip) {
      updateNodeProperties(activeChip.id, propsToSave);
      setStatusToast(
        `Applied to ${activeChip.properties?.label || 'NE555'} (${
          topology === 'astable'
            ? `${formatFreq(calc.freq)}, ${highTicks}T/${lowTicks}T`
            : topology === 'monostable'
            ? `One-Shot ${formatTime(calc.tHigh)} (${pulseTicks}T)`
            : 'Bistable Latch'
        })`
      );
      setTimeout(() => {
        setAppMode('schematic');
      }, 450);
    } else {
      startPlacingNode('NE555');
      const newId = useSimulatorStore.getState().placingNodeId;
      if (newId) {
        useSimulatorStore.getState().updateNodeProperties(newId, propsToSave);
      }
      setAppMode('schematic');
    }
  };

  const vThStr = calc.vTh.toFixed(2);
  const vTrStr = calc.vTr.toFixed(2);
  const vCapStr = liveState.vCap.toFixed(2);
  const isOutHigh = liveState.latchQ === 1;
  const capFillRatio = Math.min(1, Math.max(0, liveState.vCap / Math.max(0.1, vcc)));
  const capBarMaxH = 42;
  const capBarH = Math.max(2, Math.round(capFillRatio * capBarMaxH));

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-100 dark:bg-slate-900 overflow-hidden select-none">
      {/* Compact Top Toolbar */}
      <div className="h-11 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 flex items-center justify-between gap-3 shrink-0">
        {/* Left: Presets Menu & Target IC Selector */}
        <div className="flex items-center gap-2.5 min-w-0" ref={menuRef}>
          {/* Presets Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOpenPresets((v) => !v)}
              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-200 text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            >
              <span>Presets</span>
              <span className="text-[10px] opacity-70">▾</span>
            </button>
            {openPresets && (
              <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-slate-800 rounded-md shadow-lg border border-gray-200 dark:border-slate-700 py-1 z-50 text-xs">
                {[
                  {
                    name: '1 Hz Heartbeat Blink',
                    sub: 'Astable • R1=10kΩ, R2=68kΩ, C1=10µF',
                    r1: 10,
                    r1u: 'kΩ' as ResUnit,
                    r2: 68,
                    r2u: 'kΩ' as ResUnit,
                    c: 10,
                    cu: 'µF' as CapUnit,
                    diode: false,
                    mode: 'astable' as const,
                  },
                  {
                    name: '62.5 Hz (16 ms Debounce Clock)',
                    sub: 'Astable • R1=10kΩ, R2=11.5kΩ, C1=1µF',
                    r1: 10,
                    r1u: 'kΩ' as ResUnit,
                    r2: 11.5,
                    r2u: 'kΩ' as ResUnit,
                    c: 1,
                    cu: 'µF' as CapUnit,
                    diode: false,
                    mode: 'astable' as const,
                  },
                  {
                    name: '1 kHz System Clock (50% w/ Diode)',
                    sub: 'Astable • R1=1.03kΩ, R2=1.44kΩ, C1=1µF, D1 (Vf=0.65V)',
                    r1: 1.03,
                    r1u: 'kΩ' as ResUnit,
                    r2: 1.44,
                    r2u: 'kΩ' as ResUnit,
                    c: 1,
                    cu: 'µF' as CapUnit,
                    diode: true,
                    mode: 'astable' as const,
                  },
                  {
                    name: '16 ms Debounce One-Shot',
                    sub: 'Monostable • R1=14.5kΩ, C1=1µF',
                    r1: 14.5,
                    r1u: 'kΩ' as ResUnit,
                    r2: 10,
                    r2u: 'kΩ' as ResUnit,
                    c: 1,
                    cu: 'µF' as CapUnit,
                    diode: false,
                    mode: 'monostable' as const,
                  },
                  {
                    name: '2 Sec Display Hold Timer',
                    sub: 'Monostable • R1=182kΩ, C1=10µF',
                    r1: 182,
                    r1u: 'kΩ' as ResUnit,
                    r2: 10,
                    r2u: 'kΩ' as ResUnit,
                    c: 10,
                    cu: 'µF' as CapUnit,
                    diode: false,
                    mode: 'monostable' as const,
                  },
                ].map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setTopology(p.mode);
                      setR1Value(p.r1);
                      setR1Unit(p.r1u);
                      setR2Value(p.r2);
                      setR2Unit(p.r2u);
                      setCValue(p.c);
                      setCUnit(p.cu);
                      setBypassDiode(p.diode);
                      setOpenPresets(false);
                    }}
                    className="w-full text-left px-3 py-2 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex flex-col"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-[10px] text-gray-400 dark:text-slate-400 font-mono">
                      {p.sub}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target IC Selector */}
          <div className="flex items-center gap-1.5 border-l border-gray-200 dark:border-slate-700 pl-3">
            <Cpu size={14} className="text-gray-400" />
            <span className="text-xs text-gray-400 dark:text-slate-400">IC:</span>
            {ne555Nodes.length === 0 ? (
              <span className="text-xs text-gray-500 dark:text-slate-400">
                None on schematic (Apply will place new NE555)
              </span>
            ) : (
              <select
                value={activeChip?.id || ''}
                onChange={(e) => setSelectedChipId(e.target.value)}
                className="bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-200 text-xs font-medium rounded px-2 py-1 border border-gray-200 dark:border-slate-600 focus:outline-none"
              >
                {ne555Nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.properties?.label || 'NE555'} (#{n.id.slice(0, 5)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {statusToast && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
              ✓ {statusToast}
            </span>
          )}
        </div>

        {/* Right: Play/Step/Reset Controls, Inside IC X-Ray Toggle & Apply */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-gray-100 dark:bg-slate-900 p-0.5 rounded-md border border-gray-200 dark:border-slate-700">
            <button
              onClick={() => setIsRunningPreview((v) => !v)}
              className={`px-2 py-1 text-xs font-medium rounded flex items-center gap-1 transition-colors ${
                isRunningPreview
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
              title={isRunningPreview ? 'Pause analog simulation' : 'Resume analog simulation'}
            >
              {isRunningPreview ? <Pause size={12} /> : <Play size={12} />}
              <span>{isRunningPreview ? 'Running' : 'Paused'}</span>
            </button>
            <button
              onClick={() => {
                setIsRunningPreview(false);
                stepPhysics(0.08);
              }}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 flex items-center gap-1"
              title="Step analog simulation forward"
            >
              <StepForward size={12} />
            </button>
            <button
              onClick={handleResetCap}
              className="px-2 py-1 text-xs text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
              title="Discharge C1 to 0V and reset waveform"
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {/* Simple / Detailed Schematic Toggle */}
          <div className="flex items-center bg-gray-100 dark:bg-slate-900 p-0.5 rounded-md border border-gray-200 dark:border-slate-700 text-xs font-medium">
            <button
              type="button"
              onClick={() => setDetailedView(false)}
              className={`px-2.5 py-1 rounded transition-colors ${
                !detailedView
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              Simple View
            </button>
            <button
              type="button"
              onClick={() => setDetailedView(true)}
              className={`px-2.5 py-1 rounded transition-colors ${
                detailedView
                  ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
              }`}
            >
              Detailed View
            </button>
          </div>

          <button
            onClick={handleApplyToSchematic}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-medium rounded transition-colors flex items-center gap-1.5"
            title="Save configuration and timing ticks to the NE555 chip on the schematic"
          >
            <Check size={13} />
            <span>{activeChip ? 'Apply to Schematic' : 'Place on Schematic'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Split: Left Parameters Panel + Right Circuit & Bottom Oscilloscope */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Mode Selector, Calculated Readout & RC Inputs/Sliders */}
        <div className="w-80 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col overflow-y-auto shrink-0 p-4 space-y-4">
          {/* 1. Operating Mode Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-1.5">
              Operating Mode
            </label>
            <div className="grid grid-cols-3 gap-1 bg-gray-100 dark:bg-slate-900 p-1 rounded-md">
              {(
                [
                  { id: 'astable', label: 'Astable' },
                  { id: 'monostable', label: 'Monostable' },
                  { id: 'bistable', label: 'Bistable' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setTopology(m.id)}
                  className={`py-1 text-xs font-medium rounded transition-colors ${
                    topology === m.id
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Calculated Frequency, Duty Cycle & Period Readout Card (Editable Inverse Solver) */}
          <div className="bg-slate-900 text-slate-100 rounded-lg p-3 space-y-2 font-mono text-xs border border-slate-700">
            {topology === 'astable' ? (
              <>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400">Frequency:</span>
                  <div className="flex items-center gap-1">
                    <FloatInput
                      value={Number(calc.freq.toFixed(2))}
                      onChange={(newHz) => applyTargetFreqAndDuty(newHz, calc.duty)}
                      min={0.05}
                      max={500000}
                      debounceMs={450}
                      className="w-20 bg-slate-800 border border-slate-600 focus:border-emerald-400 rounded px-1.5 py-0.5 text-right font-mono font-bold text-emerald-400 text-xs focus:outline-none"
                    />
                    <span className="text-emerald-400 font-bold text-xs w-5">Hz</span>
                  </div>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400">Duty Cycle:</span>
                  <div className="flex items-center gap-1">
                    <FloatInput
                      value={Number(calc.duty.toFixed(1))}
                      onChange={(newDuty) => applyTargetFreqAndDuty(calc.freq, newDuty)}
                      min={5}
                      max={99}
                      debounceMs={450}
                      className="w-20 bg-slate-800 border border-slate-600 focus:border-emerald-400 rounded px-1.5 py-0.5 text-right font-mono font-bold text-white text-xs focus:outline-none"
                    />
                    <span className="text-slate-300 font-bold text-xs w-5">%</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Period (T):</span>
                  <span>{formatTime(calc.period)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-800 text-[11px]">
                  <div>
                    <span className="text-slate-400">t_HIGH: </span>
                    <span className="text-amber-300">{formatTime(calc.tHigh)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400">t_LOW: </span>
                    <span className="text-cyan-300">{formatTime(calc.tLow)}</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Sim (@ {simSpeed} Hz):</span>
                  <span className="text-slate-200 font-semibold">
                    {calc.highTicks}T High / {calc.lowTicks}T Low
                  </span>
                </div>
              </>
            ) : topology === 'monostable' ? (
              <>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-400">Pulse (t_p):</span>
                  <div className="flex items-center gap-1">
                    <FloatInput
                      value={Number((calc.tHigh * 1000).toFixed(2))}
                      onChange={(newMs) => applyTargetPulseMs(newMs)}
                      min={0.01}
                      max={100000}
                      debounceMs={450}
                      className="w-20 bg-slate-800 border border-slate-600 focus:border-emerald-400 rounded px-1.5 py-0.5 text-right font-mono font-bold text-emerald-400 text-xs focus:outline-none"
                    />
                    <span className="text-emerald-400 font-bold text-xs w-5">ms</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Formula:</span>
                  <span className="text-slate-300">1.1 × R1 × C1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Trigger Threshold:</span>
                  <span className="text-cyan-300">&lt; {vTrStr} V (Pin 2)</span>
                </div>
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Sim (@ {simSpeed} Hz):</span>
                  <span className="text-slate-200 font-semibold">
                    {calc.pulseTicks} Ticks One-Shot
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between items-baseline">
                  <span className="text-slate-400">Mode:</span>
                  <span className="text-emerald-400 font-bold">SR Latch / Schmitt</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">SET (Pin 2 TRIG&apos;):</span>
                  <span className="text-cyan-300">Active LOW (&lt; {vTrStr}V)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RESET (Pin 4 RST&apos;):</span>
                  <span className="text-rose-300">Active LOW (&lt; 0.7V)</span>
                </div>
              </>
            )}
          </div>

          {/* 3. External RC Network Inputs + Sliders */}
          {topology !== 'bistable' && (
            <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-slate-700">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                RC Components
              </label>

              {/* R1 */}
              <div className="bg-gray-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-gray-700 dark:text-slate-200">
                    R1 <span className="text-gray-400 font-normal">(VCC → Pin 7)</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <FloatInput
                      value={r1Value}
                      onChange={setR1Value}
                      className="w-16 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <select
                      value={r1Unit}
                      onChange={(e) => setR1Unit(e.target.value as ResUnit)}
                      className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:text-slate-200"
                    >
                      <option value="Ω">Ω</option>
                      <option value="kΩ">kΩ</option>
                      <option value="MΩ">MΩ</option>
                    </select>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={500}
                  step={1}
                  value={Math.min(500, Math.max(1, Math.round(r1Value)))}
                  onChange={(e) => setR1Value(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* R2 (Astable only) */}
              {topology === 'astable' && (
                <div className="bg-gray-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-gray-700 dark:text-slate-200">
                      R2 <span className="text-gray-400 font-normal">(Pin 7 → Pin 6/2)</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <FloatInput
                        value={r2Value}
                        onChange={setR2Value}
                        className="w-16 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <select
                        value={r2Unit}
                        onChange={(e) => setR2Unit(e.target.value as ResUnit)}
                        className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:text-slate-200"
                      >
                        <option value="Ω">Ω</option>
                        <option value="kΩ">kΩ</option>
                        <option value="MΩ">MΩ</option>
                      </select>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={500}
                    step={1}
                    value={Math.min(500, Math.max(1, Math.round(r2Value)))}
                    onChange={(e) => setR2Value(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bypassDiode}
                        onChange={(e) => setBypassDiode(e.target.checked)}
                        className="rounded border-gray-300 text-emerald-600"
                      />
                      <span>Bypass D1 (Vf≈0.65V)</span>
                    </label>
                    {bypassDiode && (
                      <button
                        type="button"
                        onClick={() => {
                          const vChargeTarget = Math.max(calc.vTh + 0.1, vcc - DIODE_VF);
                          const chargeLn = Math.log(
                            (vChargeTarget - calc.vTr) / (vChargeTarget - calc.vTh)
                          );
                          const ratio = Math.LN2 / chargeLn;
                          const r2Ohms = r2Value * RES_MULTIPLIER[r2Unit];
                          const targetR1InR1Unit = (r2Ohms * ratio) / RES_MULTIPLIER[r1Unit];
                          setR1Value(Number(targetR1InR1Unit.toFixed(2)));
                        }}
                        title="Compensate R1 for diode voltage drop (Vf = 0.65V) at current VCC to get exact 50.0% duty cycle"
                        className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 rounded transition-colors"
                      >
                        Match R1 for 50%
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* C1 */}
              <div className="bg-gray-50 dark:bg-slate-900/60 p-2.5 rounded-lg border border-gray-200 dark:border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-gray-700 dark:text-slate-200">
                    C1 <span className="text-gray-400 font-normal">(Pin 6/2 → GND)</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <FloatInput
                      value={cValue}
                      onChange={setCValue}
                      className="w-16 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <select
                      value={cUnit}
                      onChange={(e) => setCUnit(e.target.value as CapUnit)}
                      className="bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded px-1.5 py-0.5 text-xs font-mono text-gray-700 dark:text-slate-200"
                    >
                      <option value="pF">pF</option>
                      <option value="nF">nF</option>
                      <option value="µF">µF</option>
                    </select>
                  </div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={500}
                  step={1}
                  value={Math.min(500, Math.max(1, Math.round(cValue)))}
                  onChange={(e) => setCValue(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>
            </div>
          )}

          {/* 4. Supply Voltage & Interactive Pin Triggers */}
          <div className="space-y-2.5 pt-2 border-t border-gray-200 dark:border-slate-700 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-600 dark:text-slate-300">VCC Supply</span>
              <span className="font-mono text-[11px] text-gray-400">
                V_TH={vThStr}V / V_TR={vTrStr}V
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 bg-gray-100 dark:bg-slate-900 p-1 rounded-md">
              {[5.0, 9.0, 12.0, 15.0].map((v) => (
                <button
                  key={v}
                  onClick={() => setVcc(v)}
                  className={`py-1 font-mono font-medium rounded transition-colors ${
                    vcc === v
                      ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                      : 'text-gray-500 dark:text-slate-400'
                  }`}
                >
                  {v}V
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handlePulseTrig}
                className={`py-1.5 px-2 border rounded font-medium transition-colors ${
                  liveState.trigPulsed
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                }`}
              >
                Pulse TRIG&apos; (Pin 2)
              </button>
              <button
                type="button"
                onClick={handlePulseRst}
                className={`py-1.5 px-2 border rounded font-medium transition-colors ${
                  liveState.rstPulsed
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 border-rose-500/30'
                }`}
              >
                Pulse RST&apos; (Pin 4)
              </button>
            </div>
          </div>
        </div>

        {/* Right Area: Simple View or Detailed KiCad Schematic */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 dark:bg-slate-950 relative">
          <div className="flex-1 flex items-center justify-center p-6 overflow-hidden">
            {!detailedView ? (
              /* SIMPLE VIEW: Minimalist NE555 block + R1, R2, C1 */
              <svg viewBox="0 0 640 340" className="w-full h-full max-w-[680px] max-h-[380px]">
                {/* VCC & GND Rails */}
                <line x1="120" y1="30" x2="360" y2="30" stroke="#ef4444" strokeWidth="2.5" />
                <text x="108" y="34" className="fill-red-500 font-mono text-xs font-bold" textAnchor="end">
                  +{vcc}V
                </text>

                <line x1="120" y1="310" x2="360" y2="310" stroke="#64748b" strokeWidth="2.5" />
                <text x="108" y="314" className="fill-slate-400 font-mono text-xs font-bold" textAnchor="end">
                  GND
                </text>

                {topology !== 'bistable' && (
                  <>
                    {/* R1 */}
                    <line x1="140" y1="30" x2="140" y2="62" stroke="#64748b" strokeWidth="2" />
                    <rect
                      x="120"
                      y="62"
                      width="40"
                      height="56"
                      rx="6"
                      className="fill-white dark:fill-slate-900 stroke-blue-500"
                      strokeWidth="2"
                    />
                    <text x="140" y="87" className="fill-blue-500 font-mono text-xs font-bold" textAnchor="middle">
                      R1
                    </text>
                    <text x="140" y="104" className="fill-slate-400 font-mono text-[10px]" textAnchor="middle">
                      {r1Value}{r1Unit}
                    </text>

                    {/* Wire to Pin 7 (DISCH) */}
                    <line x1="140" y1="118" x2="140" y2="152" stroke="#64748b" strokeWidth="2" />
                    <circle cx="140" cy="135" r="4" fill="#3b82f6" />
                    <line x1="140" y1="135" x2="270" y2="135" stroke="#3b82f6" strokeWidth="2" />

                    {/* R2 (Astable) or Direct Link (Monostable) */}
                    {topology === 'astable' ? (
                      <>
                        <rect
                          x="120"
                          y="152"
                          width="40"
                          height="56"
                          rx="6"
                          className="fill-white dark:fill-slate-900 stroke-blue-500"
                          strokeWidth="2"
                        />
                        <text x="140" y="177" className="fill-blue-500 font-mono text-xs font-bold" textAnchor="middle">
                          R2
                        </text>
                        <text x="140" y="194" className="fill-slate-400 font-mono text-[10px]" textAnchor="middle">
                          {r2Value}{r2Unit}
                        </text>
                        {bypassDiode && (
                          <g>
                            <line x1="140" y1="144" x2="96" y2="144" stroke="#10b981" strokeWidth="1.5" />
                            <line x1="96" y1="144" x2="96" y2="214" stroke="#10b981" strokeWidth="1.5" />
                            <line x1="96" y1="214" x2="140" y2="214" stroke="#10b981" strokeWidth="1.5" />
                            <polygon points="89,174 103,174 96,186" fill="#10b981" />
                            <line x1="89" y1="186" x2="103" y2="186" stroke="#10b981" strokeWidth="2" />
                            <text x="82" y="183" className="fill-emerald-500 font-mono text-[9px] font-bold" textAnchor="end">
                              D1
                            </text>
                          </g>
                        )}
                      </>
                    ) : (
                      <line x1="140" y1="152" x2="140" y2="208" stroke="#f59e0b" strokeWidth="2.5" />
                    )}

                    {/* Wire to Pin 6 (THR) & Pin 2 (TRIG) */}
                    <line x1="140" y1="208" x2="140" y2="250" stroke="#f59e0b" strokeWidth="2.5" />
                    <circle cx="140" cy="226" r="4.5" fill="#f59e0b" />
                    {topology === 'astable' ? (
                      <>
                        <line x1="140" y1="226" x2="270" y2="226" stroke="#f59e0b" strokeWidth="2" />
                        <line x1="205" y1="226" x2="205" y2="180" stroke="#f59e0b" strokeWidth="2" />
                        <line x1="205" y1="180" x2="270" y2="180" stroke="#f59e0b" strokeWidth="2" />
                      </>
                    ) : (
                      <>
                        <line x1="140" y1="180" x2="270" y2="180" stroke="#f59e0b" strokeWidth="2" />
                        <line x1="190" y1="226" x2="270" y2="226" stroke="#06b6d4" strokeWidth="2" />
                        <text x="184" y="230" className="fill-cyan-500 font-mono text-[10px] font-bold" textAnchor="end">
                          TRIG&apos; IN
                        </text>
                      </>
                    )}

                    {/* Capacitor C1 */}
                    <line x1="116" y1="250" x2="164" y2="250" stroke="#10b981" strokeWidth="4" />
                    <line x1="116" y1="262" x2="164" y2="262" stroke="#10b981" strokeWidth="4" />
                    <text x="104" y="256" className="fill-emerald-500 font-mono text-xs font-bold" textAnchor="end">
                      C1 ({cValue}{cUnit})
                    </text>
                    <text x="104" y="270" className="fill-amber-500 font-mono text-[10px] font-bold" textAnchor="end">
                      {vCapStr}V
                    </text>

                    {/* Live Charge Gauge Bar */}
                    <rect
                      x="174"
                      y="236"
                      width="14"
                      height="44"
                      rx="3"
                      className="fill-slate-200 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600"
                    />
                    <rect
                      x="175"
                      y={279 - capBarH}
                      width="12"
                      height={capBarH}
                      rx="2"
                      fill="#10b981"
                    />
                    <line x1="140" y1="262" x2="140" y2="310" stroke="#64748b" strokeWidth="2" />
                  </>
                )}

                {/* Clean NE555 IC Body */}
                <line x1="360" y1="30" x2="360" y2="85" stroke="#ef4444" strokeWidth="2" />
                <line x1="360" y1="265" x2="360" y2="310" stroke="#64748b" strokeWidth="2" />

                <rect
                  x="270"
                  y="85"
                  width="180"
                  height="180"
                  rx="12"
                  className="fill-white dark:fill-slate-900 stroke-slate-700 dark:stroke-slate-400"
                  strokeWidth="2.5"
                />
                <text x="360" y="162" className="fill-slate-800 dark:fill-slate-100 font-sans text-xl font-bold" textAnchor="middle">
                  NE555
                </text>
                <text x="360" y="182" className="fill-emerald-500 font-mono text-xs font-semibold" textAnchor="middle">
                  {topology.toUpperCase()}
                </text>
                <text x="360" y="200" className="fill-slate-400 font-mono text-[10px]" textAnchor="middle">
                  {topology === 'astable' ? formatFreq(calc.freq) : topology === 'monostable' ? formatTime(calc.tHigh) : 'LATCH'}
                </text>

                {/* Pin Labels inside IC */}
                <g className="font-mono text-[11px] fill-slate-500 dark:fill-slate-400">
                  <text x="360" y="104" textAnchor="middle">8 VCC</text>
                  <text x="360" y="255" textAnchor="middle">1 GND</text>
                  <text x="282" y="139">7 DISCH</text>
                  <text x="282" y="184">6 THR</text>
                  <text x="282" y="230">2 TRIG&apos;</text>
                  <text x="438" y="184" textAnchor="end">OUT 3</text>
                </g>

                {/* Output Pin 3 Wire & Live Pulse Badge */}
                <line
                  x1="450"
                  y1="180"
                  x2="550"
                  y2="180"
                  stroke={isOutHigh ? '#10b981' : '#64748b'}
                  strokeWidth="3"
                />
                <circle
                  cx="562"
                  cy="180"
                  r="10"
                  fill={isOutHigh ? '#10b981' : '#334155'}
                />
                <text x="562" y="208" className="fill-slate-500 dark:fill-slate-300 font-mono text-xs font-bold" textAnchor="middle">
                  {isOutHigh ? `${vcc}V (HIGH)` : '0V (LOW)'}
                </text>
              </svg>
            ) : (
              /* DETAILED VIEW: KiCad / Datasheet Engineering Schematic */
              <svg
                viewBox="0 0 840 470"
                className="w-full h-full max-w-[920px] max-h-[520px] rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs"
              >
                <defs>
                {/* Arrow Markers for Current Loops */}
                <marker
                  id="arrowCharge"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#10b981" />
                </marker>
                <marker
                  id="arrowDischarge"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="5.5"
                  markerHeight="5.5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#06b6d4" />
                </marker>
              </defs>

              {/* Inner Schematic Drawing Frame */}
              <rect
                x="14"
                y="14"
                width="812"
                height="442"
                rx="6"
                fill="none"
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1.5"
              />

              {/* ==================== POWER RAILS (+VCC & GND) ==================== */}
              {/* +VCC Top Rail */}
              <line x1="90" y1="46" x2="620" y2="46" stroke="#ef4444" strokeWidth="2.5" />
              <circle cx="90" cy="46" r="4" fill="#ef4444" />
              <text
                x="78"
                y="50"
                className="fill-red-500 font-mono text-xs font-bold"
                textAnchor="end"
              >
                +VCC ({vcc.toFixed(1)}V)
              </text>

              {/* GND Bottom Rail */}
              <line x1="90" y1="416" x2="720" y2="416" stroke="#64748b" strokeWidth="2.5" />
              <circle cx="90" cy="416" r="4" fill="#64748b" />
              <text
                x="78"
                y="420"
                className="fill-slate-500 dark:fill-slate-400 font-mono text-xs font-bold"
                textAnchor="end"
              >
                0V (GND)
              </text>
              {/* Standard Earth Ground Symbol ⏚ at bottom center */}
              <line x1="410" y1="416" x2="410" y2="430" stroke="#64748b" strokeWidth="2" />
              <line x1="396" y1="430" x2="424" y2="430" stroke="#64748b" strokeWidth="2" />
              <line x1="401" y1="436" x2="419" y2="436" stroke="#64748b" strokeWidth="2" />
              <line x1="406" y1="442" x2="414" y2="442" stroke="#64748b" strokeWidth="2" />

              {/* ==================== LEFT: RC TIMING NETWORK ==================== */}
              {topology !== 'bistable' && (
                <>
                  {/* Node junction on +VCC for R1 */}
                  <circle cx="190" cy="46" r="3.5" fill="#ef4444" />
                  <line x1="190" y1="46" x2="190" y2="74" stroke="#64748b" strokeWidth="2" />

                  {/* R1: IEEE Zig-Zag Resistor Symbol (y = 74..134) */}
                  <polyline
                    points="190,74 200,79 180,89 200,99 180,109 200,119 180,129 190,134"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <text
                    x="212"
                    y="98"
                    className="fill-blue-600 dark:fill-blue-400 font-mono text-xs font-bold"
                  >
                    R1
                  </text>
                  <text
                    x="212"
                    y="114"
                    className="fill-slate-600 dark:fill-slate-300 font-mono text-[11px] font-semibold"
                  >
                    {r1Value} {r1Unit}
                  </text>

                  {/* Wire from R1 to Pin 7 (DIS) Junction (y = 160) */}
                  <line x1="190" y1="134" x2="190" y2="184" stroke="#64748b" strokeWidth="2" />
                  <circle cx="190" cy="160" r="4" fill="#3b82f6" />
                  <line x1="190" y1="160" x2="340" y2="160" stroke="#3b82f6" strokeWidth="2" />

                  {topology === 'astable' ? (
                    <>
                      {/* R2: IEEE Zig-Zag Resistor Symbol (y = 184..244) */}
                      <polyline
                        points="190,184 200,189 180,199 200,209 180,219 200,229 180,239 190,244"
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                      />
                      <text
                        x="212"
                        y="208"
                        className="fill-blue-600 dark:fill-blue-400 font-mono text-xs font-bold"
                      >
                        R2
                      </text>
                      <text
                        x="212"
                        y="224"
                        className="fill-slate-600 dark:fill-slate-300 font-mono text-[11px] font-semibold"
                      >
                        {r2Value} {r2Unit}
                      </text>

                      {/* Optional D1 Bypass Diode (1N4148) across R2 */}
                      {bypassDiode && (
                        <g>
                          <circle cx="190" cy="172" r="3" fill="#10b981" />
                          <circle cx="190" cy="256" r="3" fill="#10b981" />
                          <polyline
                            points="190,172 122,172 122,256 190,256"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="1.8"
                          />
                          {/* Diode Triangle + Cathode Bar */}
                          <polygon
                            points="112,204 132,204 122,222"
                            className="fill-emerald-500/25 stroke-emerald-500"
                            strokeWidth="2"
                          />
                          <line
                            x1="111"
                            y1="222"
                            x2="133"
                            y2="222"
                            stroke="#10b981"
                            strokeWidth="2.5"
                          />
                          <text
                            x="104"
                            y="210"
                            className="fill-emerald-600 dark:fill-emerald-400 font-mono text-[10px] font-bold"
                            textAnchor="end"
                          >
                            D1 (1N4148)
                          </text>
                          <text
                            x="104"
                            y="223"
                            className="fill-slate-400 font-mono text-[9px]"
                            textAnchor="end"
                          >
                            Vf ≈ 0.65V
                          </text>
                        </g>
                      )}

                      {/* Wire from R2 to Pin 6 (THR) & Pin 2 (TRIG') Junctions */}
                      <line x1="190" y1="244" x2="190" y2="332" stroke="#f59e0b" strokeWidth="2.2" />
                      {/* Pin 6 (THR) & Pin 2 (TRIG') tied together in Astable */}
                      <circle cx="190" cy="285" r="4" fill="#f59e0b" />
                      <line x1="190" y1="285" x2="340" y2="285" stroke="#f59e0b" strokeWidth="2" />
                      <circle cx="268" cy="285" r="3.5" fill="#f59e0b" />
                      <polyline
                        points="268,285 268,222 340,222"
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2"
                      />
                    </>
                  ) : (
                    <>
                      {/* Monostable: R1 connects directly to Pin 6 (THR) and C1 */}
                      <line x1="190" y1="184" x2="190" y2="332" stroke="#f59e0b" strokeWidth="2.2" />
                      <circle cx="190" cy="222" r="4" fill="#f59e0b" />
                      <line x1="190" y1="222" x2="340" y2="222" stroke="#f59e0b" strokeWidth="2" />
                    </>
                  )}

                  {/* Capacitor C1 Symbol (y = 332..346) */}
                  <line x1="164" y1="332" x2="216" y2="332" stroke="#10b981" strokeWidth="4" />
                  {/* Curved negative plate / second plate */}
                  <path
                    d="M 164 348 Q 190 340 216 348"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.5"
                  />
                  {/* Polarity + sign */}
                  <text
                    x="156"
                    y="328"
                    className="fill-emerald-500 font-mono text-xs font-bold"
                    textAnchor="end"
                  >
                    +
                  </text>
                  <line x1="190" y1="345" x2="190" y2="416" stroke="#64748b" strokeWidth="2" />
                  <circle cx="190" cy="416" r="3.5" fill="#64748b" />

                  {/* C1 Label & Live Voltage Readout */}
                  <text
                    x="152"
                    y="342"
                    className="fill-emerald-600 dark:fill-emerald-400 font-mono text-xs font-bold"
                    textAnchor="end"
                  >
                    C1 ({cValue} {cUnit})
                  </text>
                  <text
                    x="152"
                    y="358"
                    className="fill-amber-500 font-mono text-xs font-bold"
                    textAnchor="end"
                  >
                    Vc = {vCapStr}V
                  </text>

                  {/* Vertical Charge Gauge with 1/3 and 2/3 VCC Threshold Marks */}
                  <rect
                    x="228"
                    y="318"
                    width="12"
                    height="44"
                    rx="2"
                    className="fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-700"
                  />
                  <rect
                    x="229"
                    y={361 - capBarH}
                    width="10"
                    height={capBarH}
                    rx="1.5"
                    fill={isOutHigh ? '#10b981' : '#06b6d4'}
                  />
                  {/* 2/3 VCC & 1/3 VCC threshold ticks on gauge */}
                  <line x1="226" y1="333" x2="243" y2="333" stroke="#f59e0b" strokeWidth="1.2" />
                  <text x="246" y="336" className="fill-amber-500 font-mono text-[8px]">
                    2/3 ({vThStr}V)
                  </text>
                  <line x1="226" y1="347" x2="243" y2="347" stroke="#06b6d4" strokeWidth="1.2" />
                  <text x="246" y="350" className="fill-cyan-500 font-mono text-[8px]">
                    1/3 ({vTrStr}V)
                  </text>
                </>
              )}

              {/* ==================== MONOSTABLE / BISTABLE SW_TRIG ON PIN 2 ==================== */}
              {topology !== 'astable' && (
                <g>
                  {/* Pull-up Resistor R_trig (10kΩ) to +VCC */}
                  <circle cx="280" cy="46" r="3.5" fill="#ef4444" />
                  <line x1="280" y1="46" x2="280" y2="232" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" />
                  <rect
                    x="272"
                    y="232"
                    width="16"
                    height="32"
                    rx="2"
                    className="fill-white dark:fill-slate-900 stroke-slate-400"
                    strokeWidth="1.5"
                  />
                  <text x="266" y="251" className="fill-slate-400 font-mono text-[9px]" textAnchor="end">
                    10kΩ
                  </text>
                  <line x1="280" y1="264" x2="280" y2="285" stroke="#06b6d4" strokeWidth="2" />
                  <circle cx="280" cy="285" r="3.5" fill="#06b6d4" />
                  <line x1="280" y1="285" x2="340" y2="285" stroke="#06b6d4" strokeWidth="2" />

                  {/* Clickable Push-Button Switch SW_TRIG to GND */}
                  <line x1="280" y1="285" x2="280" y2="330" stroke="#06b6d4" strokeWidth="2" />
                  <circle cx="280" cy="330" r="3" fill="#06b6d4" />
                  <circle cx="280" cy="362" r="3" fill="#64748b" />
                  <line x1="280" y1="362" x2="280" y2="416" stroke="#64748b" strokeWidth="2" />
                  <circle cx="280" cy="416" r="3.5" fill="#64748b" />

                  <g
                    onClick={handlePulseTrig}
                    className="cursor-pointer"
                  >
                    <rect
                      x="255"
                      y="322"
                      width="46"
                      height="48"
                      rx="4"
                      fill="transparent"
                    />
                    {/* Switch Contacts Blade */}
                    <line
                      x1={liveState.trigPulsed ? 278 : 268}
                      y1="328"
                      x2={liveState.trigPulsed ? 278 : 268}
                      y2="364"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                    />
                    <line
                      x1={liveState.trigPulsed ? 278 : 268}
                      y1="346"
                      x2={liveState.trigPulsed ? 270 : 260}
                      y2="346"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                    />
                    <text
                      x="300"
                      y="349"
                      className="fill-cyan-500 font-mono text-[10px] font-bold"
                    >
                      SW_TRIG
                    </text>
                  </g>
                </g>
              )}

              {/* ==================== CURRENT PATHS (CHARGE & DISCHARGE) ==================== */}
              {/* 1. CHARGE CURRENT LOOP (Active when C1 is charging toward VCC) */}
              {!liveState.rstPulsed && topology !== 'bistable' && isOutHigh && (
                <g>
                  <path
                    d={
                      topology === 'astable' && bypassDiode
                        ? 'M 190 46 L 190 172 L 122 172 L 122 256 L 190 256 L 190 332'
                        : 'M 190 46 L 190 332'
                    }
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3.5"
                    strokeDasharray="8 6"
                    opacity="0.9"
                    markerEnd="url(#arrowCharge)"
                  />
                  <text
                    x={topology === 'astable' && bypassDiode ? 82 : 176}
                    y="152"
                    className="fill-emerald-500 font-mono text-[10px] font-bold"
                    textAnchor="end"
                  >
                    I_chg ↓
                  </text>
                </g>
              )}

              {/* 2. DISCHARGE CURRENT LOOP (Active in Astable when C1 discharges via R2 into Pin 7 → GND) */}
              {!liveState.rstPulsed && topology === 'astable' && !isOutHigh && (
                <g>
                  <path
                    d="M 190 332 L 190 160 L 340 160 L 368 160 L 368 332 L 410 332 L 410 416"
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="3.5"
                    strokeDasharray="8 6"
                    opacity="0.9"
                    markerEnd="url(#arrowDischarge)"
                  />
                  <text
                    x="275"
                    y="150"
                    className="fill-cyan-400 font-mono text-[10px] font-bold"
                    textAnchor="middle"
                  >
                    I_dis → Pin 7
                  </text>
                </g>
              )}

              {/* ==================== CENTER: U1 NE555P 8-PIN IC SYMBOL ==================== */}
              {/* Pin 8 (VCC) Top Stub */}
              <circle cx="410" cy="46" r="3.5" fill="#ef4444" />
              <line x1="410" y1="46" x2="410" y2="115" stroke="#ef4444" strokeWidth="2.2" />
              <text x="402" y="108" className="fill-slate-400 font-mono text-[11px] font-bold" textAnchor="end">
                8
              </text>

              {/* Pin 4 (RST') Top Stub + Pull-up & SW_RST Push-Button */}
              <circle cx="490" cy="46" r="3.5" fill="#ef4444" />
              <line
                x1="490"
                y1="46"
                x2="490"
                y2="105"
                stroke={liveState.rstPulsed ? '#f43f5e' : '#ef4444'}
                strokeWidth="2"
              />
              {/* Active-LOW Inversion Bubble on Pin 4 */}
              <circle
                cx="490"
                cy="110"
                r="4.5"
                className="fill-white dark:fill-slate-900"
                stroke={liveState.rstPulsed ? '#f43f5e' : '#ef4444'}
                strokeWidth="2"
              />
              <text x="480" y="106" className="fill-slate-400 font-mono text-[11px] font-bold" textAnchor="end">
                4
              </text>
              {/* Clickable Reset Badge on Pin 4 */}
              <g onClick={handlePulseRst} className="cursor-pointer">
                <rect
                  x="502"
                  y="68"
                  width="76"
                  height="22"
                  rx="4"
                  className={
                    liveState.rstPulsed
                      ? 'fill-rose-600 stroke-rose-400'
                      : 'fill-slate-100 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-700'
                  }
                  strokeWidth="1.2"
                />
                <text
                  x="540"
                  y="83"
                  className={`font-mono text-[10px] font-bold ${
                    liveState.rstPulsed ? 'fill-white' : 'fill-rose-500 dark:fill-rose-400'
                  }`}
                  textAnchor="middle"
                >
                  {liveState.rstPulsed ? 'RST=0V' : 'SW_RST'}
                </text>
              </g>

              {/* Pin 1 (GND) Bottom Stub */}
              <line x1="410" y1="335" x2="410" y2="416" stroke="#64748b" strokeWidth="2.2" />
              <circle cx="410" cy="416" r="3.5" fill="#64748b" />
              <text x="402" y="352" className="fill-slate-400 font-mono text-[11px] font-bold" textAnchor="end">
                1
              </text>

              {/* Pin 5 (CTRL) Bottom Stub + C2 (10nF Decoupling Capacitor to GND) */}
              <line x1="490" y1="335" x2="490" y2="368" stroke="#a855f7" strokeWidth="2" />
              <text x="482" y="352" className="fill-slate-400 font-mono text-[11px] font-bold" textAnchor="end">
                5
              </text>
              {/* C2 = 10nF Capacitor Symbol */}
              <line x1="474" y1="368" x2="506" y2="368" stroke="#a855f7" strokeWidth="3" />
              <line x1="474" y1="376" x2="506" y2="376" stroke="#a855f7" strokeWidth="3" />
              <line x1="490" y1="376" x2="490" y2="416" stroke="#64748b" strokeWidth="2" />
              <circle cx="490" cy="416" r="3.5" fill="#64748b" />
              <text x="514" y="371" className="fill-purple-500 dark:fill-purple-400 font-mono text-[10px] font-bold">
                C2 (10nF)
              </text>
              <text x="514" y="384" className="fill-slate-400 font-mono text-[9px]">
                V_ctrl = {vThStr}V
              </text>

              {/* Main IC Package Box (x = 340..550, y = 115..335) */}
              <rect
                x="340"
                y="115"
                width="210"
                height="220"
                rx="8"
                className="fill-amber-50/40 dark:fill-slate-900 stroke-slate-800 dark:stroke-slate-300"
                strokeWidth="2.5"
              />
              {/* IC Designator & Part Number */}
              <text
                x="346"
                y="107"
                className="fill-slate-500 dark:fill-slate-400 font-mono text-xs font-bold"
              >
                U1
              </text>
              <text
                x="445"
                y="206"
                className="fill-slate-800 dark:fill-slate-100 font-sans text-2xl font-extrabold tracking-tight"
                textAnchor="middle"
              >
                NE555P
              </text>
              <text
                x="445"
                y="226"
                className="fill-emerald-600 dark:fill-emerald-400 font-mono text-xs font-bold"
                textAnchor="middle"
              >
                {topology.toUpperCase()} MODE
              </text>
              <text
                x="445"
                y="244"
                className="fill-slate-400 font-mono text-[11px]"
                textAnchor="middle"
              >
                {topology === 'astable'
                  ? `${formatFreq(calc.freq)} • ${calc.duty.toFixed(1)}%`
                  : topology === 'monostable'
                  ? `t_p = ${formatTime(calc.tHigh)}`
                  : 'SR Schmitt Trigger'}
              </text>

              {/* Subtle Internal Discharge Transistor Indicator between Pin 7 and Pin 1 */}
              <g opacity="0.85">
                <polyline
                  points="340,160 368,160 368,295"
                  fill="none"
                  stroke={!isOutHigh ? '#06b6d4' : '#475569'}
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                {/* Switch blade showing Pin 7 open/closed to GND */}
                <circle cx="368" cy="295" r="2.5" fill={!isOutHigh ? '#06b6d4' : '#64748b'} />
                <line
                  x1="368"
                  y1="295"
                  x2={!isOutHigh ? 368 : 356}
                  y2="314"
                  stroke={!isOutHigh ? '#06b6d4' : '#64748b'}
                  strokeWidth="2"
                />
                <circle cx="368" cy="316" r="2.5" fill={!isOutHigh ? '#06b6d4' : '#64748b'} />
                <polyline
                  points="368,316 368,328 410,328"
                  fill="none"
                  stroke={!isOutHigh ? '#06b6d4' : '#475569'}
                  strokeWidth="1.5"
                  strokeDasharray="3 2"
                />
                <text
                  x="375"
                  y="309"
                  className={`font-mono text-[9px] font-bold ${
                    !isOutHigh ? 'fill-cyan-400' : 'fill-slate-400'
                  }`}
                >
                  Q_dis:{!isOutHigh ? 'ON' : 'OFF'}
                </text>
              </g>

              {/* Left & Right Pin Numbers (Outside IC) */}
              <g className="font-mono text-[11px] font-bold fill-slate-400">
                <text x="332" y="154" textAnchor="end">7</text>
                <text x="332" y="216" textAnchor="end">6</text>
                <text x="332" y="279" textAnchor="end">2</text>
                <text x="558" y="216">3</text>
              </g>

              {/* All 8 Pin Labels (Inside IC) */}
              <g className="font-mono text-[11px] font-bold fill-slate-600 dark:fill-slate-300">
                <text x="410" y="133" textAnchor="middle">VCC</text>
                <text x="490" y="133" textAnchor="middle">RST&apos;</text>
                <text x="410" y="326" textAnchor="middle">GND</text>
                <text x="490" y="326" textAnchor="middle">CTRL</text>
                <text x="350" y="164">DIS</text>
                <text x="350" y="226">THR</text>
                <text x="350" y="289">TRIG&apos;</text>
                <text x="540" y="226" textAnchor="end">OUT</text>
              </g>

              {/* ==================== RIGHT: PIN 3 OUTPUT STAGE & LED ==================== */}
              {/* Output Wire from Pin 3 (y = 222) */}
              <line
                x1="550"
                y1="222"
                x2="735"
                y2="222"
                stroke={isOutHigh ? '#10b981' : '#64748b'}
                strokeWidth="3"
              />
              <circle cx="645" cy="222" r="4" fill={isOutHigh ? '#10b981' : '#64748b'} />

              {/* Output Current Arrow when HIGH */}
              {isOutHigh && (
                <path
                  d="M 550 222 L 645 222 L 645 360"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeDasharray="7 5"
                  markerEnd="url(#arrowCharge)"
                />
              )}

              {/* Digital Logic Output Probe Terminal */}
              <rect
                x="735"
                y="204"
                width="82"
                height="36"
                rx="6"
                className={
                  isOutHigh
                    ? 'fill-emerald-500/20 stroke-emerald-500'
                    : 'fill-slate-100 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600'
                }
                strokeWidth="2"
              />
              <text
                x="776"
                y="220"
                className={`font-mono text-xs font-bold ${
                  isOutHigh ? 'fill-emerald-500' : 'fill-slate-500 dark:fill-slate-400'
                }`}
                textAnchor="middle"
              >
                {isOutHigh ? 'HIGH (1)' : 'LOW (0)'}
              </text>
              <text
                x="776"
                y="233"
                className="fill-slate-400 font-mono text-[10px]"
                textAnchor="middle"
              >
                {isOutHigh ? `${vcc.toFixed(1)}V` : '0.0V'}
              </text>

              {/* Current-Limiting Resistor R_LED (330Ω) & Output LED to GND */}
              <line x1="645" y1="222" x2="645" y2="252" stroke="#64748b" strokeWidth="2" />
              <polyline
                points="645,252 653,257 637,265 653,273 637,281 653,289 637,297 645,302"
                fill="none"
                stroke="#64748b"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <text x="662" y="276" className="fill-slate-400 font-mono text-[10px] font-bold">
                R_LED
              </text>
              <text x="662" y="288" className="fill-slate-400 font-mono text-[9px]">
                330Ω
              </text>

              <line x1="645" y1="302" x2="645" y2="332" stroke="#64748b" strokeWidth="2" />
              {/* LED Glow Halo when HIGH */}
              {isOutHigh && (
                <circle cx="645" cy="344" r="20" fill="#10b981" opacity="0.22" />
              )}
              {/* LED Schematic Triangle + Cathode Line */}
              <polygon
                points="632,332 658,332 645,354"
                fill={isOutHigh ? '#10b981' : '#334155'}
                stroke={isOutHigh ? '#10b981' : '#64748b'}
                strokeWidth="2"
              />
              <line
                x1="631"
                y1="354"
                x2="659"
                y2="354"
                stroke={isOutHigh ? '#10b981' : '#64748b'}
                strokeWidth="2.5"
              />
              {/* LED Emitted Light Rays ↗ ↗ */}
              <line
                x1="662"
                y1="336"
                x2="674"
                y2="328"
                stroke={isOutHigh ? '#10b981' : '#64748b'}
                strokeWidth="1.6"
              />
              <line
                x1="665"
                y1="346"
                x2="677"
                y2="338"
                stroke={isOutHigh ? '#10b981' : '#64748b'}
                strokeWidth="1.6"
              />
              <text
                x="682"
                y="346"
                className={`font-mono text-[10px] font-bold ${
                  isOutHigh ? 'fill-emerald-500' : 'fill-slate-400'
                }`}
              >
                D_OUT
              </text>

              <line x1="645" y1="354" x2="645" y2="416" stroke="#64748b" strokeWidth="2" />
              <circle cx="645" cy="416" r="3.5" fill="#64748b" />

              {/* Engineering Title Block Stamp (Bottom-Right) */}
              <g transform="translate(675, 424)">
                <text x="140" y="14" className="fill-slate-400 dark:fill-slate-600 font-mono text-[9px]" textAnchor="end">
                  NE555 ANALOG LAB • EDA SCHEMATIC
                </text>
              </g>
            </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
