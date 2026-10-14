import test from "node:test";
import assert from "node:assert/strict";
import * as L from "./logic.js";

const rng = () => L.mulberry32(42);

test("a planned pitch arrives exactly at the planned plate location at time T", () => {
  for (const type of Object.keys(L.PITCHES)) {
    const plan = L.planPitch(type, { x: 0.1, y: 0.8 }, rng(), 0.05);
    const [x, y, z] = L.pitchPosition(plan, plan.T);
    assert.ok(Math.abs(x - plan.plate[0]) < 1e-9, `${type} x`);
    assert.ok(Math.abs(y - plan.plate[1]) < 1e-9, `${type} y`);
    assert.ok(Math.abs(z) < 1e-9, `${type} z`);
  }
});

test("breaking balls take longer and drop more than a fastball", () => {
  const fast = L.planPitch("fastball", { x: 0, y: 0.8 }, rng(), 0);
  const curve = L.planPitch("curve", { x: 0, y: 0.8 }, rng(), 0);
  assert.ok(curve.T > fast.T);
  const mid = (p) => L.pitchPosition(p, p.T * 0.5)[1];
  assert.ok(mid(curve) - curve.plate[1] > mid(fast) - fast.plate[1]);
});

test("strike zone includes the edges (ball overlap) and excludes clear balls", () => {
  assert.equal(L.isStrike(0, 0.8), true);
  assert.equal(L.isStrike(L.ZONE.halfWidth + 0.03, 0.8), true);
  assert.equal(L.isStrike(L.ZONE.halfWidth + 0.1, 0.8), false);
  assert.equal(L.isStrike(0, L.ZONE.bottom - 0.2), false);
  assert.equal(L.isStrike(0, L.ZONE.top + 0.2), false);
});

test("perfect timing and aim gives a perfect hit; bad timing misses", () => {
  const plan = L.planPitch("fastball", { x: 0, y: 0.8 }, rng(), 0);
  const perfect = L.evaluateSwing(plan, { e: 0, ax: plan.plate[0], ay: plan.plate[1] - 0.03 }, rng());
  assert.equal(perfect.contact, true);
  assert.equal(perfect.grade, "perfect");
  assert.ok(perfect.exitSpeed > 44);
  const late = L.evaluateSwing(plan, { e: 0.2, ax: plan.plate[0], ay: plan.plate[1] }, rng());
  assert.equal(late.contact, false);
  const wide = L.evaluateSwing(plan, { e: 0, ax: plan.plate[0] + 0.4, ay: plan.plate[1] }, rng());
  assert.equal(wide.contact, false);
});

test("early swings pull (left field) and late swings go the other way", () => {
  const plan = L.planPitch("fastball", { x: 0, y: 0.8 }, rng(), 0);
  const early = L.evaluateSwing(plan, { e: -0.06, ax: 0, ay: 0.8 }, rng());
  const late = L.evaluateSwing(plan, { e: 0.06, ax: 0, ay: 0.8 }, rng());
  assert.ok(early.spray < -10);
  assert.ok(late.spray > 10);
});

test("batted ball physics: sensible distances and home run detection", () => {
  const weak = L.simulateFlight([0, 1, 0], 25, 28, 0);
  assert.ok(weak.landing.dist > 35 && weak.landing.dist < 70);
  const good = L.simulateFlight([0, 1, 0], 40, 28, 0);
  assert.ok(good.landing.dist > 85 && good.landing.dist < 115);
  const crush = L.simulateFlight([0, 1, 0], 48, 30, 0);
  assert.equal(crush.crossing.kind, "homerun");
  assert.ok(crush.crossing.y > L.FENCE_H);
});

test("a ground ball never counts as a wall hit and stops rolling", () => {
  const f = L.simulateFlight([0, 1, 0], 40, 0, 10);
  assert.equal(f.crossing, null);
  assert.ok(f.end[0] < 20);
});

test("foul balls are classified by spray angle", () => {
  const swing = { spray: 60, launch: 20, exitSpeed: 35 };
  const flight = L.simulateFlight([0, 1, 0], 35, 20, 60);
  assert.equal(L.classifyBattedBall(swing, flight, rng()).result, "foul");
});

