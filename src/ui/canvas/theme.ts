export const getCanvasTheme = (isDark: boolean) => ({
  gridColor: isDark ? '#334155' : '#cbd5e1', // slate-700 : slate-300
  nodeBg: isDark ? '#1e293b' : '#f8fafc',    // slate-800 : slate-50
  nodeBorder: isDark ? '#475569' : '#475569',// slate-600 : slate-600
  textColor: isDark ? '#f8fafc' : '#1e293b', // slate-50 : slate-800
  inputNodeBg: isDark ? '#064e3b' : '#ecfdf5', // emerald-900 : emerald-50
  inputNodeBorder: isDark ? '#059669' : '#10b981', // emerald-600 : emerald-500
  inputIndicator: isDark ? '#047857' : '#d1fae5',
  outputNodeBg: isDark ? '#7f1d1d' : '#fef2f2', // red-900 : red-50
  outputNodeBorder: isDark ? '#dc2626' : '#ef4444', // red-600 : red-500
  outputIndicator: isDark ? '#b91c1c' : '#fee2e2',
  wireColor: isDark ? '#60a5fa' : '#3b82f6', // blue-400 : blue-500
  selectedWireColor: isDark ? '#fcd34d' : '#f59e0b', // amber-300 : amber-500
  selectedNodeColor: isDark ? '#fcd34d' : '#f59e0b',
  draftWireColor: isDark ? '#94a3b8' : '#94a3b8', // slate-400
  signalHigh: isDark ? '#4ade80' : '#22c55e', // green-400 : green-500
  signalLow: isDark ? '#475569' : '#94a3b8', // slate-600 : slate-400
  pinInputFill: isDark ? '#3b82f6' : '#2563eb', // blue
  pinInputStroke: isDark ? '#1e3a8a' : '#1e3a8a',
  pinOutputFill: isDark ? '#f43f5e' : '#e11d48', // rose
  pinOutputStroke: isDark ? '#881337' : '#881337',
  boardSocketBg: '#171717',
  boardSocketBorder: '#0A0A0A',
  boardIcBg: '#111111',
  boardIcBorder: '#333333',
});
