// Worked-example computation — IV/EV feasibility map, ticket #186.
// Implements the LOCKED effective-read pipeline (#179/#181/#183/#184) and runs a
// pitcher-vs-batter at-bat through it, plus the two #184-scope edge tests:
//   (1) no-positive-regression edge (asymmetric-freeze vs alternatives)
//   (2) elite-compression sweep (prime-age elite vs aging elite; +C ceiling)
//   plus the ticket's core stress-test: does linearity break at 4–6 attrs/side?
//
// ALL constants (C, weights, age-discount values, prime ages) are ILLUSTRATIVE —
// this map fixes MECHANICS, not tuning (#178 Notes). Numbers are reproducible
// artifacts of the chosen illustrative constants, not proposed balances.
//
// Run:  npx ts-node docs/architecture/design/iv-ev-feasibility-at-bat.ts

// ── the model under test (effective-read pipeline, per #184) ───────────────────

type Attr = {
  iv: number; ev: number; nature: number; ageDisc: number; // ageDisc ∈ (0,1], ≤1
  form: number[]; // ring buffer of recent event-deltas (NOT age-discounted) — #181
  name: string;
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// per-attribute FADED CAPACITY, with #184's provisional asymmetric-freeze (Q8):
//   raw = IV+EV (per-attr combine) → ×Nature (#183 slot) → ×age-discount
//   BUT if raw<0, age-discount is FROZEN (a blind multiplier would "improve" a negative).
function fadedCap(a: Attr): number {
  const raw = a.iv + a.ev;
  const natured = a.nature * raw;
  return raw < 0 ? natured : a.ageDisc * natured; // asymmetric-freeze (provisional)
}
const formRead = (a: Attr) => a.form.reduce((s, d) => s + d, 0); // window sum — #181

// per-formula duel STRENGTH: weighted faded capacities + form emphasis → clamp[−C,+C]
function strength(
  attrs: Attr[], wCap: number[], wForm: number[], formW: number, C: number
): number {
  let cap = 0, frm = 0;
  attrs.forEach((a, i) => { cap += wCap[i] * fadedCap(a); frm += wForm[i] * formRead(a); });
  return clamp(cap + formW * frm, -C, +C);
}
// Bradley-Terry duel, floored so it stays defined when a strength ≤ 0 (negative edge).
function duel(p: number, b: number): number {
  const pf = Math.max(0, p), bf = Math.max(0, b);
  return pf / (pf + bf + 1e-9);
}

// age-discount curve (illustrative): 1.0 through prime, then convex accelerating
// decline to a hard floor. per-attribute via prime-offset + fadeFactor; per-player
// via accelRate — the two folded into one hidden meta-modulator per #184.
function disc(age: number, prime: number, accel: number, floor = 0.5): number {
  if (age <= prime) return 1;
  return Math.max(floor, 1 - accel * Math.pow(age - prime, 1.6));
}

const fmt = (x: number, d = 1) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(d));
const pct = (x: number) => (100 * x).toFixed(0) + '%';
function line(s = '') { console.log(s); }

// ── per-attribute weights for the at-bat formula (the K/outcome read) ──────────
//   pitcher "gets the outcome" (K / weak contact) is Stuff-heavy; batter resists.
const P_WCAP = [0.5, 0.3, 0.2]; // Stuff, Command, Control/Deception
const P_WFORM = [0.5, 0.3, 0.2];
const B_WCAP = [0.3, 0.4, 0.3]; // Eye, Contact, Power
const B_WFORM = [0.3, 0.4, 0.3];
const FORM_W = 0.5; // today's-game read weighs form (#180's "form-heavy" read)
const C = 85;      // illustrative consumed-value clamp — chosen so a prime elite binds