test("walk after four balls, forced runner advance and bases-loaded run", () => {
  const g = L.newGame("bat");
  const r = rng();
  for (let i = 0; i < 4; i++) L.applyOutcome(g, "ball", r);
  assert.deepEqual(g.bases, [true, false, false]);
  assert.equal(g.balls, 0);
  for (let i = 0; i < 4; i++) L.applyOutcome(g, "ball", r);
  assert.deepEqual(g.bases, [true, true, false]);
  for (let i = 0; i < 4; i++) L.applyOutcome(g, "ball", r);
  assert.deepEqual(g.bases, [true, true, true]);
  for (let i = 0; i < 4; i++) L.applyOutcome(g, "ball", r);
  assert.equal(g.runs, 1);
});

test("strikeout, foul with two strikes, and three outs end the inning", () => {
  const g = L.newGame("bat");
  const r = rng();
  L.applyOutcome(g, "strike", r);
  L.applyOutcome(g, "swing_miss", r);
  L.applyOutcome(g, "foul", r);
  assert.equal(g.strikes, 2);
  const ev = L.applyOutcome(g, "swing_miss", r);
  assert.ok(ev.includes("삼진 아웃!"));
  assert.equal(g.outs, 1);
  L.applyOutcome(g, "out", r);
  const ev3 = L.applyOutcome(g, "out", r);
  assert.ok(ev3.includes("이닝 종료"));
  assert.equal(g.inning, 2);
  assert.equal(g.outs, 0);
});

test("home run with runners on scores everyone; game ends after the last inning", () => {
  const g = L.newGame("bat");
  g.bases = [true, true, true];
  L.applyOutcome(g, "homerun", rng());
  assert.equal(g.runs, 4);
  assert.deepEqual(g.bases, [false, false, false]);
  for (let i = 0; i < L.INNINGS * 3; i++) L.applyOutcome(g, "out", rng());
  assert.equal(g.over, true);
});

test("triples and doubles move runners correctly", () => {
  const g = L.newGame("bat");
  g.bases = [true, false, false];
  L.applyOutcome(g, "double", rng());
  assert.deepEqual(g.bases, [false, true, true]);
  L.applyOutcome(g, "triple", rng());
  assert.equal(g.runs, 2);
  assert.deepEqual(g.bases, [false, false, true]);
});

test("CPU pitcher and batter produce valid, reproducible decisions", () => {
  const g = L.newGame("bat");
  const a = L.cpuPitchChoice(g, L.mulberry32(5));
  const b = L.cpuPitchChoice(g, L.mulberry32(5));
  assert.deepEqual(a, b);
  assert.ok(a.type in L.PITCHES);
  const plan = L.planPitch(a.type, a.target, L.mulberry32(6), 0.06);
  const s = L.cpuBatterSwing(plan, g, L.mulberry32(7));
  assert.equal(typeof s.swing, "boolean");
});

test("CPU batter stays in a believable range over many plate appearances", () => {
  const r = L.mulberry32(99);
  let pa = 0;
  let hits = 0;
  let ks = 0;
  let bbs = 0;
  for (let i = 0; i < 3000; i++) {
    const st = L.newGame("pitch");
    for (;;) {
      const c = L.cpuPitchChoice(st, r);
      const plan = L.planPitch(c.type, c.target, r, 0.06);
      const sw = L.cpuBatterSwing(plan, st, r);
      let o;
      if (!sw.swing) o = L.isStrike(...plan.plate) ? "strike" : "ball";
      else {
        const res = L.evaluateSwing(plan, sw, r);
        if (!res.contact) o = "swing_miss";
        else o = L.classifyBattedBall(res, L.simulateFlight([0, 1, 0], res.exitSpeed, res.launch, res.spray), r).result;
      }
      const ev = L.applyOutcome(st, o, r);
      if (st.balls === 0 && st.strikes === 0 && o !== "foul") {
        pa++;
        if (["single", "double", "triple", "homerun"].includes(o)) hits++;
        if (ev.includes("삼진 아웃!")) ks++;
        if (ev.includes("볼넷!")) bbs++;
        break;
      }
    }
  }
  const avg = hits / (pa - bbs);
  assert.ok(avg > 0.2 && avg < 0.42, `avg ${avg}`);
  assert.ok(ks / pa > 0.12 && ks / pa < 0.35, `k ${ks / pa}`);
});
