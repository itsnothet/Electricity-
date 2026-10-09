import * as P from './physics.js';
const TAU = Math.PI * 2;
const $ = (s, e = document) => e.querySelector(s), app = $('#app');
const sh = x => '' + +x.toPrecision(3);
const fmt = x => { const a = Math.abs(x); if (!a) return '0'; if (a >= 1e5 || a < 1e-2) { const [m, e] = x.toExponential(2).split('e'); return `${m}×10<sup>${+e}</sup>`; } return sh(x); };
let S, cur, raf;

/* ---------- canvas helpers ---------- */
function fit(cv) { const d = devicePixelRatio || 1, r = cv.getBoundingClientRect(), w = Math.round(r.width * d), h = Math.round(r.height * d);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.clearRect(0, 0, r.width, r.height); return [c, r.width, r.height]; }
const stars = (c, w, h) => { c.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 34; i++) c.fillRect(((i * 9301 + 49297) % 233280) / 233280 * w, ((i * 7919 + 1237) % 10007) / 10007 * h, 1.2, 1.2); };
const txt = (c, s, x, y, col = '#ccc', al = 'left', f = '12px system-ui') => { c.fillStyle = col; c.textAlign = al; c.font = f; c.fillText(s, x, y); };
const ball = (c, x, y, r, a = '#f3dc9a', b = '#8a6a22') => { const g = c.createRadialGradient(x - r / 3, y - r / 3, r / 6, x, y, r); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const RED = ['#ff8a9a', '#8d1024'];
const arrow = (c, x1, y1, x2, y2, col) => { const a = Math.atan2(y2 - y1, x2 - x1); c.strokeStyle = c.fillStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - 9 * Math.cos(a - .4), y2 - 9 * Math.sin(a - .4)); c.lineTo(x2 - 9 * Math.cos(a + .4), y2 - 9 * Math.sin(a + .4)); c.fill(); };
const earthDisc = (c, x, y, r) => { const g = c.createRadialGradient(x - r / 3, y - r / 3, r / 8, x, y, r); g.addColorStop(0, '#3c3c42'); g.addColorStop(1, '#0a0a0c'); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = 'rgba(201,162,75,.85)'; c.lineWidth = 1.5; c.stroke(); };
const rocket = (c, x, y, dir, s) => { c.save(); c.translate(x, y); if (dir < 0) c.rotate(Math.PI); c.fillStyle = '#e8cf8a'; c.beginPath(); c.moveTo(0, -s); c.lineTo(s * .5, s * .6); c.lineTo(-s * .5, s * .6); c.closePath(); c.fill();
  c.fillStyle = '#b3122a'; c.beginPath(); c.moveTo(-s * .25, s * .6); c.lineTo(s * .25, s * .6); c.lineTo(0, s * 1.2); c.fill(); c.restore(); };
function plot(c, [x0, y0, x1, y1], pts, cur, o) {
  let a = [1 / 0, -1 / 0, 1 / 0, -1 / 0]; for (const [p, q] of pts) a = [Math.min(a[0], p), Math.max(a[1], p), Math.min(a[2], q), Math.max(a[3], q)];
  if (o.zero) { a[2] = Math.min(a[2], 0); a[3] = Math.max(a[3], 0); }
  const X = v => x0 + (v - a[0]) / (a[1] - a[0] || 1) * (x1 - x0), Y = v => y1 - (v - a[2]) / (a[3] - a[2] || 1) * (y1 - y0);
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0, y1); c.lineTo(x1, y1); c.stroke();
  if (o.zero) { c.setLineDash([4, 4]); c.beginPath(); c.moveTo(x0, Y(0)); c.lineTo(x1, Y(0)); c.stroke(); c.setLineDash([]); }
  c.strokeStyle = '#c9a24b'; c.lineWidth = 2; c.beginPath(); pts.forEach(([p, q], i) => i ? c.lineTo(X(p), Y(q)) : c.moveTo(X(p), Y(q))); c.stroke();
  if (cur) { c.setLineDash([3, 4]); c.strokeStyle = 'rgba(255,107,125,.8)'; c.lineWidth = 1; c.beginPath(); c.moveTo(X(cur[0]), y1); c.lineTo(X(cur[0]), Y(cur[1])); c.lineTo(x0, Y(cur[1])); c.stroke(); c.setLineDash([]); ball(c, X(cur[0]), Y(cur[1]), 5, ...RED); }
  txt(c, `${o.xl}: ${sh(a[0])} → ${sh(a[1])}`, x0, y1 + 15, '#999'); txt(c, `${o.yl}  [${sh(a[2])} … ${sh(a[3])}]`, x0 + 4, y0 - 6, '#e8cf8a');
}