// ════════════════════════════════════════════════════════════════════════════
// 1. BASELINE AT-BAT — Branch B (reimagined) vs Branch A (Pokémon-port foil)
// ════════════════════════════════════════════════════════════════════════════
line('══ 1. BASELINE AT-BAT — good-but-not-elite matchup, age 27 ══');
const Cole = [ // pitcher, prime, slight +stuff/−command Nature trade
  { name: 'Stuff',   iv: 24, ev: 60, nature: 1.10, ageDisc: 0.99, form: [+4, +2, -1, +5] },
  { name: 'Command', iv: 19, ev: 48, nature: 0.90, ageDisc: 0.99, form: [+2, -1, +3] },
  { name: 'Control', iv: 17, ev: 38, nature: 1.00, ageDisc: 0.99, form: [+1, +2] },
];
const Ramirez = [ // batter, prime, +power slugger Nature
  { name: 'Eye',     iv: 19, ev: 44, nature: 1.00, ageDisc: 0.99, form: [+3, +1, -2] },
  { name: 'Contact', iv: 21, ev: 42, nature: 1.00, ageDisc: 0.99, form: [+2, +2, +1] },
  { name: 'Power',   iv: 25, ev: 52, nature: 1.10, ageDisc: 0.99, form: [+4, +3] },
];
const ps = strength(Cole, P_WCAP, P_WFORM, FORM_W, C);
const bs = strength(Ramirez, B_WCAP, B_WFORM, FORM_W, C);
line('Branch B (reimagined) — faded capacities:');
Cole.forEach((a, i) => line(`  P ${a.name.padEnd(8)} raw=${fmt(a.iv + a.ev, 0).padStart(3)} ×N${a.nature} ×d${a.ageDisc} → faded ${fmt(fadedCap(a))}  (form ${fmt(formRead(a), 0)})  w=${P_WCAP[i]}`));
Ramirez.forEach((a, i) => line(`  B ${a.name.padEnd(8)} raw=${fmt(a.iv + a.ev, 0).padStart(3)} ×N${a.nature} ×d${a.ageDisc} → faded ${fmt(fadedCap(a))}  (form ${fmt(formRead(a), 0)})  w=${B_WCAP[i]}`));
line(`  pitcher strength = ${fmt(ps)}   batter strength = ${fmt(bs)}   (C=${C})`);
line(`  P(pitcher gets the outcome) = ${fmt(ps)}/(${fmt(ps)}+${fmt(bs)}) = ${pct(duel(ps, bs))}  ← neither clamped; a real non-trivial read`);

// Branch A — flat-additive Pokémon port foil (#182): IV+EV summed, EV monotonic,
// Nature a blunt ±10%, no form, no age-discount, no effective-read clamp.
line('Branch A (Pokémon-port foil) — flat additive, form-less, monotonic EV:');
const portStrength = (as: Attr[], n: number[]) =>
  as.reduce((s, a, i) => s + n[i] * (a.iv + a.ev), 0); // Nature as blunt multiplier
const psp = portStrength(Cole, [1.10, 0.90, 1.00]);
const bsp = portStrength(Ramirez, [1.00, 1.00, 1.10]);
line(`  pitcher = ${fmt(psp, 0)}   batter = ${fmt(bsp, 0)}   P = ${pct(duel(psp, bsp))}`);
line('  → same ballpark probability, but structurally blind: one number in every');
line('    context — cannot tell potential from form, cannot slump, cannot age (#180).');

// ════════════════════════════════════════════════════════════════════════════
// 2. NO-POSITIVE-REGRESSION EDGE (#184 Q8, provisional) — fading veteran, NEGATIVE attr
// ════════════════════════════════════════════════════════════════════════════
line();
line('══ 2. NO-POSITIVE-REGRESSION EDGE — veteran Contact has gone NEGATIVE ══');
// Thomás: age-38 slugger. Contact IV 28 but EV eroded to −50 (a tool that left).
const ThomasContact = { name: 'Contact', iv: 28, ev: -50, nature: 1.0, ageDisc: 0.80, form: [-3, -2, -4] };
const raw = ThomasContact.iv + ThomasContact.ev; // −22
line(`  raw (IV+EV) = ${fmt(raw, 0)}   ← NEGATIVE. age-discount at 38 ≈ 0.80.`);
line('  How do the four candidate mechanics read this single attribute?');
const blind = ThomasContact.ageDisc * raw;                 // blind multiplier (the BUG)
const freeze = raw < 0 ? raw : ThomasContact.ageDisc * raw; // (a) asymmetric-freeze [provisional]
const subtractive = raw - 16.5;                            // (b) −Δ(age), Δ≈16.5 at 38
const ivOnly = (ThomasContact.iv * 0.80) + ThomasContact.ev; // (c) age IV, EV resists
line(`    (bug)  blind mult   0.80×(${fmt(raw,0)}) = ${fmt(blind,1)}   ← IMPROVED (positive regression!)`);
line(`    (a)    freeze       → ${fmt(freeze,0)}            ← frozen: age stops biting once you're bad`);
line(`    (b)    subtractive  ${fmt(raw,0)} − 16.5 = ${fmt(subtractive,1)}   ← keeps declining (correct dir)`);
line(`    (c)    IV-only      0.80·28 + (${ThomasContact.ev}) = ${fmt(ivOnly,1)}   ← keeps declining, gentler`);
line('  → freeze reads WRONG exactly at the edge it was meant to handle: a fading');
line('    vet whose tool is gone should keep declining, not freeze. (b)/(c) both');
line('    avoid positive-regression AND keep declining — the real fix is one of them.');

