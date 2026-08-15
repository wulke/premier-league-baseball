// Worked-example computation — IV/EV feasibility map, ticket #187.
// Runs an UMPIRE's ball/strike call through both branches (faithful Pokémon
// port vs reimagined), plus the ticket's three named stresses:
//   (1) the WRITE side — what earns EV for a Referee? (replay-graded calls)
//   (2) the hidden meta-attribute — does "Focus" slot in like a Player's Work Ethic?
//   (3) a third angle on the (b)-vs-(c) age-discount feel-call from #184/#186.
//
// ALL constants (σ scales, δ, baseline accuracy, primes, C) are ILLUSTRATIVE —
// this map fixes MECHANICS, not tuning (#178 Notes). The career sims are seeded
// (mulberry32) so every number is reproducible.
//
// Run:  npx ts-node docs/architecture/design/iv-ev-feasibility-umpire.ts

// ── the model under test (effective-read pipeline, locked by the map) ──────────
// per attribute a:   raw_a = IV_a + EV_a          (EV storage: unbounded aggregate, #181)
//                    faded_a = Nature_a × (ageDisc_a × IV_a + EV_a)   // (c) discount-IV-only
//                              (#183 Nature slot; #184 convex discount; #186 recommends (c))
// form window:       ring of recent event-deltas, not age-discounted (#181)
// per formula:       read = clamp[−C,+C] ( Σ wCap_a·faded_a + formW·Σ wForm_a·form_a )

type UAttr = {
  iv: number; ev: number; nature: number; ageDisc: number; form: number[];
  name: string;
};
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const fadedCap = (a: UAttr) => a.nature * (a.ageDisc * a.iv + a.ev); // (c) — #186's recommendation
const formRead = (a: UAttr) => a.form.reduce((s, d) => s + d, 0);

// age-discount curve (illustrative, #184 shape): 1.0 through prime, then convex
// accelerating decline to a hard floor. Per-attribute prime; per-entity accel —
// the combined hidden meta-modulator of #184, here per-umpire.
function disc(age: number, prime: number, accel: number, floor: number): number {
  if (age <= prime) return 1;
  return Math.max(floor, 1 - accel * Math.pow(age - prime, 1.6));
}

const fmt = (x: number, d = 1) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(d));
const pct = (x: number, d = 1) => (100 * x).toFixed(d) + '%';
function line(s = '') { console.log(s); }

// ── the call formula (illustrative) ────────────────────────────────────────────
// A pitch arrives at true margin |m| inches from the zone edge (world input, flat
// per the axiom). The umpire perceives m̂ = m + ε; the call is correct iff
// sign(m̂) = sign(m). Noise decomposes over his attribute reads:
//   σ_Acuity: discrimination floor  — K_A / Acuity read        (per-attr formula)
//   σ_Scatter: zone scatter — K_S·(1 − Consistency read/S_REF), clamped ≥ 0
//   fatigue (leverage/focus): φ = 1 + lev·max(0, F_REF − Focus read)/F_REF,
//   applied to σ_total — Focus's READ-side meta-modulation (hidden attr, #179)
// P(correct | m) = Φ(|m| / σ_total)   — the rulebook zone is a FIXED opponent:
// a degenerate duel vs a constant baseline, not vs another person-entity.

const K_A = 131, K_S = 1.8, S_REF = 70, F_REF = 44, C = 85;
function sigmas(u: { acuity: UAttr; consist: UAttr; focus: UAttr }, lev: number) {
  const sA = K_A / clamp(fadedCap(u.acuity) + 0.5 * formRead(u.acuity), 8, 110);
  const sS = clamp(K_S * (1 - (fadedCap(u.consist) + 0.5 * formRead(u.consist)) / S_REF), 0, 2);
  const phi = 1 + lev * Math.max(0, F_REF - fadedCap(u.focus)) / F_REF;
  const sTot = (sA + sS) * phi;
  return { sA, sS, phi, sTot };
}
const normCdf = (x: number) => {
  // Abramowitz-Stegun 7.1.26 — deterministic, no deps
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
};
const pCorrect = (m: number, sTot: number) => normCdf(Math.abs(m) / sTot);

