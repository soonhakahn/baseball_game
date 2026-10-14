// Pure game logic for the 3D baseball game (no DOM, no three.js) so it can run in Node tests.
// Units: meters and seconds. Home plate is the origin. The pitcher is at -z, the outfield at -z,
// first base side is +x. Spray angle 0 = center field, positive = right field.

export const ZONE = { halfWidth: 0.216, bottom: 0.5, top: 1.1 };
export const BALL_R = 0.037;
export const RELEASE = [0.3, 1.8, -17.2];
export const SWING_LAG = 0.09; // seconds from tap to the bat crossing the plate
export const TOL = { time: 0.13, pos: 0.22 };
export const FOUL_ANGLE = 45;
export const FENCE_H = 3;
export const INNINGS = 3;

export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rng) {
  const u = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------- pitching
export const PITCHES = {
  fastball: { label: "직구", speed: 28, move: [0.0, -0.05] },
  slider: { label: "슬라이더", speed: 24, move: [-0.3, -0.12] },
  curve: { label: "커브", speed: 20, move: [-0.12, -0.5] },
  changeup: { label: "체인지업", speed: 19, move: [0.06, -0.22] },
};

// target = intended location on the plate plane. The ball visibly breaks late (quadratic in time).
export function planPitch(type, target, rng, control = 0.05) {
  const p = PITCHES[type];
  const px = target.x + gaussian(rng) * control;
  const py = target.y + gaussian(rng) * control;
  return {
    type,
    label: p.label,
    speed: p.speed,
    kmh: Math.round(p.speed * 3.6 * 1.4),
    move: p.move,
    release: RELEASE,
    aim: [px - p.move[0], py - p.move[1], 0],
    plate: [px, py],
    T: -RELEASE[2] / p.speed,
  };
}

export function pitchPosition(plan, t) {
  const s = t / plan.T;
  const R = plan.release;
  const A = plan.aim;
  const m = plan.move;
  return [
    R[0] + (A[0] - R[0]) * s + m[0] * s * s,
    R[1] + (A[1] - R[1]) * s + m[1] * s * s,
    R[2] + (A[2] - R[2]) * s,
  ];
}

export function isStrike(px, py) {
  return (
    Math.abs(px) <= ZONE.halfWidth + BALL_R &&
    py >= ZONE.bottom - BALL_R &&
    py <= ZONE.top + BALL_R
  );
}

export function isNearZone(px, py, margin) {
  return (
    Math.abs(px) <= ZONE.halfWidth + BALL_R + margin &&
    py >= ZONE.bottom - BALL_R - margin &&
    py <= ZONE.top + BALL_R + margin
  );
}

// ---------------------------------------------------------------- batting
// e: seconds the bat is late (+) or early (-) relative to the ball reaching the plate.
// (ax, ay): where the bat crosses the plate plane.
export function evaluateSwing(plan, { e, ax, ay }, rng) {
  const [px, py] = plan.plate;
  const d = Math.hypot(ax - px, ay - py);
  const q = Math.max(0, 1 - Math.hypot(e / TOL.time, d / TOL.pos));
  if (q <= 0) return { contact: false, q: 0, e, d };
  const dy = py - ay;
  return {
    contact: true,
    q,
    e,
    d,
    grade: q >= 0.75 ? "perfect" : q >= 0.4 ? "good" : "weak",
    exitSpeed: 17 + 31 * Math.pow(q, 0.7),
    launch: clamp(14 + dy * 170 + gaussian(rng) * 3, -20, 70),
    spray: clamp((e / TOL.time) * 55 + gaussian(rng) * 4, -80, 80),
  };
}

export function fenceDist(sprayDeg) {
  return 100 - 0.12 * Math.abs(sprayDeg);
}

const G = 9.81;
const DRAG = 0.0055;
const LIFT = 0.0022;

export function simulateFlight(start, exitSpeed, launchDeg, sprayDeg) {
  const L = (launchDeg * Math.PI) / 180;
  const S = (sprayDeg * Math.PI) / 180;
  let [x, y, z] = [start[0], Math.max(start[1], 0.05), start[2]];
  const hs = exitSpeed * Math.cos(L);
  let vx = hs * Math.sin(S);
  let vz = -hs * Math.cos(S);
  let vy = exitSpeed * Math.sin(L);
  const spin = clamp(launchDeg / 22, 0, 1);
  const dt = 0.005;
  const path = [[0, x, y, z]];
  let t = 0;
  let landing = null;
  let crossing = null;
  let rolling = false;
  for (let i = 0; i < 4000; i++) {
    const hsp = Math.hypot(vx, vz);
    const sp = Math.hypot(hsp, vy);
    if (!rolling) {
      const hx = hsp > 1e-6 ? vx / hsp : 0;
      const hz = hsp > 1e-6 ? vz / hsp : 0;
      const alpha = Math.atan2(vy, hsp);
      const lift = LIFT * spin * sp * sp;
      vx += (-DRAG * sp * vx - lift * Math.sin(alpha) * hx) * dt;
      vz += (-DRAG * sp * vz - lift * Math.sin(alpha) * hz) * dt;
      vy += (-G - DRAG * sp * vy + lift * Math.cos(alpha)) * dt;
    } else {
      const f = Math.max(0, 1 - (7 * dt) / Math.max(hsp, 1e-6));
      vx *= f;
      vz *= f;
    }
    x += vx * dt;
    z += vz * dt;
    y += vy * dt;
    t += dt;
    if (y <= 0 && !rolling) {
      y = 0;
      if (!landing) landing = { t, x, z, dist: Math.hypot(x, z) };
      vy = -vy * 0.45;
      vx *= 0.78;
      vz *= 0.78;
      if (Math.abs(vy) < 1.2) {
        vy = 0;
        rolling = true;
      }
    }
    const r = Math.hypot(x, z);
    const phi = (Math.atan2(x, -z) * 180) / Math.PI;
    if (!crossing && y > 0.3 && r >= fenceDist(phi) && Math.abs(phi) <= FOUL_ANGLE) {
      crossing = { t, y, x, z, kind: y > FENCE_H ? "homerun" : "wall" };
      if (crossing.kind === "wall") {
        path.push([t, x, y, z]);
        break;
      }
    }
    if (i % 4 === 0) path.push([t, x, y, z]);
    if (rolling && Math.hypot(vx, vz) < 0.4) break;
    if (r > 140) break;
  }
  return { path, landing, crossing, end: path[path.length - 1] };
}

const FIELDERS = [
  { name: "3루수", x: -17, z: -22, infield: true },
  { name: "유격수", x: -9, z: -30, infield: true },
  { name: "2루수", x: 9, z: -30, infield: true },
  { name: "1루수", x: 17, z: -21, infield: true },
  { name: "좌익수", x: -37.5, z: -65 },
  { name: "중견수", x: 0, z: -80 },
  { name: "우익수", x: 37.5, z: -65 },
];
export { FIELDERS };
export const FIELDING = { speed: 10, reaction: 0.25 };

// Returns { result: foul|homerun|double|triple|single|out, kind, note }.
export function classifyBattedBall(swing, flight, rng) {
  if (Math.abs(swing.spray) > FOUL_ANGLE) return { result: "foul", kind: "foul" };
  if (flight.crossing && flight.crossing.kind === "homerun") return { result: "homerun", kind: "fly" };
  const land = flight.landing;
  const launch = swing.launch;
  if (flight.crossing && flight.crossing.kind === "wall") return { result: "double", kind: "fly", note: "펜스 직격" };

  if (launch < 8) {
    // ground ball: can an infielder reach it?
    const xl = Math.tan((swing.spray * Math.PI) / 180) * 24;
    const dist = Math.min(...FIELDERS.filter((f) => f.infield).map((f) => Math.abs(xl - f.x)));
    const reach = clamp(6.5 - 0.09 * swing.exitSpeed, 1.8, 6);
    if (dist <= reach && rng() < 0.92) return { result: "out", kind: "ground", note: "땅볼 아웃" };
    return { result: "single", kind: "ground", note: "내야를 뚫는 안타" };
  }

  const kind = launch > 50 ? "pop" : launch > 22 ? "fly" : "line";
  const runTime = Math.min(
    ...FIELDERS.map((f) => (Math.hypot(land.x - f.x, land.z - f.z) / FIELDING.speed) + FIELDING.reaction),
  );
  if (runTime <= land.t) {
    return { result: "out", kind, note: kind === "line" ? "라인드라이브 아웃" : kind === "pop" ? "내야 플라이 아웃" : "뜬공 아웃" };
  }
  const D = land.dist;
  if (D < 55) return { result: "single", kind };
  if (D < 85) return { result: rng() < 0.8 ? "single" : "double", kind };
  return { result: rng() < 0.85 ? "double" : "triple", kind };
}

// ---------------------------------------------------------------- game state
export function newGame(mode) {
  return { mode, inning: 1, outs: 0, balls: 0, strikes: 0, bases: [false, false, false], runs: 0, hits: 0, over: false };
}

function advance(bases, taken, rng) {
  const nb = [false, false, false];
  let runs = 0;
  for (let i = 0; i < 3; i++) {
    if (!bases[i]) continue;
    if (taken === 1 && i === 1 && rng() < 0.6) {
      runs++;
      continue;
    }
    const dest = i + 1 + taken;
    if (dest >= 4) runs++;
    else nb[dest - 1] = true;
  }
  if (taken >= 4) runs++;
  else nb[taken - 1] = true;
  return { bases: nb, runs };
}

function walk(bases) {
  const b = [...bases];
  let runs = 0;
  if (!b[0]) b[0] = true;
  else if (!b[1]) b[1] = true;
  else if (!b[2]) b[2] = true;
  else runs = 1;
  return { bases: b, runs };
}

// outcome: ball | strike | swing_miss | foul | single | double | triple | homerun | out
export function applyOutcome(state, outcome, rng) {
  const events = [];
  const endPA = () => {
    state.balls = 0;
    state.strikes = 0;
  };
  const addOut = (text) => {
    state.outs++;
    if (text) events.push(text);
    endPA();
    if (state.outs >= 3) {
      events.push("이닝 종료");
      state.outs = 0;
      state.bases = [false, false, false];
      state.inning++;
      if (state.inning > INNINGS) {
        state.over = true;
        events.push("게임 종료!");
      }
    }
  };
  switch (outcome) {
    case "ball":
      state.balls++;
      if (state.balls >= 4) {
        const w = walk(state.bases);
        state.bases = w.bases;
        state.runs += w.runs;
        events.push("볼넷!");
        endPA();
      }
      break;
    case "strike":
    case "swing_miss":
      state.strikes++;
      if (state.strikes >= 3) addOut("삼진 아웃!");
      break;
    case "foul":
      if (state.strikes < 2) state.strikes++;
      break;
    case "single":
    case "double":
    case "triple":
    case "homerun": {
      const taken = { single: 1, double: 2, triple: 3, homerun: 4 }[outcome];
      const r = advance(state.bases, taken, rng);
      state.bases = r.bases;
      state.runs += r.runs;
      state.hits++;
      if (r.runs > 0) events.push(`${r.runs}득점!`);
      endPA();
      break;
    }
    case "out":
      addOut(null);
      break;
    default:
      throw new Error(`unknown outcome ${outcome}`);
  }
  return events;
}

// ---------------------------------------------------------------- CPU opponents
export function cpuPitchChoice(state, rng) {
  const r = rng();
  let type = r < 0.45 ? "fastball" : r < 0.65 ? "slider" : r < 0.82 ? "curve" : "changeup";
  if (state.strikes === 2 && rng() < 0.4) type = rng() < 0.5 ? "curve" : "slider";
  let x;
  let y;
  if (rng() < 0.6) {
    x = (rng() * 2 - 1) * 0.18;
    y = ZONE.bottom + 0.08 + rng() * (ZONE.top - ZONE.bottom - 0.16);
  } else if (rng() < 0.5) {
    x = (rng() < 0.5 ? -1 : 1) * (0.24 + rng() * 0.25);
    y = ZONE.bottom + rng() * 0.6;
  } else {
    x = (rng() * 2 - 1) * 0.3;
    y = rng() < 0.5 ? ZONE.bottom - 0.1 - rng() * 0.25 : ZONE.top + 0.08 + rng() * 0.2;
  }
  return { type, target: { x, y } };
}

export const CPU = { zoneSwing: 0.7, nearSwing: 0.35, farSwing: 0.07, sigE: 0.085, sigEMove: 0.09, sigD: 0.115, sigDMove: 0.06 };

export function cpuBatterSwing(plan, state, rng) {
  const [px, py] = plan.plate;
  let p = isStrike(px, py) ? CPU.zoneSwing : isNearZone(px, py, 0.12) ? CPU.nearSwing : CPU.farSwing;
  if (state.strikes === 2) p = Math.min(0.95, p + 0.2);
  if (rng() > p) return { swing: false };
  const moveMag = Math.hypot(plan.move[0], plan.move[1]);
  const sigE = CPU.sigE + CPU.sigEMove * moveMag;
  const sigD = CPU.sigD + CPU.sigDMove * moveMag;
  return {
    swing: true,
    e: gaussian(rng) * sigE,
    ax: px + gaussian(rng) * sigD,
    ay: py + gaussian(rng) * sigD,
  };
}