// ════════════════════════════════════════════════════════════════════════════
// 3. ELITE-COMPRESSION SWEEP — two elites, same peak profile, different aging
// ════════════════════════════════════════════════════════════════════════════
line();
line('══ 3. ELITE-COMPRESSION SWEEP — same peak profile, different prime/accel ══');
line('  (per-attr fade: Stuff fast ×1.4 / Control ×1.0 / Command slow ×0.6; prime');
line('   offsets Stuff −1, Command +2. C=' + C + ' chosen so a prime elite binds the ceiling.)');
// elite peak profile (same for both): high EV, +stuff Nature
const eliteAt = (age: number, prime: number, accel: number): Attr[] => [
  { name: 'Stuff',   iv: 26, ev: 82, nature: 1.10, ageDisc: disc(age, prime - 1, accel * 1.4), form: [] },
  { name: 'Command', iv: 21, ev: 64, nature: 0.90, ageDisc: disc(age, prime + 2, accel * 0.6), form: [] },
  { name: 'Control', iv: 18, ev: 46, nature: 1.00, ageDisc: disc(age, prime,     accel * 1.0), form: [] },
];
const Toolsy = { label: 'Toolsy Cole',   prime: 25, accel: 0.045 }; // peaks early, fades fast
const Crafty = { label: 'Crafty Marcus', prime: 28, accel: 0.025 }; // blooms late, endures
line(`  age | ${'Toolsy Cole (prime25, fast)'.padEnd(28)} | ${'Crafty Marcus (prime28, gentle)'.padEnd(30)} | both at +C?`);
line(`      | Stuff Cmd Ctrl → str (clamp?) | Stuff Cmd Ctrl → str (clamp?) |`);
for (const age of [24, 25, 27, 29, 31, 33, 35, 38]) {
  const t = eliteAt(age, Toolsy.prime, Toolsy.accel).map(fadedCap);
  const c = eliteAt(age, Crafty.prime, Crafty.accel).map(fadedCap);
  const ts = clamp(t[0] * 0.5 + t[1] * 0.3 + t[2] * 0.2, -C, C); // form-empty for clean capacity read
  const cs = clamp(c[0] * 0.5 + c[1] * 0.3 + c[2] * 0.2, -C, C);
  const tc = ts >= C ? '·CEIL' : '     ';
  const cc = cs >= C ? '·CEIL' : '     ';
  const same = (ts >= C && cs >= C) ? 'BOTH CLAMPED — blurred' : 'distinct';
  line(`  ${String(age).padStart(3)} | ${fmt(t[0]).padStart(5)} ${fmt(t[1]).padStart(4)} ${fmt(t[2]).padStart(5)} → ${fmt(ts).padStart(5)}${tc} | ${fmt(c[0]).padStart(5)} ${fmt(c[1]).padStart(4)} ${fmt(c[2]).padStart(5)} → ${fmt(cs).padStart(5)}${cc} | ${same}`);
}
line('  → both pin +C across their prime window (compression IS real at the ceiling),');
line('    BUT they leave the ceiling at different ages (Toolsy ~31, Crafty ~35) ⟹ the');
line('    per-player accel-rate SPREADS the top at the margin → not every elite identical.');
line('    #184\'s qualitative read holds quantitatively; "blurring" is confined to the');
line('    prime window itself (the intended "flat-top" of a career), not the decline.');

