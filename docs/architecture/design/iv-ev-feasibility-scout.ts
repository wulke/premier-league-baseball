// Worked-example computation — IV/EV feasibility map, ticket #188.
// Runs a SCOUT'S READ on players through the two model branches (faithful
// Pokémon port vs reimagined), where scouting is the reimagined branch's
// supposed superpower: the SAME attribute (IV, EV, form-window) combining
// DIFFERENTLY per consumer —
//     scout  reads forward ceiling  (IV-heavy, projection, form-blind)
//     manager reads today's ability (form-window-heavy, #180/#186's read)
//     salary reads the career aggregate (unfaded EV resume, #181)
// Plus the two #184-scope edge tests:
//   (1) fading-veteran vs prime-age attribution — can the scout tell a slump
//       (form-window) from age-decline (capacity discount)? Does the port see
//       ANY of it?
//   (2) elite-compression from the SCOUT's angle — two similarly-rated players
//       past their prime: does the scout distinguish them? (third angle on the
//       (b)-vs-(c) age-mechanic feel-call, shared load with #186/#187)
//
// Age mechanic under test for the baseline: (c) discount-IV-only / EV-resists —
// #186 overturned #184's provisional asymmetric-freeze and recommends (c);
// #187 cast a second vote. §3 runs (b) subtractive alongside for the third angle.
//
// ALL constants (C, weights, primes, accel rates, EV@prime headroom) are
// ILLUSTRATIVE — this map fixes MECHANICS, not tuning (#178 Notes). Numbers are
// reproducible artifacts of the chosen illustrative constants, not balances.
//
// Run:  TS_NODE_PROJECT=docs/architecture/design/tsconfig.scout.json \
//         npx ts-node docs/architecture/design/iv-ev-feasibility-scout.ts

// ── the model under test (effective-read pipeline, #179/#181/#183/#184) ───────