/* ---------- control helpers ---------- */
function out(k) { const o = cur.sl.find(o => o.k === k), e = $('#o_' + k); if (e) e.innerHTML = fmt(S.v[k]) + ' ' + o.u; }
function setv(k, v) { S.v[k] = v; const i = $('#i_' + k); if (i) i.value = v; out(k); cur.onset && cur.onset(S, k); }
function sweep(lo, hi, k) { S.auto = !S.auto; S.ph = Math.acos(Math.max(-1, Math.min(1, 1 - 2 * (S.v[k] - lo) / (hi - lo)))); }

/* ---------- circuit drawing ---------- */
function resistor(c, cx, cy, hor, sel, heat, i, R) {
  c.save(); c.translate(cx, cy); if (!hor) c.rotate(Math.PI / 2);
  if (heat > .02) { const g = c.createRadialGradient(0, 0, 2, 0, 0, 34); g.addColorStop(0, `rgba(255,70,60,${.6 * heat})`); g.addColorStop(1, 'rgba(255,70,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.fill(); }
  c.fillStyle = '#0b0b0d'; c.fillRect(-22, -9, 44, 18); c.strokeStyle = sel ? '#f3dc9a' : '#c9a24b'; c.lineWidth = sel ? 3 : 1.8; c.beginPath(); c.moveTo(-22, 0); c.lineTo(-15, 0);
  for (let k = 0; k < 6; k++) c.lineTo(-12 + k * 4.8 + 2.4, k % 2 ? 7 : -7); c.lineTo(15, 0); c.lineTo(22, 0); c.stroke(); c.restore();
  hor ? txt(c, `R${i + 1}`, cx, cy - 15, sel ? '#f3dc9a' : '#bbb', 'center', '11px system-ui') : txt(c, `R${i + 1}`, cx + 14, cy - 3, sel ? '#f3dc9a' : '#bbb', 'left', '11px system-ui');
  txt(c, `${sh(R)}Ω`, hor ? cx : cx + 14, hor ? cy + 22 : cy + 10, '#999', hor ? 'center' : 'left', '10px system-ui');
}
function battery(c, x, y, V) { c.fillStyle = '#0b0b0d'; c.fillRect(x - 14, y - 18, 28, 36); c.strokeStyle = '#e8cf8a'; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 13, y - 6); c.lineTo(x + 13, y - 6); c.stroke();
  c.strokeStyle = '#ff6b7d'; c.lineWidth = 5; c.beginPath(); c.moveTo(x - 6, y + 6); c.lineTo(x + 6, y + 6); c.stroke(); txt(c, '+', x + 17, y - 8, '#e8cf8a', 'left', '13px system-ui'); txt(c, '−', x + 17, y + 14, '#ff8a9a', 'left', '13px system-ui'); txt(c, V + ' V', x, y + 34, '#e8cf8a', 'center', '600 11px system-ui'); }
function layout(S, w, H) {
  const n = S.n, m = S.mode, sol = S.sol, xb = 40, xr = w - 24, yt = H * .3, yb = H * .8, ym = (yt + yb) / 2, wires = [], els = [], bat = { x: xb, y: ym };
  if (m === 'series' || n === 1) { for (let i = 0; i < n; i++) els.push({ i, cx: xb + (xr - xb) * (i + .5) / n, cy: yt, hor: 1 }); wires.push({ p: [[xb, yb], [xb, yt], [xr, yt], [xr, yb], [xb, yb]], I: sol.I }); return { wires, els, bat }; }
  const first = m === 'mixed' ? 1 : 0, k = n - first, x0 = m === 'mixed' ? xb + .3 * (xr - xb) + 10 : xb + 34, br = []; for (let j = 0; j < k; j++) br.push({ i: first + j, x: x0 + (xr - x0) * (j + .5) / k });
  br.forEach(b => els.push({ i: b.i, cx: b.x, cy: ym, hor: 0 })); if (m === 'mixed') els.push({ i: 0, cx: (xb + br[0].x) / 2, cy: yt, hor: 1 });
  wires.push({ p: [[xb, yb], [xb, yt], [br[0].x, yt]], I: sol.I }, { p: [[br[0].x, yb], [xb, yb]], I: sol.I }); let rem = sol.I;
  br.forEach((b, j) => { const Ib = sol.r[b.i].I; wires.push({ p: [[b.x, yt], [b.x, yb]], I: Ib }); rem -= Ib; if (j < k - 1) { const nx = br[j + 1].x, q = Math.max(0, rem); wires.push({ p: [[b.x, yt], [nx, yt]], I: q }, { p: [[nx, yb], [b.x, yb]], I: q }); } });
  return { wires, els, bat };
}
function drawCkt(c, w, H, S) {
  const L = layout(S, w, H), Pm = Math.max(1e-9, ...S.sol.r.map(q => q.P)); c.lineCap = 'round'; c.strokeStyle = 'rgba(232,207,138,.4)'; c.lineWidth = 2;
  L.wires.forEach(q => { c.beginPath(); q.p.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); });
  L.wires.forEach((q, wi) => { const sg = []; let len = 0; for (let k = 1; k < q.p.length; k++) { const d = Math.hypot(q.p[k][0] - q.p[k - 1][0], q.p[k][1] - q.p[k - 1][1]); sg.push(d); len += d; }
    if (q.I < 1e-6 || len < 8) return; S.pp[wi] = ((S.pp[wi] || 0) + S.dt * Math.min(1.2, .08 + .35 * Math.sqrt(q.I)) * 60) % 1e6; c.fillStyle = '#ff5a6e';
    for (let k = 0, n = Math.floor(len / 24); k < n; k++) { let d = (S.pp[wi] + k * 24) % len, s = 0; while (d > sg[s] && s < sg.length - 1) { d -= sg[s]; s++; } const f = d / sg[s], a = q.p[s], b = q.p[s + 1]; c.beginPath(); c.arc(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, 2.6, 0, TAU); c.fill(); } });
  S.dt = 0; L.els.forEach(e => resistor(c, e.cx, e.cy, e.hor, S.sel === e.i, S.sol.r[e.i].P / Pm, e.i, S.R[e.i])); battery(c, L.bat.x, L.bat.y, S.v.V);
}
const base = S => { S.pp = []; S.dt = 0; S.sel = 0; };
const ckLive = S => { const s = S.sol, P0 = s.I * S.v.V, L = [['Battery voltage V', fmt(S.v.V), 'V'], ['Equivalent R', fmt(s.Req), 'Ω'], ['Total current I = V/R', fmt(s.I), 'A'], ['Total power P = VI', fmt(P0), 'W']]; if (S.v.t) L.push(['Heat H = Pt', fmt(P0 * S.v.t), 'J in ' + S.v.t + ' s']);
  s.r.forEach((q, i) => L.push([`R${i + 1} = ${sh(q.R)} Ω${i === S.sel && S.n > 1 ? ' ◀' : ''}`, `${fmt(q.V)} V · ${fmt(q.I)} A`, `P = ${fmt(q.P)} W`])); return L; };