// Nature-before-clamp vs after-clamp (the elite-compression sub-question, fog)
line();
line('  Nature-vs-clamp ordering (fog sub-question):');
line('    current (Nature BEFORE final clamp): a +Nature speedster\'s higher capacity');
line('      hits +C sooner → MORE compression among same-Nature elites at ceiling.');
line('    alt    (Nature AFTER clamp): the +C ceiling is broken by Nature → speedsters');
line('      exceed +C → spread, but the bound stops meaning "peak performance".');
line('    → sharp question, but depends on C + per-formula weights (tuning) → stays fog');

// ════════════════════════════════════════════════════════════════════════════
// 4. LINEARITY BREAK — does pure-linear combine survive 4–6 attrs/side?
// ════════════════════════════════════════════════════════════════════════════
line();
line('══ 4. LINEARITY BREAK — two pitchers, SAME weighted average, different shape ══');
// Specialist: overpowering Stuff, can't locate. Balanced: craftsman.
const Specialist: Attr[] = [
  { name: 'Stuff',   iv: 30, ev: 90, nature: 1.10, ageDisc: 0.99, form: [] },
  { name: 'Command', iv: 12, ev: 5,  nature: 0.90, ageDisc: 0.99, form: [] },
  { name: 'Control', iv: 12, ev: 5,  nature: 1.00, ageDisc: 0.99, form: [] },
];
const Balanced: Attr[] = [
  { name: 'Stuff',   iv: 22, ev: 48, nature: 1.10, ageDisc: 0.99, form: [] },
  { name: 'Command', iv: 22, ev: 48, nature: 0.90, ageDisc: 0.99, form: [] },
  { name: 'Control', iv: 22, ev: 48, nature: 1.00, ageDisc: 0.99, form: [] },
];
const sLin = strength(Specialist, P_WCAP, [0,0,0], 0, C); // no form, isolate capacity linearity
const bLin = strength(Balanced,   P_WCAP, [0,0,0], 0, C);
line(`  Specialist  faded: Stuff ${fmt(fadedCap(Specialist[0]))}, Cmd ${fmt(fadedCap(Specialist[1]))}, Ctrl ${fmt(fadedCap(Specialist[2]))} → linear strength ${fmt(sLin)}`);
line(`  Balanced    faded: Stuff ${fmt(fadedCap(Balanced[0]))}, Cmd ${fmt(fadedCap(Balanced[1]))}, Ctrl ${fmt(fadedCap(Balanced[2]))} → linear strength ${fmt(bLin)}`);
line('  → linear combine reads them ~identical, but they are OPPOSITE pitchers:');
line('    the Specialist walks the park (Command collapsed); the Balanced guy doesn\'t.');
line('    A pure weighted sum has no notion of a COLLAPSED dimension. This is where the');
line('    starting linear contract breaks — and where baseball demands NONLINEARITY:');

// Nonlinear treatment demo: per-attribute THRESHOLD gate (Command below a floor tanks
// walks) + diminishing-returns (Stuff above a ceiling stops adding Ks). Illustrative.
const gate = (x: number, floor: number) => (x < floor ? x - 3 * (floor - x) : x); // collapse amplifies
const sat = (x: number, ceil: number) => (x > ceil ? ceil + Math.sqrt(x - ceil) : x); // diminishing returns
const nonlinearStrength = (as: Attr[]) => {
  const f = as.map(fadedCap);
  const stuff = sat(f[0], 100);
  const cmd = gate(f[1], 35);   // Command under 35 → walks spike
  const ctrl = gate(f[2], 30);
  return clamp(0.5 * stuff + 0.3 * cmd + 0.2 * ctrl, -C, C);
};
const sNL = nonlinearStrength(Specialist);
const bNL = nonlinearStrength(Balanced);
line(`  nonlinear (gate + saturation): Specialist → ${fmt(sNL)}   Balanced → ${fmt(bNL)}`);
line('  → now the Specialist reads clearly weaker (Command collapse is punished) and');
line('    Balanced reads stronger — the distinction a baseball sim needs. The pattern');
line('    COMBINES cleanly (still f(person IV,EV)); the nonlinearity lives inside one');
line('    formula\'s combine, not in the storage contract — so the axiom is untouched.');