type Attr = {
  iv: number; ev: number; nature: number;
  form: number[]; // ring buffer of recent event-deltas (NOT age-discounted) — #181
  name: string;
};
type Player = {
  name: string; age: number; prime: number; accel: number; // per-player aging meta-modulator (#184)
  attrs: Attr[];
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// per-attribute aging profile (#184): batters — plate discipline ENDURES
// (prime +3, fade ×0.6), contact is the baseline (prime +0, ×1.0), bat-speed
// Power fades EARLY/FAST (prime −2, ×1.4). Hard floor 0.5 per attr.
const PROFILE: Record<string, { pOff: number; fade: number }> = {
  Eye:     { pOff: +3, fade: 0.6 },
  Contact: { pOff:  0, fade: 1.0 },
  Power:   { pOff: -2, fade: 1.4 },
};

// convex, accelerating age-discount, decline-only, hard floor (#184)
function disc(age: number, prime: number, accel: number, floor = 0.5): number {
  if (age <= prime) return 1;
  return Math.max(floor, 1 - accel * Math.pow(age - prime, 1.6));
}
const attrDisc = (p: Player, a: Attr, atAge?: number) =>
  disc(atAge ?? p.age, p.prime + PROFILE[a.name].pOff, p.accel * PROFILE[a.name].fade);

// (c) discount-IV-only / EV-resists (#186's recommendation, baseline here):
//   faded = Nature × (disc·IV + EV)   — earned craft endures, innate wheels fade
function fadedCapC(p: Player, a: Attr, atAge?: number): number {
  return a.nature * (attrDisc(p, a, atAge) * a.iv + a.ev);
}
const formRead = (a: Attr) => a.form.reduce((s, d) => s + d, 0); // window sum — #181

const W = [0.3, 0.4, 0.3]; // Eye / Contact / Power — same shape as the at-bat's batter read
const C = 85;              // illustrative consumed-value clamp (matches #186/#187)
const FORM_W = 0.5;        // the manager's today-read weighs form (#180)

// ══ THE THREE CONSUMERS — same storage (IV, EV, form-window), three formulas ══

// MANAGER (today's lineup read): faded capacity + form emphasis → clamp (the
// at-bat's read, #180/#186)
function managerRead(p: Player): number {
  let cap = 0, frm = 0;
  p.attrs.forEach((a, i) => { cap += W[i] * fadedCapC(p, a); frm += W[i] * formRead(a); });
  return clamp(cap + FORM_W * frm, -C, +C);
}

// SALARY (the accountant's read): the unfaded career aggregate — #181's
// pristine resume. Deliberately UNCLAMPED: salary is unbounded, like storage.
function salaryRead(p: Player): number {
  return p.attrs.reduce((s, a, i) => s + W[i] * a.nature * (a.iv + a.ev), 0);
}

// SCOUT (the forward-ceiling read): form-blind (today's noise isn't tomorrow's
// talent), IV-heavy (half-credit for the earned — he's shown part of the
// ceiling), projects EV to its prime-peak (growth headroom: pre-prime, a player
// can still cash in up to +1×IV more), then applies the age-discount AT THE
// PROJECTED AGE (+2y). The one new piece is the EV@prime extrapolation — a
// read-side projection from the same tuple (illustrative; the finding does not
// hang on its exact shape).
function scoutRead(p: Player, atAge = p.age + 2): number {
  let v = 0;
  p.attrs.forEach((a, i) => {
    const prime = p.prime + PROFILE[a.name].pOff;
    const headroom = Math.min(1, Math.max(0, prime - p.age) / 6); // ≤6 pre-prime seasons to cash in
    const evAtPrime = a.ev + a.iv * headroom;
    v += W[i] * a.nature * (a.iv + 0.5 * evAtPrime) * attrDisc(p, a, atAge);
  });
  return v;
}

// PORT FOIL (faithful Pokémon port, #182): one flat additive number per player,
// EV-monotonic, blunt Nature, no form, no aging, no clamp, no per-consumer
// split — every consumer reads THE SAME number.
const portRead = (p: Player) => salaryRead(p); // structurally identical: flat Nature×(IV+EV)

const fmt = (x: number, d = 1) => (Math.abs(x) >= 100 ? x.toFixed(0) : x.toFixed(d));
const pct = (x: number) => (100 * x).toFixed(0) + '%';
const line = (s = '') => console.log(s);

// ── the cast (§1) — three archetypes, attrs (Eye/Contact/Power) ═══════════════

const Pete: Player = { // the Prospect, 21: elite innate tools, thin early returns
  name: 'Pete (21, prospect)', age: 21, prime: 27, accel: 0.018,
  attrs: [
    { name: 'Eye',     iv: 26, ev:  6, nature: 1.00, form: [+2, -1, +3] },
    { name: 'Contact', iv: 29, ev:  8, nature: 1.10, form: [+1, +2, -1] },
    { name: 'Power',   iv: 24, ev:  4, nature: 0.90, form: [-2, +1] },
  ],
};
const Victor: Player = { // the Prime, 27: proven, in form — the benchmark
  name: 'Víctor (27, prime)', age: 27, prime: 27, accel: 0.018,
  attrs: [
    { name: 'Eye',     iv: 19, ev: 44, nature: 1.00, form: [+3, +1] },
    { name: 'Contact', iv: 21, ev: 52, nature: 1.00, form: [+2, +2, +1] },
    { name: 'Power',   iv: 18, ev: 38, nature: 1.10, form: [+1, +1] },
  ],
};
const Thomas: Player = { // the Fading Star, 36: toolsy superstar (value in the INNATE), in a slump
  name: 'Thomás (36, fading star)', age: 36, prime: 30, accel: 0.022,
  attrs: [
    { name: 'Eye',     iv: 36, ev: 40, nature: 1.00, form: [-4, -3, -4] },
    { name: 'Contact', iv: 32, ev: 44, nature: 1.00, form: [-6, -5, -6] },
    { name: 'Power',   iv: 30, ev: 32, nature: 1.10, form: [-4, -3, -5] },
  ],
};

// ════════════════════════════════════════════════════════════════════════════
// 1. THE THREE-CONSUMER READ — one tuple, three formulas, one flat port number
// ════════════════════════════════════════════════════════════════════════════
line('══ 1. THREE CONSUMERS, ONE STORAGE TUPLE — who does each read crown? ══');
line('  (attrs Eye/Contact/Power, weights .3/.4/.3; C=' + C + '; all constants illustrative)');
line();
line(`  ${'player'.padEnd(26)} | ${'PORT (one #)'.padStart(12)} | ${'Manager today'.padStart(14)} | ${'Scout forward'.padStart(13)} | ${'Salary aggregate'.padStart(16)}`);
line(`  ${'─'.repeat(26)}─┼─${'─'.repeat(12)}─┼─${'─'.repeat(14)}─┼─${'─'.repeat(13)}─┼─${'─'.repeat(16)}`);
[Pete, Victor, Thomas].forEach((p) => {
  line(`  ${p.name.padEnd(26)} | ${fmt(portRead(p)).padStart(12)} | ${fmt(managerRead(p)).padStart(14)} | ${fmt(scoutRead(p)).padStart(13)} | ${fmt(salaryRead(p)).padStart(16)}`);
});
line();
line('  → FOUR columns, THREE orderings — each consumer crowns a different player:');
line('    port:     Thomás ≫ Víctor ≫ Pete    (the 36-yo "star" is the "best player")');
line('    manager:  Víctor ≫ Thomás ≫ Pete    (start the prime vet, not the slumping star)');
line('    scout:    Pete ≳ Víctor ≫ Thomás    (ranks the unproven kid ABOVE the star)');
line('    salary:   Thomás ≫ Víctor ≫ Pete    (…which is the port ordering, exactly)');
line();
line('  → THE PORT *IS* THE SALARY READ. Flat Nature×(IV+EV) over unfaded storage is');
line('    precisely the aggregate/career-resume read (#181) — the port branch is an');
line('    accountant: it can price a resume, and NOTHING else. It cannot slump (#180),');
line('    cannot age (#186), cannot project — structurally blind to 2 of 3 consumers.');

// the detail rows for the md
line();
line('  -- detail --');
[Pete, Victor, Thomas].forEach((p) => {
  const caps = p.attrs.map((a) => fadedCapC(p, a));
  line(`  ${p.name}`);
  p.attrs.forEach((a, i) =>
    line(`    ${a.name.padEnd(8)} IV ${String(a.iv).padStart(2)} EV ${String(a.ev).padStart(3)} ×N${a.nature.toFixed(2)} disc ${attrDisc(p, a).toFixed(3)} → faded ${fmt(caps[i]).padStart(5)}   form ${fmt(formRead(a), 0).padStart(4)}   unfaded ${fmt(a.nature * (a.iv + a.ev))}`));
  line(`    manager ${fmt(managerRead(p))} = Σw·faded ${fmt(caps.reduce((s, c, i) => s + W[i] * c, 0))} + 0.5·Σw·form ${fmt(p.attrs.reduce((s, a, i) => s + W[i] * formRead(a), 0))}   scout(+2y) ${fmt(scoutRead(p))}   salary ${fmt(salaryRead(p))}`);
});
line();
line(`  → the port says Víctor is ${(portRead(Victor) / portRead(Pete)).toFixed(1)}× the player Pete is;`);
line(`    the scout says they are within ${pct(Math.abs(scoutRead(Pete) - scoutRead(Victor)) / Math.max(scoutRead(Pete), scoutRead(Victor)))} of each other going forward — and may rank the kid AHEAD.`);
line('    No single number can hold both truths. Only per-consumer combination can.');

// ════════════════════════════════════════════════════════════════════════════
// 2. ATTRIBUTION — the fading vet vs the prime vet: slump or decline?
// ════════════════════════════════════════════════════════════════════════════
line();
line('══ 2. ATTRIBUTION — Thomás is bad TODAY. Why? (the #184 scope extension) ══');
line('  The two forces live on DIFFERENT QUANTITIES (#181): the age-discount erodes',);
line('  capacity (slow, structural), the form-window holds the slump (fast,');
line('  mean-reverting). The scout DECOMPOSES the gap vs the prime-age self:');

// Thomás's prime-age self: same IVs, EVs at prime (EV stops growing — aggregate
// banked), form 0 — the honest "what he was at his peak" read.
const thomasPrimeAge = 30;
const ThomasPrime: Player = {
  ...Thomas, age: thomasPrimeAge,
  attrs: Thomas.attrs.map((a) => ({ ...a, form: [] })),
};
line();
line(`  ${'read'.padEnd(30)} ${'value'.padStart(6)}   what it is`);
line(`  ${'─'.repeat(30)} ${'─'.repeat(6)}   ${'─'.repeat(40)}`);
line(`  ${'unfaded aggregate (salary)'.padEnd(30)} ${fmt(salaryRead(Thomas)).padStart(6)}   the career resume — never fades (#181)`);
line(`  ${'capacity at prime (30)'.padEnd(30)} ${fmt(managerRead(ThomasPrime)).padStart(6)}   same tools, same banked EV, no slump`);
line(`  ${'faded capacity at 36'.padEnd(30)} ${fmt(Thomas.attrs.reduce((s, a, i) => s + W[i] * fadedCapC(Thomas, a), 0)).padStart(6)}   structural: the age-discount's bite`);
line(`  ${'+ form drag'.padEnd(30)} ${fmt(Thomas.attrs.reduce((s, a, i) => s + W[i] * formRead(a), 0) * FORM_W).padStart(6)}   temporary: the slump window`);
line(`  ${'= manager read TODAY'.padEnd(30)} ${fmt(managerRead(Thomas)).padStart(6)}   what the lineup sees`);
line();
const primeCap = managerRead(ThomasPrime);
const fadedCap = Thomas.attrs.reduce((s, a, i) => s + W[i] * fadedCapC(Thomas, a), 0);
const formDrag = Thomas.attrs.reduce((s, a, i) => s + W[i] * formRead(a), 0) * FORM_W;
const gap = primeCap - managerRead(Thomas);
const structShare = (primeCap - fadedCap) / gap;
line(`  → of the ${fmt(gap)} gap vs his prime self: ${pct(structShare)} is STRUCTURAL (age),`);
line(`    ${pct(1 - structShare)} is FORM (the window). Prognosis: expect reversion toward`);
line(`    ${fmt(fadedCap)} (capacity), NOT ${fmt(primeCap)} (prime) and NOT ${fmt(managerRead(Thomas))} (today):`);
line('    "rest him, buy-low if priced off today — but he is not the resume, either."');
line('    The scout does not CHOOSE between slump and decline — the partition hands');
line('    him both, separately sized. (Víctor\'s same-sized gap, by contrast, rides on an', );
line('    undented capacity — his one structural term is a 0.924 discount on a single');
line('    attr: form-noise dominates at 27.)');
line();
line('  THE PORT SEES NONE OF IT. Its number for Thomás today:');
line(`    port = ${fmt(portRead(Thomas))} — an all-time career HIGH (EV is monotonic; nothing ages).`);
line('    The port attributes nothing because the port noticed nothing: it would grade');
line('    the 36-yo slump ABOVE the 27-yo MVP. Monotonic aggregate + no aging = a');
line('    structurally pro-veteran, anti-prospect read. Scouting is where the port');

// career sweep: port vs true (manager) value over Thomás's career
line('    fails HARDEST — watch the two curves cross:');
line();
line(`  ${'age'.padStart(3)} | ${'port (aggregate)'.padStart(16)} | ${'manager read (true)'.padStart(19)}`);
line(`  ${'─'.repeat(3)}─┼─${'─'.repeat(16)}─┼─${'─'.repeat(19)}`);
// illustrative career: EV accrues linearly 18→30 to 5/6 of today's totals, then at half-rate to 36, flat after
const evAt = (ev36: number, age: number) => {
  if (age <= 30) return (ev36 * 5 / 6) * ((age - 18) / 12);        // linear 18→30
  if (age <= 36) return ev36 * 5 / 6 + (ev36 / 36) * (age - 30);  // slower 30→36
  return ev36;                                                     // banked after 36
};
for (const age of [24, 26, 28, 30, 32, 34, 36, 38]) {
  const T: Player = {
    ...Thomas, age,
    attrs: Thomas.attrs.map((a) => ({ ...a, ev: evAt(a.ev, age), form: [] })), // slump stripped — capacity curve
  };
  const port = T.attrs.reduce((s, a, i) => s + W[i] * a.nature * (a.iv + a.ev), 0);
  line(`  ${String(age).padStart(3)} | ${fmt(port).padStart(16)} | ${fmt(managerRead(T)).padStart(19)}`);
}
line('  (EV accrual illustrative: linear to a prime-era peak by 30, half-rate to 36, flat after.)');
line('  → the port RISES monotonically — "best ever" at 36+ — while the true read');
line('    peaks ~30 and falls. The two curves CROSS around the early 30s: past that');
line('    point the port scout is not merely uninformative, he is INVERTED.');

// ════════════════════════════════════════════════════════════════════════════
// 3. THE TWIN VETERANS — same rating at 33, different futures ((b) vs (c))
//    + the elite pair from #186 re-read through the scout (compression angle)
// ════════════════════════════════════════════════════════════════════════════
line();
line('══ 3a. TWIN VETERANS, 33 — same rating, opposite composition ══');
line('  same prime (28), same accel (0.018), same Nature — composition is the ONLY');
line('  difference: Tomás is INNATE-built (tools), Cristóbal is EARNED-built (craft).');
const TwinTools: Player = { // IV-heavy
  name: 'Tomás (innate-built)', age: 33, prime: 28, accel: 0.018,
  attrs: [
    { name: 'Eye',     iv: 32, ev: 48, nature: 1.00, form: [] },
    { name: 'Contact', iv: 30, ev: 52, nature: 1.00, form: [] },
    { name: 'Power',   iv: 26, ev: 42, nature: 1.10, form: [] },
  ],
};
const TwinCraft: Player = { // EV-heavy, same rough totals
  name: 'Cristóbal (earned-built)', age: 33, prime: 28, accel: 0.018,
  attrs: [
    { name: 'Eye',     iv: 18, ev: 60, nature: 1.00, form: [] },
    { name: 'Contact', iv: 17, ev: 66, nature: 1.00, form: [] },
    { name: 'Power',   iv: 16, ev: 50, nature: 1.10, form: [] },
  ],
};
// (b) subtractive erosion: faded = Nature × ((IV+EV) − Δ), Δ = (1−disc)·(IV+EV)
//     [the curve's bite, applied to the WHOLE raw — composition-blind]
const fadedCapB = (p: Player, a: Attr, atAge?: number) => {
  const d = attrDisc(p, a, atAge);
  return a.nature * ((a.iv + a.ev) - (1 - d) * (a.iv + a.ev));
};
const readAt = (p: Player, age: number, mech: 'b' | 'c') =>
  clamp(p.attrs.reduce((s, a, i) =>
    s + W[i] * (mech === 'c' ? fadedCapC(p, a, age) : fadedCapB(p, a, age)), 0), -C, +C);
line();
line(`  today (33):  Tomás ${fmt(readAt(TwinTools, 33, 'c'))} vs Cristóbal ${fmt(readAt(TwinCraft, 33, 'c'))} — similarly rated. Port says`);
line(`  ${fmt(portRead(TwinTools))} vs ${fmt(portRead(TwinCraft))}: near-identical too. The question is the FUTURE a scout projects:`);
line();
line(`  ${'age'.padStart(3)} | ${'(c) IV-only: Tomás / Cristóbal'.padEnd(30)} | ${'(b) subtractive: Tomás / Cristóbal'.padEnd(32)}`);
line(`  ${'─'.repeat(3)}─┼─${'─'.repeat(30)}─┼─${'─'.repeat(32)}`);
[33, 35, 37, 40].forEach((age) => {
  const tc = readAt(TwinTools, age, 'c'), cc = readAt(TwinCraft, age, 'c');
  const tb = readAt(TwinTools, age, 'b'), cb = readAt(TwinCraft, age, 'b');
  line(`  ${String(age).padStart(3)} | ${(fmt(tc) + ' / ' + fmt(cc) + (age > 33 ? '   Δ' + fmt(cc - tc) : '')).padEnd(30)} | ${(fmt(tb) + ' / ' + fmt(cb) + (age > 33 ? '   Δ' + fmt(cb - tb) : '')).padEnd(32)}`);
});
line();
const d7c = readAt(TwinCraft, 40, 'c') - readAt(TwinTools, 40, 'c');
const d7b = readAt(TwinCraft, 40, 'b') - readAt(TwinTools, 40, 'b');
line(`  → under (c) the twins' futures SEPARATE (Δ${fmt(d7c)} by 40): the innate-built`);
line("    player's value sits in IV, which fades; the earned-built player's sits in EV,");
line('    which resists. The scout reads the composition and grades them DIFFERENTLY.');
line(`  → under (b) the twins are INTERCHANGEABLE (Δ${fmt(d7b)} by 40): the tax hits the`);
line('    whole raw equally, so two same-rated players decline as one — the storage');
line('    distinction (IV vs EV) never reaches the consumer. The scout\'s report');
line('    degenerates to "he is 33; he declines k%."');
line('  → THIRD VOTE FOR (c), new angle: not which curve is more poetic on the field');
line('    (#186) nor which lands kinder on the earned (#187) — but which mechanic');
line('    makes aging LEGIBLE TO THE CONSUMER. Under (c), decline has STRUCTURE the');
line('    storage already knows (wheels go, craft stays); under (b) it is one flat');
line('    tax. (Still the author\'s feel-call — evidence only, posted on #184.)');

line();
line('══ 3b. ELITE COMPRESSION, SCOUT\'S ANGLE — #186\'s ace pair re-read ══');
line('  Two aces, same peak profile, different aging meta-modulators (prime 25/28).');
line('  During the prime flat-top the GAME read pins both at +C (blurred, #186).');
line('  What does the SCOUT see during the blur?');
const elite = (prime: number, accel: number): Player => ({
  name: `elite(prime ${prime})`, age: 25, prime, accel,
  attrs: [ // #186's peak profile: Stuff/Command/Control → mapped Eye/Contact/Power weights .5/.3/.2 there;
    { name: 'Eye',     iv: 26, ev: 82, nature: 1.10, form: [] }, // fast lane (fade 0.6? no—use #186 shape below)
    { name: 'Contact', iv: 21, ev: 64, nature: 0.90, form: [] },
    { name: 'Power',   iv: 18, ev: 46, nature: 1.00, form: [] },
  ],
});
// #186's per-attr shape: fast ×1.4 (mapped to Power here), slow ×0.6 (Contact), mid ×1.0 (Eye);
// prime offsets −1/+2/0. Override PROFILE locally for this pair:
const P186: Record<string, { pOff: number; fade: number }> = {
  Eye: { pOff: 0, fade: 1.0 }, Contact: { pOff: +2, fade: 0.6 }, Power: { pOff: -1, fade: 1.4 },
};
const saveProfile = { ...PROFILE }; Object.assign(PROFILE, P186);
const ColeE = elite(25, 0.045), MarcusE = elite(28, 0.025);
const WE = [0.3, 0.4, 0.3];
const gameRead = (p: Player, age: number) =>
  clamp(p.attrs.reduce((s, a, i) => s + WE[i] * fadedCapC(p, a, age), 0), -C, +C);
const scoutAt = (p: Player, now: number) => {
  const q: Player = { ...p, age: now };
  let v = 0;
  q.attrs.forEach((a, i) => {
    const prime = p.prime + PROFILE[a.name].pOff;
    const headroom = Math.min(1, Math.max(0, prime - now) / 6);
    const evAtPrime = a.ev + a.iv * headroom;
    v += WE[i] * a.nature * (a.iv + 0.5 * evAtPrime) * attrDisc(q, a, now + 2);
  });
  return v;
};
line();
line(`  ${'age 25 (flat-top)'.padEnd(28)} ${'Toolsy Cole'.padStart(12)} ${'Crafty Marcus'.padStart(14)}`);
line(`  ${'─'.repeat(28)} ${'─'.repeat(12)} ${'─'.repeat(14)}`);
line(`  ${'game read (today, clamped)'.padEnd(28)} ${fmt(gameRead(ColeE, 25)).padStart(12)} ${fmt(gameRead(MarcusE, 25)).padStart(14)}`);
line(`  ${'scout\'s 2-year projection'.padEnd(28)} ${fmt(scoutAt(ColeE, 25)).padStart(12)} ${fmt(scoutAt(MarcusE, 25)).padStart(14)}`);
line();
line(`  game: ${fmt(gameRead(ColeE, 25))} vs ${fmt(gameRead(MarcusE, 25))} — both pinned AT +C: BLURRED (identical reads).`);
line(`  scout: ${fmt(scoutAt(ColeE, 25))} vs ${fmt(scoutAt(MarcusE, 25))} — the projection already separates them: Cole's`);
line('    fast accel bites INSIDE the projection window; Marcus is still pre-prime.');
line('  → COMPRESSION BINDS THE GAME-READ, NOT THE SCOUT. The blur lives in ONE');
line('    formula\'s clamp; the talent-read is built from pre-clamp storage (IV, EV,');
line('    the aging meta-modulator) + trajectory, so the ceiling never blinded it.');
line('    #186\'s "distinct on the decline" now has its missing half: the scout sees');
line('    the split DURING the flat-top, not only after it.');
Object.assign(PROFILE, saveProfile);

line();
line('══ OUTCOME ══');
line('  1. The three-consumer read works from ONE tuple: manager/scout/salary each');
line('     crown a different player, each right for its purpose. The port is exactly');
line('     the salary read and nothing else — scouting is where the port fails hardest');
line('     (pro-veteran, anti-prospect, structurally).');
line('  2. Attribution: the #181 partition hands the scout BOTH forces, separately');
line('     sized — slump and decline are not a judgement call but a decomposition.');
line('     The port sees neither force at all (its number is an all-time high).');
line('  3. Twins: only (c) lets the storage\'s IV/EV composition reach the consumer —');
line('     (b) makes same-rated veterans interchangeable. Third vote for (c) (author\'s');
line('     feel-call). Compression: the +C blur never blinded the scout (pre-clamp');
line('     read); #186\'s pair splits DURING the flat-top.');