const selR = () => { S.sel = (S.sel + S.n) % S.n; setv('Rv', S.R[S.sel]); };

/* ---------- simulations ---------- */
const SIMS = [
  { id: 'ohm', n: '01', t: 'Ohm’s Law', d: 'Current through a conductor is proportional to the voltage across it, at constant temperature.',
    sl: [{ k: 'V', l: 'Voltage V', min: 0, max: 24, step: .1, val: 6, u: 'V' }, { k: 'R', l: 'Resistance R', min: 1, max: 100, step: 1, val: 20, u: 'Ω' }],
    init: S => { base(S); S.n = 1; S.mode = 'series'; S.R = [S.v.R]; }, step: (S, dt) => { S.dt = dt; },
    draw: (c, w, H, S) => { S.R[0] = S.v.R; S.sol = P.solve('series', S.v.V, [S.v.R]); drawCkt(c, w, H * .46, S); const pts = []; for (let v = 0; v <= 24; v += 1) pts.push([v, v / S.v.R]); plot(c, [46, H * .6, w - 18, H - 28], pts, [S.v.V, S.v.V / S.v.R], { xl: 'V (volt)', yl: 'I (ampere) · slope = 1/R' }); },
    live: S => [['Voltage V', fmt(S.v.V), 'V'], ['Resistance R', fmt(S.v.R), 'Ω'], ['Current I = V/R', fmt(S.v.V / S.v.R), 'A'], ['Power P = VI', fmt(S.v.V * S.v.V / S.v.R), 'W'], ['V / I', fmt(S.v.R), 'Ω (constant)']],
    fx: 'V = IR &nbsp; I = V/R &nbsp; R = V/I', nt: 'Double V → I doubles (straight line through the origin). Double R → I halves. Red dots drift faster when current is larger.' },
  { id: 'builder', n: '02', t: 'Circuit Builder', d: 'Add or remove resistors, switch between series, parallel and mixed, and read every variable.',
    sl: [{ k: 'V', l: 'Battery voltage V', min: 1, max: 24, step: .5, val: 12, u: 'V' }, { k: 'Rv', l: 'Selected resistor value', min: 1, max: 100, step: 1, val: 20, u: 'Ω' }, { k: 't', l: 'Time t', min: 1, max: 600, step: 1, val: 60, u: 's' }],
    ex: [['Series', 'series'], ['Parallel', 'parallel'], ['Mixed', 'mixed']].map(([l, m]) => ({ l, f: () => { S.mode = m; } })).concat([
      { l: '＋ Resistor', f: () => { if (S.n < 6) { S.n++; S.sel = S.n - 1; selR(); } } }, { l: '－ Resistor', f: () => { if (S.n > 1) { S.n--; S.sel = Math.min(S.sel, S.n - 1); selR(); } } }, { l: 'Next resistor ▶', f: () => { S.sel++; selR(); } }]),
    onset: (S, k) => { if (k === 'Rv') S.R[S.sel] = S.v.Rv; },
    init: S => { base(S); S.n = 2; S.R = [20, 30, 40, 50, 60, 70]; S.mode = 'series'; }, step: (S, dt) => { S.dt = dt; },
    draw: (c, w, H, S) => { S.sol = P.solve(S.mode, S.v.V, S.R.slice(0, S.n)); drawCkt(c, w, H, S); txt(c, `${S.mode.toUpperCase()} · ${S.n} resistor${S.n > 1 ? 's' : ''}`, 12, 20, '#e8cf8a', 'left', '600 12px system-ui'); txt(c, 'glow = heat · red dots = current', 12, H - 10, '#777'); },
    live: S => ckLive(S),
    fx: 'Series: R = R₁+R₂+… &nbsp; Parallel: 1/R = 1/R₁+1/R₂+… &nbsp; I = V/R &nbsp; P = VI = I²R', nt: 'Series: same current, voltages add. Parallel: same voltage, currents add. Mixed: R₁ in series with the rest in parallel. More series resistors lower I; more parallel branches raise total I.' },
  { id: 'resist', n: '03', t: 'Resistivity', st: 1, d: 'R = ρL/A: resistance grows with length and falls with cross-section area.',
    sl: [{ k: 'L', l: 'Length L', min: .1, max: 10, step: .1, val: 2, u: 'm' }, { k: 'd', l: 'Diameter d', min: .1, max: 3, step: .05, val: 1, u: 'mm' }],
    ex: P.MATERIALS.map((m, i) => ({ l: m[0], f: () => { S.mat = i; } })), init: S => { S.mat = 1; },
    draw: (c, w, H, S) => { const m = P.MATERIALS[S.mat], { L, d } = S.v, len = 40 + (w - 110) * L / 10, th = 4 + d * 8, y = H * .3, x0 = (w - len) / 2, A = Math.PI * (d * 1e-3) ** 2 / 4, R = P.resistance(m[1], L, A), g = c.createLinearGradient(0, y - th / 2, 0, y + th / 2);
      g.addColorStop(0, '#fff'); g.addColorStop(.35, m[2]); g.addColorStop(1, '#111'); c.fillStyle = g; c.fillRect(x0, y - th / 2, len, th); arrow(c, x0, y + th / 2 + 16, x0 + len, y + th / 2 + 16, '#e8cf8a'); txt(c, `L = ${sh(L)} m`, w / 2, y + th / 2 + 36, '#e8cf8a', 'center');
      const cr = 4 + d * 10; ball(c, w - 50, H * .66, cr, m[2], '#222'); txt(c, `A = ${sh(A * 1e6)} mm²`, w - 50, H * .66 + cr + 16, '#ccc', 'center'); txt(c, m[0] + ' · ρ = ' + sh(m[1]) + ' Ω m', 14, H * .66, '#ddd');
      const bl = Math.max(4, (Math.log10(R) + 4) / 7.4 * (w - 40)); c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(20, H - 34, w - 40, 8); c.fillStyle = '#b3122a'; c.fillRect(20, H - 34, bl, 8); txt(c, `R = ${sh(R)} Ω (bar: log scale)`, 20, H - 42, '#ccc'); },
    live: S => { const m = P.MATERIALS[S.mat], A = Math.PI * (S.v.d * 1e-3) ** 2 / 4; return [['Material', m[0], ''], ['Resistivity ρ', fmt(m[1]), 'Ω m'], ['Length L', fmt(S.v.L), 'm'], ['Area A = πd²/4', fmt(A * 1e6), 'mm²'], ['R = ρL/A', fmt(P.resistance(m[1], S.v.L, A)), 'Ω']]; },
    fx: 'R = ρL/A &nbsp; A = πd²/4 &nbsp; ρ = RA/L', nt: 'Double L → R doubles. Double d → A ×4 → R ÷4. Nichrome’s high ρ suits heaters; copper’s low ρ suits wires.' },
  { id: 'power', n: '04', t: 'Power & Heating', st: 1, d: 'Electrical energy turns into heat and light. P = VI = I²R = V²/R.',
    sl: [{ k: 'V', l: 'Voltage V', min: 1, max: 250, step: 1, val: 220, u: 'V' }, { k: 'R', l: 'Resistance R', min: 5, max: 2000, step: 1, val: 484, u: 'Ω' }, { k: 't', l: 'Time on', min: .1, max: 24, step: .1, val: 5, u: 'h' }, { k: 'c', l: 'Tariff', min: 1, max: 15, step: .5, val: 7, u: '₹/kWh' }],
    ex: [['60 W bulb', 806.7], ['100 W bulb', 484], ['1 kW heater', 48.4], ['2 kW geyser', 24.2]].map(([l, r]) => ({ l, f: () => { setv('V', 220); setv('R', r); } })),
    draw: (c, w, H, S) => { const { V, R } = S.v, I = V / R, Pw = V * V / R, cx = w / 2, cy = H * .3, gl = 18 + 70 * Math.min(1, Math.log10(1 + Pw) / Math.log10(2500)), g = c.createRadialGradient(cx, cy, 6, cx, cy, gl);
      g.addColorStop(0, 'rgba(255,225,140,.85)'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, gl, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, 24, 0, TAU); c.stroke();
      c.strokeStyle = '#ffe9a8'; c.beginPath(); c.moveTo(cx - 12, cy + 10); for (let k = 0; k < 5; k++) c.lineTo(cx - 8 + k * 4, k % 2 ? cy - 4 : cy + 2); c.stroke(); c.fillStyle = '#555'; c.fillRect(cx - 9, cy + 26, 18, 10);
      [['VI', V * I], ['I²R', I * I * R], ['V²/R', V * V / R]].forEach(([n, v], k) => { const y = H * .56 + k * 30; c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(54, y, w - 74, 10); c.fillStyle = k ? '#c9a24b' : '#b3122a'; c.fillRect(54, y, Math.min(1, v / 2500) * (w - 74), 10); txt(c, n, 12, y + 9, '#ccc'); txt(c, sh(v) + ' W', w - 20, y - 3, '#e8cf8a', 'right'); }); },
    live: S => { const { V, R, t, c } = S.v, I = V / R, Pw = V * I, E = Pw * t / 1000; return [['Current I = V/R', fmt(I), 'A'], ['Power P', fmt(Pw), 'W'], ['Heat H = I²Rt', fmt(I * I * R * t * 3600), 'J'], ['Energy E = Pt', fmt(E), 'kWh (units)'], ['Cost', fmt(E * c), '₹']]; },
    fx: 'P = VI = I²R = V²/R &nbsp; H = I²Rt &nbsp; 1 kWh = 3.6×10⁶ J', nt: 'The three bars always match: one power, three formulas. Double V at fixed R → P ×4. At fixed V, lower R means more power and a hotter element.' }
];
const NAV = SIMS.map(s => [s.id, s.n, s.t]).concat([['formula', '05', 'Formula Lab'], ['quiz', '06', 'Concept Quiz']]);
const FORM = [['V = IR', 'Ohm’s law', 'V ↑ → I ↑ (R fixed) · R ↑ → I ↓ (V fixed)'], ['I = Q / t', 'Electric current', '1 A = 1 C/s'], ['V = W / Q', 'Potential difference', '1 V = 1 J/C'], ['R = ρL / A', 'Resistance of a wire', 'L ↑ → R ↑ · A ↑ → R ↓ · ρ depends on material, temperature'], ['ρ = RA / L', 'Resistivity', 'Unit: Ω m'],
  ['R = R₁ + R₂ + R₃ + …', 'Series', 'Same I · voltages add · R_eq is the largest'], ['1/R = 1/R₁ + 1/R₂ + …', 'Parallel', 'Same V · currents add · R_eq is the smallest'], ['R = R₁R₂ / (R₁ + R₂)', 'Two resistors in parallel', 'Quick shortcut'], ['P = VI = I²R = V²/R', 'Electric power', 'Unit: watt (W)'], ['H = I²Rt = VIt = V²t/R', 'Joule’s heating', 'I ↑ → H ×4 · t ↑ → H ↑'], ['E = Pt', 'Electrical energy', '1 kWh = 3.6×10⁶ J'], ['Cost = kWh × tariff', 'Electricity bill', 'kWh = P(kW) × time(h)']];
