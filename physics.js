// Pure circuit physics (SI units). No UI code.
export const MATERIALS = [ // resistivity ρ at 20 °C in Ω·m
  ['Silver', 1.59e-8, '#d6d6dc'], ['Copper', 1.68e-8, '#c4803c'], ['Aluminium', 2.65e-8, '#a9a9b0'], ['Iron', 9.71e-8, '#6a6a72'], ['Nichrome', 1.10e-6, '#47474d']];
export const current = (V, R) => V / R;
export const resistance = (rho, L, A) => rho * L / A;
export const powerVI = (V, I) => V * I;
export const heat = (I, R, t) => I * I * R * t;       // joule
export const kWh = (P, hours) => P * hours / 1000;
const ser = (V, R) => { const q = R.reduce((a, b) => a + b, 0), I = V / q; return { Req: q, I, r: R.map(x => ({ R: x, V: I * x, I, P: I * I * x })) }; };
const par = (V, R) => { const g = R.reduce((a, b) => a + 1 / b, 0); return { Req: 1 / g, I: V * g, r: R.map(x => ({ R: x, V, I: V / x, P: V * V / x })) }; };
// mode: 'series' | 'parallel' | 'mixed' (R[0] in series with the parallel group R[1..])
export function solve(mode, V, R) {
  if (mode === 'series' || R.length === 1) return ser(V, R);
  if (mode === 'parallel') return par(V, R);
  const Rp = par(1, R.slice(1)).Req, I = V / (R[0] + Rp), g = par(I * Rp, R.slice(1));
  return { Req: R[0] + Rp, I, r: [{ R: R[0], V: I * R[0], I, P: I * I * R[0] }, ...g.r] };
}