// seeded PRNG (mulberry32) — the sims are reproducible
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => { // Box-Muller
  const u = Math.max(1e-9, r()), v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// ════════════════════════════════════════════════════════════════════════════
// THE CAST — two primes, two roads to the same white shirt (age 34, disc≈0.99)
//   Moreno "The Machine": born eyes (IV-heavy Acuity), untrained Focus (wobbles wired)
//   Okafor  "The Grinder": modest IVs, EV-crafted Consistency + trained Focus
// ════════════════════════════════════════════════════════════════════════════
function umpire(
  label: string, ac: [number, number, number], cz: [number, number, number], fc: [number, number, number]
): { label: string; acuity: UAttr; consist: UAttr; focus: UAttr } {
  return {
    label,
    acuity: { name: 'Acuity',       iv: ac[0], ev: ac[1], nature: ac[2], ageDisc: 0.99, form: [] as number[] },
    consist: { name: 'Consistency', iv: cz[0], ev: cz[1], nature: cz[2], ageDisc: 0.99, form: [] as number[] },
    focus: { name: 'Focus (hidden)', iv: fc[0], ev: fc[1], nature: fc[2], ageDisc: 0.99, form: [] as number[] },
  };
}
const Moreno = umpire('Moreno (talent)', [60, 32, 1.08], [48, 10, 1.00], [30, 2, 1.00]);
const Okafor = umpire('Okafor (grinder)', [52, 26, 1.00], [48, 44, 1.10], [30, 36, 1.00]);

// ════════════════════════════════════════════════════════════════════════════
// 1. THE CALL READ — Branch B (reimagined) vs Branch A (Pokémon-port foil)
// ════════════════════════════════════════════════════════════════════════════
line('══ 1. THE CALL READ — P(correct) by pitch margin × leverage ══');
line('  (margin = inches from the zone edge; lev 0 = calm Tuesday, lev 1 = 9th inning, 130 pitches)');
line();
for (const u of [Moreno, Okafor]) {
  line(`  ${u.label}:  Acuity read ${fmt(fadedCap(u.acuity))} · Consistency read ${fmt(fadedCap(u.consist))} · Focus read ${fmt(fadedCap(u.focus))} (hidden)`);
  for (const lev of [0, 1]) {
    const { sA, sS, phi, sTot } = sigmas(u, lev);
    const when = lev === 0 ? 'calm ' : 'wired';
    line(`    ${when}: σ = (${fmt(sA, 2)} acuity + ${fmt(sS, 2)} scatter) × fatigue φ=${fmt(phi, 2)} = ${fmt(sTot, 2)} in`);
    for (const m of [6, 2, 0.75]) {
      line(`      |m| = ${fmt(m, 2)}" → P(correct) = ${pct(pCorrect(m, sTot))}`);
    }
  }
  line();
}
line('  → two roads to the same calm-night read: the talent SEES it (σ_acuity 1.33), the');
line('    grinder never wavers (scatter 0.00). In the 9th the talent wobbles (untrained');
line('    Focus, φ 1.28 → σ 1.65→2.11, −5.9pp on the 2" call); the grinder does not move.');
line('    Neither distinction exists in the port (below).');
line();
// Branch A — the faithful port foil. Flat additive, no per-formula weights, no
// form, no fatigue, no age; and (write side, §2) EV accrues by ACTIVITY (games
// worked = "battles fought"), not by outcome quality. Read side: one number, one σ.
line('  Branch A (Pokémon-port foil) — flat sum → single σ, blind to context:');
for (const u of [Moreno, Okafor]) {
  const flat = (a: UAttr[]) => a.reduce((s, x) => s + x.iv + x.ev, 0);
  const f = flat([u.acuity, u.consist]);
  const sTot = 262 / f; // same illustrative scale; Focus has NO read-side slot in the port
  line(`    ${u.label}: flat = ${fmt(f, 0)} → σ = ${fmt(sTot, 2)} in, P(2" call) = ${pct(pCorrect(2, sTot))} — every game, every month, every age.`);
}
line('  → same ballpark number, structurally blind: no fatigue state, no slump, no career arc.');
line('    (The port cannot even ASK whether the talent is worse wired than calm — no such lever.)');

// ════════════════════════════════════════════════════════════════════════════
// 2. THE EARNING LOOP — what earns EV for a Referee? (the write side)
// ════════════════════════════════════════════════════════════════════════════
line();
line('══ 2. THE EARNING LOOP — replay-graded calls write δ = k·(correct − league baseline) ══');
// Ground truth = replay/consensus (#185 Q7). δ is BASELINE-RELATIVE, not raw ±sign:
// a raw-sign window saturates positive for a .95 umpire (he cannot slump below
// coin-flip) — §3. The grader splits δ across the attrs that fed the call by the
// formula's weights (Acuity .5 / Consistency .3 / Focus .2), so Focus earns its
// share through the SAME loop (Work-Ethic test: hidden = visibility, not structure).
// Focus's WRITE-side meta-modulation (the #179 "EV-gain rate" meta role, cf. Work
// Ethic in #180): each umpire's δ gain scales × (Focus read / 44), clamped.
const P_BAR = 0.905, DELTA_K = 0.008, GAMES = 115, CALLS = 95;
const W_ACUITY = 0.5, W_CONSIST = 0.3, W_FOCUS = 0.2;
const GAIN_MULT = (u: { focus: UAttr }) => clamp(0.6 + 0.012 * fadedCap(u.focus), 0.6, 1.5);

// career sim: per season → per game → per called pitch. Margin mix 80/15/5
// (fat calls dominate — real called-pitch distributions are not all paint).
function season(u: ReturnType<typeof umpire>, age: number, r: () => number, lev: number) {
  const accel = u === Moreno ? { a: 0.010, c: 0.006, f: 0.008 } : { a: 0.007, c: 0.005, f: 0.006 };
  u.acuity.ageDisc = disc(age, 33, accel.a, 0.55);
  u.consist.ageDisc = disc(age, 45, accel.c, 0.60);
  u.focus.ageDisc = disc(age, 38, accel.f, 0.50);
  const g = GAIN_MULT(u);
  // read side frozen at season start (reads move on EV; season-start reads per
  // season = the read/write separation the pattern prescribes — a formula
  // consumes a snapshot, the grader writes after the fact)
  const aStart = {
    acuity: fadedCap(u.acuity) + 0.5 * formRead(u.acuity),
    consist: fadedCap(u.consist) + 0.5 * formRead(u.consist),
    focus: fadedCap(u.focus),
  };
  let ok = 0, n = 0;
  for (let gi = 0; gi < GAMES; gi++) {
    for (let i = 0; i < CALLS; i++) {
      const m = r() < 0.80 ? 6 : r() < 0.75 ? 2 : 0.75;
      const late = i > CALLS * 0.7; // fatigue state inside the game
      const sA = K_A / clamp(aStart.acuity, 8, 110);
      const sS = clamp(K_S * (1 - aStart.consist / S_REF), 0, 2);
      const phi = 1 + (late ? lev : 0) * Math.max(0, F_REF - aStart.focus) / F_REF;
      const sTot = (sA + sS) * phi;
      const p = pCorrect(m, sTot);
      const correct = r() < p ? 1 : 0;
      ok += correct; n++;
      const d = g * DELTA_K * (correct - P_BAR); // surprise vs baseline, × Focus gain
      u.acuity.ev += W_ACUITY * d;
      u.consist.ev += W_CONSIST * d;
      u.focus.ev += W_FOCUS * d;
      u.acuity.form.push(d); u.consist.form.push(d); u.focus.form.push(d);
    }
  }
  const W = 10 * CALLS; // window = last ~10 games of deltas (ring)
  for (const a of [u.acuity, u.consist, u.focus]) {
    a.form = a.form.length > W ? a.form.slice(a.form.length - W) : a.form;
  }
  return ok / n;
}

line(`  Simulating 25 seasons (seeded): ${GAMES} games × ${CALLS} called pitches; p̄ = ${P_BAR}, k = ${DELTA_K}`);
line(`  δ split by formula weights Acuity ${W_ACUITY} / Consistency ${W_CONSIST} / Focus ${W_FOCUS}; gain mult = 0.6 + 0.012·Focus-read (cap 1.5)`);
line();
const M = umpire('Moreno', [60, 0, 1.08], [48, 0, 1.00], [30, 0, 1.00]); // rookies: EV 0 (IVs = the hiring bar)
const O = umpire('Okafor', [52, 0, 1.00], [48, 0, 1.10], [30, 0, 1.00]);
const K_ = umpire('Kowalski', [42, 0, 1.00], [40, 0, 1.00], [28, 0, 1.00]); // the washout case: IVs BELOW the line
const r1 = rng(20260815), r2 = rng(99001), r3 = rng(1313);
line('  age  | More: acc |  EV A / C / F  | σ calm→wired | Okaf: acc |  EV A / C / F  | σ calm→wired | Kow: acc |  EV A / C');
let snapM: ReturnType<typeof umpire> | null = null;
let snapAcc = 0;
for (let s = 0; s < 25; s++) {
  const age = 24 + s;
  const am = season(M, age, r1, 0.9);
  const ao = season(O, age, r2, 0.9);
  const ak = season(K_, age, r3, 0.9); // the washout rides along
  if (s === 10) { snapM = JSON.parse(JSON.stringify(M)); snapAcc = am; } // prime snapshot, age 34
  if (s % 4 === 0 || s === 24) {
    const sig = (u: ReturnType<typeof umpire>) =>
      `${fmt(sigmas(u, 0).sTot, 2)}→${fmt(sigmas(u, 1).sTot, 2)}`;
    const ev3 = (u: ReturnType<typeof umpire>) =>
      `${fmt(u.acuity.ev, 0).padStart(3)} / ${fmt(u.consist.ev, 0).padStart(3)} / ${fmt(u.focus.ev, 0).padStart(3)}`;
    line(`  ${String(age).padStart(3)}  |      ${pct(am)} | ${ev3(M)} |    ${sig(M)}   |    ${pct(ao)} | ${ev3(O)} |    ${sig(O)}   |  ${pct(ak)} | ${fmt(K_.acuity.ev, 0).padStart(4)} / ${fmt(K_.consist.ev, 0).padStart(4)}`);
  }
}
line();
line('  → WHAT EARNS EV FOR A REFEREE: being better than the keep-your-job line on');
line('    calls replay can grade — nothing else writes. Moreno is +EV from year 1 (born');
line('    reads above the line). Okafor starts barely above it with a SLOW gain loop');
line('    (Focus gain-mult 0.96 at his rookie Focus-read 29.7) — a decade of dues while his');
line('    Focus EV compounds the gain rate (mult 1.39 by prime) — then he climbs to .954:');
line('    two points shy of the talent (the IV ceiling is real) but a star by any measure.');
line('    Note Moreno\'s wired-σ gap closes over his career (3.30→1.26 spread at 24 vs');
line('    1.26→1.26 at 48): his Focus EV trains. Same ±δ loop a Player walks — no "umpire');
line('    XP" subsystem, no parallel machinery.');
line('  → Kowalski (IVs below the line): the loop is a one-way door DOWN — every call');
line('    writes −δ, reads sink, σ widens, worse calls… he does not "develop through it";');
line('    the spiral IS the talent evaluation (in the sim league he never leaves Triple-A).');
line('    A below-the-line IV set cannot earn its way up under baseline-relative δ —');
line('    development is for entities above the line the league already selected on.');
line('  → Port foil (write side): the faithful port accrues EV by ACTIVITY (games worked');
line('    — its EVs come from reps, not results), so all three accrue identically over');
line('    25 seasons. Call quality is structurally invisible to it.');
line();
line('  δ-ZERO SPECTRUM (the write-side convention this example surfaces):');
line('    raw ±sign (player-style, #180): everyone above coin-flip earns → a .95 umpire');
line('      can NEVER slump (window saturates positive) — unreadable reputation;');
line('    vs OWN expectation: self-fulfilling — δ≈0 forever, no development channel;');
line('    vs LEAGUE line (used here): slump readable, development compounding for the');
line('      selected, doom-spiral for the below-line (feature: selection). The zero is a');
line('      grader choice (#185 kept graders out of scope) but EVERY truth-graded entity');
line('      must pick one — for 50/50 duels all three coincide, which is why #180 never saw it.');

// ════════════════════════════════════════════════════════════════════════════
// 3. REPUTATION vs SHAKY MONTH — the two-timescale partition at high frequency
// ════════════════════════════════════════════════════════════════════════════
line();
line('══ 3. TWO TIMESCALES — prime Moreno (age 34 snapshot), a blown-calls month ══');
// the snapshot's real career accuracy → a month at .87 (the ejection, the viral
// clip). Window = last 1200 calls; the EV aggregate is ~120k calls deep by 34.
// The call formula's form weight formW = 40 (a today's-game read, #180-style).
const monthAcc = 0.870, FORM_W = 40;
const winSum = 1200 * DELTA_K * (monthAcc - P_BAR);
const normalSum = 1200 * DELTA_K * (snapAcc - P_BAR);
const sm = snapM as ReturnType<typeof umpire>;
line(`  season ${pct(snapAcc)} → a month at ${pct(monthAcc, 0)}: window Σδ = 1200·${DELTA_K}·(${fmt(monthAcc, 3)} − ${P_BAR}) = ${fmt(winSum, 3)}   (normal month: +${fmt(normalSum, 3)})`);
line('  → the window flips NEGATIVE — "shaky month" is readable — while the career EV');
line('    aggregate barely moves (one −0.33 month vs a ~120k-call decade) and capacity is untouched.');
const calM = { acuity: { ...sm.acuity, form: [] }, consist: { ...sm.consist, form: [] }, focus: { ...sm.focus, form: [] } };
const slumpM = {
  acuity: { ...sm.acuity, form: [W_ACUITY * winSum * FORM_W] },
  consist: { ...sm.consist, form: [W_CONSIST * winSum * FORM_W] },
  focus: { ...sm.focus, form: [W_FOCUS * winSum * FORM_W] },
};
const baseS = sigmas(calM, 0.5).sTot, slumpS = sigmas(slumpM, 0.5).sTot;
line('  Three reads of ONE storage:');
line(`    reputation card (formW→0): reads faded capacity — still elite (${pct(pCorrect(2, baseS), 0)} on 2" calls)`);
line('    this-month report (window): NEGATIVE — "his zone has been drifting"');
line(`    tonight's formula (formW ${FORM_W}): P(2") ${pct(pCorrect(2, slumpS))} vs ${pct(pCorrect(2, baseS))}, P(0.75") ${pct(pCorrect(0.75, slumpS))} vs ${pct(pCorrect(0.75, baseS))}`);
line(`      — a point and a half on the border calls ≈ 2-3 extra blown calls a month:`);
line('      visible in the grade sheet, invisible in the career line, gone when the');
line('      window rolls over. THE #181 PARTITION, at the high-frequency end of the spectrum.');

// ════════════════════════════════════════════════════════════════════════════
// 4. FATHER TIME, THIRD ANGLE — (b) subtractive vs (c) discount-IV-only
// ════════════════════════════════════════════════════════════════════════════
line();
line('══ 4. AGING SWEEP — the eyes go, the craft holds (b-vs-c feel test) ══');
line('  Both umps frozen at career-end EVs (from the sim); per-attr primes Acuity 33 / Consistency 45 / Focus 38.');
line('  (b) = age-erosion Δ(age) = 0.13·(age−33)^1.6 subtracted from RAW pre-Nature —');
line('      Father Time taxes the whole attribute, innate AND earned, equally.');
line('  (c) = discount-IV-only (#186 recommendation): innate fades, earned resists.');
line();
const KAPPA = 0.13;
const erode = (age: number) => KAPPA * Math.pow(Math.max(0, age - 33), 1.6);
line('  age  |    Moreno (c) A / C / F    |    Moreno (b) A / C / F    |    Okafor (c) A / C / F    |    Okafor (b) A / C / F   | σ(c) M / O');
for (const age of [34, 42, 48, 52, 56, 58]) {
  const reads = (u: ReturnType<typeof umpire>) => {
    const clone = umpire(u.label,
      [u.acuity.iv, u.acuity.ev, u.acuity.nature] as [number, number, number],
      [u.consist.iv, u.consist.ev, u.consist.nature] as [number, number, number],
      [u.focus.iv, u.focus.ev, u.focus.nature] as [number, number, number]);
    clone.acuity.ageDisc = disc(age, 33, 0.010, 0.55);
    clone.consist.ageDisc = disc(age, 45, 0.006, 0.60);
    clone.focus.ageDisc = disc(age, 38, 0.008, 0.50);
    const cR = [clone.acuity, clone.consist, clone.focus].map(fadedCap);
    const d = erode(age);
    const bR = [clone.acuity, clone.consist, clone.focus].map(
      (a) => a.nature * (a.iv + a.ev - d));
    return { cR, bR, clone };
  };
  const m = reads(M), o = reads(O);
  const cell = (r: number[]) => r.map((x) => fmt(x, 0).padStart(3)).join(' / ');
  line(`  ${String(age).padStart(3)}  |  ${cell(m.cR)}  |  ${cell(m.bR)}  |  ${cell(o.cR)}  |  ${cell(o.bR)}  |  ${fmt(sigmas(m.clone, 0).sTot, 2)} / ${fmt(sigmas(o.clone, 0).sTot, 2)}`);
}
line();
line('  (c): the fade lands on the INNATE — Moreno\'s born eyes (IV 60) take the whole');
line('      hit; Okafor\'s EV-crafted Consistency/Focus hold longest. "Veteran judgment,');
line('      tired eyes": reads like every real 50-something crew chief, and retirement');
line('      (~56-58, when σ widens past the border calls) EMERGES from the read rather');
line('      than being scheduled.');
line('  (b): the uniform Δ taxes Okafor\'s EARNED craft as hard as Moreno\'s innate eyes —');
line('      at 58 his Consistency reads 51 under (b) vs 56 under (c), Focus 21 vs 29. The');
line('      umpire case votes (c) again — same direction as #186\'s vet slugger — but the');
line('      margin is thinner here (career EV dominates reads at these scales), so it is a');
line('      vote, not a verdict. (b)-vs-(c) stays the author feel-call.');
line('  Storage contract untouched by every stress above — per-entity pristine throughout.');