const Q = [['The voltage across a fixed resistor is doubled. The current…', ['Halves', 'Doubles', 'Stays the same', 'Becomes 4×'], 1, 'I = V/R, so I ∝ V when R is constant.'], ['In a series circuit, which quantity is the same through every resistor?', ['Voltage', 'Current', 'Power', 'None'], 1, 'There is only one path, so the same current flows through all.'], ['In a parallel circuit, which quantity is the same across every branch?', ['Current', 'Resistance', 'Voltage', 'Power'], 2, 'Every branch connects to the same two nodes.'],
  ['Two 10 Ω resistors in parallel have equivalent resistance…', ['20 Ω', '10 Ω', '5 Ω', '2.5 Ω'], 2, '1/R = 1/10 + 1/10 = 1/5.'], ['The length of a wire is doubled (same material, same area). Its resistance…', ['Halves', 'Doubles', 'Stays the same', 'Becomes 4×'], 1, 'R = ρL/A ∝ L.'], ['The diameter of a wire is doubled. Its resistance becomes…', ['½', '¼', '2×', 'Same'], 1, 'A ∝ d², so A ×4 and R ÷4.'],
  ['Current through a heater doubles (same R). Heat produced per second becomes…', ['2×', '4×', '½', 'Same'], 1, 'P = I²R.'], ['Why are household appliances connected in parallel?', ['Each gets full voltage and works independently', 'It saves energy', 'Current is the same in all', 'Resistance is highest'], 0, 'Parallel branches share the same voltage, and one switching off does not stop the others.']];
function home() { const n = seen().length, N = NAV.length;
  app.innerHTML = `<section class="hero glass"><img src="/icon.svg" width="60" height="60" alt=""><div><h1>ELECTRICITY LAB</h1><p class="gold">Class 10 Science</p><p class="sub">Visualize. Experiment. Understand.</p></div></section><div class="pvs"><a class="glass pv" href="#/ohm"><canvas data-p="0"></canvas><b>Ohm’s Law</b></a><a class="glass pv" href="#/builder"><canvas data-p="1"></canvas><b>Circuit Builder</b></a><a class="glass pv" href="#/power"><canvas data-p="2"></canvas><b>Power & Heating</b></a></div>
  <div class="glass prog"><span>Chapter progress</span><div class="bar"><i style="width:${n / N * 100}%"></i></div><b>${Math.min(n, N)}/${N}</b></div><div class="grid">${NAV.map(([id, nn, t]) => `<a class="glass card" href="#/${id}"><span>${nn}</span>${t}</a>`).join('')}</div><p class="sub">Install: Chrome → Install app · iPhone → Share → Add to Home Screen.</p>`;
  const pos = (x, y, w, h, s) => { s %= 2 * (w + h); return s < w ? [x + s, y] : s < w + h ? [x + w, y + s - w] : s < 2 * w + h ? [x + w - (s - w - h), y + h] : [x, y + h - (s - 2 * w - h)]; };
  const loop = ts => { const t = ts / 1e3; document.querySelectorAll('canvas[data-p]').forEach(cv => { const [c, w, H] = fit(cv), p = +cv.dataset.p, bx = 28, by = 24, bw = w - 56, bh = H - 70; stars(c, w, H);
    if (p < 2) { c.strokeStyle = 'rgba(232,207,138,.4)'; c.lineWidth = 2; c.strokeRect(bx, by, bw, bh); if (p === 1) { c.beginPath(); c.moveTo(w / 2, by); c.lineTo(w / 2, by + bh); c.stroke(); }
      c.fillStyle = '#ff5a6e'; for (let k = 0; k < 12; k++) { const [x, y] = pos(bx, by, bw, bh, t * (p ? 60 : 40) + k * (2 * (bw + bh)) / 12); c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill(); } c.fillStyle = '#0b0b0d'; c.fillRect(w / 2 - 22, by - 8, 44, 16); c.strokeStyle = '#c9a24b'; c.beginPath(); c.moveTo(w / 2 - 20, by); for (let k = 0; k < 6; k++) c.lineTo(w / 2 - 12 + k * 5, k % 2 ? by + 6 : by - 6); c.lineTo(w / 2 + 20, by); c.stroke(); }
    else { const gl = 30 + 12 * Math.sin(t * 2), g = c.createRadialGradient(w / 2, H / 2 - 12, 4, w / 2, H / 2 - 12, gl); g.addColorStop(0, 'rgba(255,225,140,.9)'); g.addColorStop(1, 'rgba(255,170,60,0)'); c.fillStyle = g; c.beginPath(); c.arc(w / 2, H / 2 - 12, gl, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(w / 2, H / 2 - 12, 18, 0, TAU); c.stroke(); } }); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop); }
/* ---------- views ---------- */
function openSim(d) {
  cur = d; S = { v: {}, play: 1 }; d.sl.forEach(o => S.v[o.k] = o.val); d.init && d.init(S);
  app.innerHTML = `<h1>${d.t}</h1><p class="sub">${d.d}</p><div class="stage glass"><canvas></canvas></div><div class="ctl glass">${d.sl.map(o => `<label><span>${o.l}</span><output id="o_${o.k}"></output><input type="range" id="i_${o.k}" data-k="${o.k}" min="${o.min}" max="${o.max}" step="${o.step}" value="${o.val}"></label>`).join('')}<div class="btns">${(d.ex || []).map((e, i) => `<button class="btn" data-x="${i}">${e.l}</button>`).join('')}${d.st ? '' : '<button class="btn" data-p>⏸ Pause</button>'}<button class="btn red" data-r>↺ Reset</button></div></div><div class="live glass" id="live"></div><div class="fx glass">${d.fx}</div><div class="note glass"><b>What to notice</b><br>${d.nt}</div>`;
  d.sl.forEach(o => out(o.k));
  const ctl = $('.ctl'); ctl.oninput = e => { const k = e.target.dataset.k; if (k) { S.v[k] = +e.target.value; out(k); d.onset && d.onset(S, k); } };
  ctl.onclick = e => { const b = e.target.closest('button'); if (!b) return; if ('x' in b.dataset) d.ex[+b.dataset.x].f(); else if ('p' in b.dataset) { S.play = !S.play; b.textContent = S.play ? '⏸ Pause' : '▶ Play'; } else openSim(d); };
  let last = performance.now();
  const frame = ts => { const dt = Math.min(.05, (ts - last) / 1e3 || 0); last = ts; if (S.play && d.step) d.step(S, dt); const [c, w, H] = fit($('canvas')); stars(c, w, H); d.draw(c, w, H, S);
    const L = d.live(S).map(([a, b, u]) => `<div><span>${a}</span><b>${b}</b><i>${u}</i></div>`).join(''); if (L !== S.L) { S.L = L; $('#live').innerHTML = L; } raf = requestAnimationFrame(frame); };
  raf = requestAnimationFrame(frame);
}
function formulas() { app.innerHTML = `<h1>Formula Lab</h1><p class="sub">Gravitation formulas with what they depend on.</p><input class="search" id="q" placeholder="Search formulas…"><div id="fl"></div>`;
  const r = () => { const q = $('#q').value.toLowerCase(); $('#fl').innerHTML = FORM.filter(f => f.join(' ').toLowerCase().includes(q)).map(f => `<div class="fl glass"><b>${f[0]}</b><small>${f[1]}</small><p>${f[2]}</p></div>`).join('') || '<p class="sub">No match.</p>'; }; $('#q').oninput = r; r(); }
function quiz() { let i = 0, sc = 0; const q = () => { if (i >= Q.length) { app.innerHTML = `<h1>Concept Quiz</h1><div class="glass qz"><h2>Score: ${sc} / ${Q.length}</h2><p>${sc >= 6 ? 'Excellent conceptual grip.' : 'Revisit the simulations and try again.'}</p><button class="btn red" id="rs">↺ Restart</button></div>`; $('#rs').onclick = () => { i = 0; sc = 0; q(); }; return; }
    const [t, o, a, e] = Q[i]; app.innerHTML = `<h1>Concept Quiz</h1><div class="glass qz"><small>Question ${i + 1} / ${Q.length}</small><h2>${t}</h2>${o.map((x, j) => `<button class="btn opt" data-j="${j}">${x}</button>`).join('')}<div id="ex"></div></div>`;
    app.querySelectorAll('.opt').forEach(b => b.onclick = () => { const j = +b.dataset.j; app.querySelectorAll('.opt').forEach(x => { x.disabled = 1; +x.dataset.j === a && x.classList.add('ok'); }); if (j === a) sc++; else b.classList.add('bad');
      $('#ex').innerHTML = `<p>${e}</p><button class="btn red" id="nx">${i === Q.length - 1 ? 'See score' : 'Next →'}</button>`; $('#nx').onclick = () => { i++; q(); }; }); }; q(); }
const seen = () => { try { return JSON.parse(localStorage.getItem('gl-seen') || '[]'); } catch { return []; } };
const mark = id => { try { const s = seen(); if (!s.includes(id)) { s.push(id); localStorage.setItem('gl-seen', JSON.stringify(s)); } } catch { } };
/* ---------- router / shell ---------- */
$('#nav').innerHTML = `<h2><img src="/icon.svg" width="28" height="28" alt="">GRAVITATION LAB</h2><a href="#/home"><span>⌂</span>Home</a>${NAV.map(([id, n, t]) => `<a href="#/${id}"><span>${n}</span>${t}</a>`).join('')}`;
$('#menu').onclick = () => $('#nav').classList.toggle('open');
function route() { cancelAnimationFrame(raf); const id = location.hash.slice(2) || 'home', sim = SIMS.find(s => s.id === id);
  document.querySelectorAll('#nav a,#bar a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + id)); $('#nav').classList.remove('open'); scrollTo(0, 0);
  if (sim) openSim(sim); else if (id === 'formula') formulas(); else if (id === 'quiz') quiz(); else home(); mark(id); }
addEventListener('hashchange', route); route();
let dip; addEventListener('beforeinstallprompt', e => { e.preventDefault(); dip = e; $('#install').hidden = false; });
$('#install').onclick = async () => { if (!dip) return; dip.prompt(); await dip.userChoice; dip = null; $('#install').hidden = true; };
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
