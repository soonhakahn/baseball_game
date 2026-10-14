import * as THREE from "three";
import * as L from "./logic.js";

const $ = (id) => document.getElementById(id);
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9ff);
scene.fog = new THREE.Fog(0x8ec9ff, 80, 280);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7a3a, 1.0));
const sun = new THREE.DirectionalLight(0xffffff, 0.8);
sun.position.set(20, 40, 15);
scene.add(sun);

// ------------------------------------------------------------------ scene
const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
function put(mesh, x, y, z, ry = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  scene.add(mesh);
  return mesh;
}
function flat(geo, color, x, y, z, ry = 0) {
  geo.rotateX(-Math.PI / 2);
  return put(new THREE.Mesh(geo, mat(color)), x, y, z, ry);
}

flat(new THREE.PlaneGeometry(600, 600), 0x3b8d3f, 0, 0, 0);
flat(new THREE.CircleGeometry(28, 56), 0xb98a5e, 0, 0.01, -19.4);
flat(new THREE.PlaneGeometry(19.8, 19.8), 0x3b8d3f, 0, 0.02, -19.4, Math.PI / 4);
put(new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.9, 0.25, 28), mat(0xb98a5e)), 0, 0.125, -18.44);
put(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.15), mat(0xffffff)), 0, 0.27, -18.44);
{
  const s = new THREE.Shape();
  [[-0.216, 0.216], [0.216, 0.216], [0.216, 0], [0, -0.216], [-0.216, 0]].forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  flat(new THREE.ShapeGeometry(s), 0xffffff, 0, 0.03, 0);
}
for (const [x, z] of [[19.4, -19.4], [0, -38.8], [-19.4, -19.4]]) {
  put(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.4), mat(0xffffff)), x, 0.05, z, Math.PI / 4);
}
for (const [ry, sx] of [[Math.PI / 4, 1], [(3 * Math.PI) / 4, -1]]) {
  put(new THREE.Mesh(new THREE.BoxGeometry(105, 0.02, 0.12), mat(0xffffff)), sx * 37.1, 0.03, -37.1, ry);
}
{
  const pos = [];
  const idx = [];
  const steps = 30;
  for (let i = 0; i <= steps; i++) {
    const phi = -L.FOUL_ANGLE + (i * 2 * L.FOUL_ANGLE) / steps;
    const r = L.fenceDist(phi);
    const x = r * Math.sin((phi * Math.PI) / 180);
    const z = -r * Math.cos((phi * Math.PI) / 180);
    pos.push(x, 0, z, x, L.FENCE_H, z);
    if (i < steps) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0x1e3f7a, side: THREE.DoubleSide })));
}

// batter + bat
const batter = new THREE.Group();
batter.position.set(-0.85, 0, 0.15);
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.55, 4, 10), mat(0x2a4fa8));
  body.position.y = 1.2;
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), mat(0xe8e8e8));
  legs.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(0xf0c8a0));
  head.position.y = 1.78;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1c2f66));
  helmet.position.y = 1.8;
  batter.add(body, legs, head, helmet);
  scene.add(batter);
}
const batPivot = new THREE.Group();
batPivot.position.set(-0.55, 1.0, 0);
const batTilt = new THREE.Group();
{
  const g = new THREE.CylinderGeometry(0.045, 0.03, 0.95, 10);
  g.rotateZ(-Math.PI / 2);
  g.translate(0.45, 0, 0);
  batTilt.add(new THREE.Mesh(g, mat(0xc79a5b)));
  batPivot.add(batTilt);
  scene.add(batPivot);
}

// pitcher
const pitcher = new THREE.Group();
pitcher.position.set(0, 0.25, L.RELEASE[2] - 1.2);
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 4, 10), mat(0xc23b3b));
  body.position.y = 1.15;
  const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 4, 8), mat(0xe8e8e8));
  legs.position.y = 0.5;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mat(0xf0c8a0));
  head.position.y = 1.75;
  pitcher.add(body, legs, head);
  scene.add(pitcher);
}

// fielders
const fielders = L.FIELDERS.map((f) => {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.7, 4, 10), mat(f.infield ? 0xc23b3b : 0xa82f2f));
  body.position.y = 0.9;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mat(0xf0c8a0));
  head.position.y = 1.55;
  g.add(body, head);
  g.userData = { home: new THREE.Vector3(f.x, 0, f.z) };
  g.position.copy(g.userData.home);
  scene.add(g);
  return g;
});

// ball, ball shadow, strike zone, aim reticle
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x777777 }));
ball.visible = false;
scene.add(ball);
const shadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.14, 16).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }),
);
shadow.visible = false;
scene.add(shadow);
{
  const hw = L.ZONE.halfWidth;
  const pts = [[-hw, L.ZONE.bottom], [hw, L.ZONE.bottom], [hw, L.ZONE.top], [-hw, L.ZONE.top]].map(([x, y]) => new THREE.Vector3(x, y, 0));
  scene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })));
}
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.05, 0.068, 28),
  new THREE.MeshBasicMaterial({ color: 0xffa31a, transparent: true, opacity: 0.95, depthTest: false }),
);
reticle.renderOrder = 10;
scene.add(reticle);

// ------------------------------------------------------------------ camera
const CAM_HOME = new THREE.Vector3(0, 1.45, 3.6);
const CAM_LOOK = new THREE.Vector3(0, 0.95, -8);
const camPos = CAM_HOME.clone();
const camLook = CAM_LOOK.clone();
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 1 ? 62 : 50;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ------------------------------------------------------------------ audio (tiny synth beeps)
let audio = null;
function beep(freq, dur = 0.08, type = "square", gain = 0.06) {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + dur);
  } catch {
    /* audio is optional */
  }
}

// ------------------------------------------------------------------ game flow
let rng = L.mulberry32((Date.now() ^ 0x9e3779b9) >>> 0);
let state = null;
let mode = "bat";
let phase = "menu"; // menu | ready | pitching | hit | result | over
let timer = 0;
let plan = null;
let tPitch = 0;
let swing = null;
let flight = null;
let pitchChoice = "fastball";
let aim = { x: 0, y: 0.8 };
let nextPitchPlan = null;

const TEXT = {
  ball: "볼", strike: "스트라이크", swing_miss: "헛스윙!", foul: "파울",
  single: "안타!", double: "2루타!", triple: "3루타!!", homerun: "홈런!!!", out: "아웃",
};

function setDots(id, n, max, cls) {
  const el = $(id);
  if (el.childElementCount !== max) el.innerHTML = Array.from({ length: max }, () => `<span class="dot ${cls}"></span>`).join("");
  [...el.children].forEach((d, i) => d.classList.toggle("on", i < n));
}
function updateHUD() {
  $("runs").textContent = `${state.runs}${mode === "bat" ? " 득점" : " 실점"}`;
  $("inning").textContent = `${Math.min(state.inning, L.INNINGS)} / ${L.INNINGS}회 · ${mode === "bat" ? "타자" : "투수"}`;
  setDots("dB", state.balls, 3, "b");
  setDots("dS", state.strikes, 2, "s");
  setDots("dO", state.outs, 2, "o");
  state.bases.forEach((on, i) => $(`b${i + 1}`).classList.toggle("on", on));
}
function banner(text, ms = 0) {
  const b = $("banner");
  b.textContent = text;
  b.classList.toggle("show", !!text);
  if (ms) setTimeout(() => b.textContent === text && b.classList.remove("show"), ms);
}
const info = (t) => ($("info").textContent = t || "");
function setHelp() {
  $("help").textContent =
    mode === "bat"
      ? "공이 홈플레이트에 닿는 순간, 공이 지나갈 위치(높이 포함)를 탭해서 스윙하세요."
      : "구종을 고르고 스트라이크존 안팎의 원하는 위치를 탭하면 던집니다.";
  $("pitchbar").style.display = mode === "pitch" ? "flex" : "none";
}

function buildPitchBar() {
  const bar = $("pitchbar");
  bar.innerHTML = "";
  for (const [key, p] of Object.entries(L.PITCHES)) {
    const b = document.createElement("button");
    b.textContent = p.label;
    b.dataset.type = key;
    b.className = key === pitchChoice ? "sel" : "";
    b.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      pitchChoice = key;
      [...bar.children].forEach((c) => c.classList.toggle("sel", c === b));
    });
    bar.appendChild(b);
  }
}

function startGame(m) {
  mode = m;
  state = L.newGame(m);
  $("menu").classList.remove("show");
  $("over").classList.remove("show");
  buildPitchBar();
  setHelp();
  updateHUD();
  banner("");
  info("");
  toReady();
}

function toReady() {
  phase = "ready";
  timer = mode === "bat" ? 1.1 : 0;
  plan = null;
  swing = null;
  flight = null;
  ball.visible = false;
  shadow.visible = false;
  fielders.forEach((f) => f.position.copy(f.userData.home));
  batPivot.rotation.y = (-100 * Math.PI) / 180;
  batTilt.rotation.z = (60 * Math.PI) / 180;
  batPivot.position.y = 1.15;
  reticle.visible = mode === "bat";
  if (mode === "bat") {
    const c = L.cpuPitchChoice(state, rng);
    nextPitchPlan = L.planPitch(c.type, c.target, rng, 0.06);
    reticle.position.set(aim.x, aim.y, 0.02);
  } else {
    nextPitchPlan = null;
    reticle.position.set(0, 0.8, 0.02);
  }
  banner("");
  if (!state.over) info(mode === "bat" ? "" : "던질 위치를 탭하세요");
}

function launchPitch(p) {
  plan = p;
  tPitch = 0;
  phase = "pitching";
  swing = null;
  if (mode === "pitch") {
    const s = L.cpuBatterSwing(plan, state, rng);
    if (s.swing) {
      const contactTime = Math.max(0.05, plan.T + s.e);
      swing = { ax: s.ax, ay: s.ay, e: contactTime - plan.T, contactTime, resolved: false, cpu: true };
    }
  }
  ball.visible = true;
  shadow.visible = true;
  banner("");
  info("");
}

function onTap(x, y) {
  aim = { x: Math.max(-0.6, Math.min(0.6, x)), y: Math.max(0.1, Math.min(1.7, y)) };
  reticle.position.set(aim.x, aim.y, 0.02);
  if (phase === "ready" && mode === "pitch") {
    const tx = Math.max(-0.5, Math.min(0.5, aim.x));
    const ty = Math.max(0.2, Math.min(1.5, aim.y));
    launchPitch(L.planPitch(pitchChoice, { x: tx, y: ty }, rng, 0.07));
    beep(300, 0.05, "triangle");
  } else if (phase === "pitching" && mode === "bat" && !swing && tPitch < plan.T + 0.12) {
    const contactTime = tPitch + L.SWING_LAG;
    swing = { ax: aim.x, ay: aim.y, e: contactTime - plan.T, contactTime, resolved: false, cpu: false };
    beep(180, 0.06, "sawtooth", 0.04);
  }
}

const raycaster = new THREE.Raycaster();
const platePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
function pointerToPlate(ev) {
  const r = canvas.getBoundingClientRect();
  const ndc = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(platePlane, hit) ? hit : null;
}
canvas.addEventListener("pointerdown", (ev) => {
  if (phase === "menu" || phase === "over") return;
  const p = pointerToPlate(ev);
  if (p) onTap(p.x, p.y);
});
canvas.addEventListener("pointermove", (ev) => {
  if ((phase === "ready" || phase === "pitching") && mode === "bat" && ev.pointerType === "mouse") {
    const p = pointerToPlate(ev);
    if (p) {
      aim = { x: Math.max(-0.6, Math.min(0.6, p.x)), y: Math.max(0.1, Math.min(1.7, p.y)) };
      reticle.position.set(aim.x, aim.y, 0.02);
    }
  }
});

function resolveContact() {
  const s = swing;
  s.resolved = true;
  const res = L.evaluateSwing(plan, { e: s.e, ax: s.ax, ay: s.ay }, rng);
  s.result = res;
  if (!res.contact) return;
  const start = L.pitchPosition(plan, s.contactTime);
  const f = L.simulateFlight(start, res.exitSpeed, res.launch, res.spray);
  const cls = L.classifyBattedBall(res, f, rng);
  flight = { res, f, cls, t: 0, i: 0, chaser: null };
  const land = f.landing || { x: f.end[1], z: f.end[3] };
  let best = 1e9;
  fielders.forEach((fd, k) => {
    const d = Math.hypot(land.x - fd.userData.home.x, land.z - fd.userData.home.z);
    if (d < best) {
      best = d;
      flight.chaser = fd;
    }
  });
  phase = "hit";
  beep(res.grade === "perfect" ? 880 : res.grade === "good" ? 620 : 420, 0.1, "square", 0.08);
  info(`${plan.label} ${plan.kmh}km/h · 타구 ${Math.round(res.exitSpeed * 3.6)}km/h · 발사각 ${Math.round(res.launch)}°`);
}

function finishPitch(outcome, note) {
  const events = L.applyOutcome(state, outcome, rng);
  let text = note || TEXT[outcome];
  if (events.includes("삼진 아웃!")) text = "삼진 아웃!";
  if (events.includes("볼넷!")) text = "볼넷!";
  banner(text);
  if (events.length) info(events.filter((e) => e !== text).join(" · ") || $("info").textContent);
  updateHUD();
  phase = "result";
  timer = ["single", "double", "triple", "homerun"].includes(outcome) ? 2.2 : 1.5;
  if (outcome === "homerun") beep(990, 0.4, "triangle", 0.08);
}

function swingFeedback() {
  const s = swing;
  if (!s || s.cpu || !s.result) return "";
  const ms = Math.round(s.e * 1000);
  const timing = Math.abs(ms) < 15 ? "타이밍 정확" : ms < 0 ? `타이밍 ${-ms}ms 빠름` : `타이밍 ${ms}ms 늦음`;
  return `${timing} · 위치 오차 ${Math.round(s.result.d * 100)}cm`;
}

function updatePitching(dt) {
  tPitch += dt;
  const p = L.pitchPosition(plan, tPitch);
  ball.position.set(p[0], p[1], p[2]);
  shadow.position.set(p[0], 0.03, p[2]);
  ball.visible = tPitch / plan.T < 1.12;
  shadow.visible = ball.visible;
  if (swing && !swing.resolved && tPitch >= swing.contactTime) {
    resolveContact();
    if (phase === "hit") return;
  }
  if (tPitch >= plan.T + 0.3) {
    const swungAndMissed = swing && swing.resolved;
    const outcome = swungAndMissed ? "swing_miss" : L.isStrike(plan.plate[0], plan.plate[1]) ? "strike" : "ball";
    info(`${plan.label} ${plan.kmh}km/h${swingFeedback() ? " · " + swingFeedback() : ""}`);
    if (outcome === "swing_miss") beep(140, 0.12, "sawtooth", 0.05);
    finishPitch(outcome, outcome === "strike" ? "스트라이크 (루킹)" : undefined);
  }
}

function updateHit(dt) {
  flight.t += dt;
  const path = flight.f.path;
  const last = path[path.length - 1];
  const t = Math.min(flight.t, last[0]);
  while (flight.i < path.length - 2 && path[flight.i + 1][0] < t) flight.i++;
  const a = path[flight.i];
  const b = path[Math.min(flight.i + 1, path.length - 1)];
  const u = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0;
  const x = a[1] + (b[1] - a[1]) * u;
  const y = a[2] + (b[2] - a[2]) * u;
  const z = a[3] + (b[3] - a[3]) * u;
  ball.position.set(x, y, z);
  shadow.position.set(x, 0.03, z);
  // the nearest fielder runs toward where the ball comes down (or follows a grounder)
  const c = flight.chaser;
  const land = flight.f.landing;
  const tx = land && y > 0.3 ? land.x : x;
  const tz = land && y > 0.3 ? land.z : z;
  const dx = tx - c.position.x;
  const dz = tz - c.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist > 0.05) {
    const step = Math.min(dist, L.FIELDING.speed * dt);
    c.position.x += (dx / dist) * step;
    c.position.z += (dz / dist) * step;
  }
  if (flight.t >= Math.min(last[0], 6.5)) {
    const cls = flight.cls;
    const detail = swingFeedback();
    if (detail) info(`${$("info").textContent} · ${detail}`);
    ball.visible = cls.result === "homerun";
    finishPitch(cls.result, cls.result === "out" || cls.result === "foul" ? (cls.note || undefined) : cls.note && cls.result === "double" ? `2루타! (${cls.note})` : undefined);
  }
}

function updateBat() {
  // bat angle: -90deg at (contact - lag), 0deg at contact, +90deg at (contact + lag)
  if (swing && phase !== "ready") {
    const u = (tPitch - swing.contactTime) / L.SWING_LAG;
    const alpha = Math.max(-1, Math.min(1, u)) * 90;
    if (u >= -1) {
      batPivot.rotation.y = (alpha * Math.PI) / 180;
      batPivot.position.y = swing.ay;
      batTilt.rotation.z = ((60 * Math.max(0, Math.min(1, -u))) * Math.PI) / 180;
    }
  }
}

function updateCamera(dt) {
  const k = 1 - Math.exp(-6 * dt);
  let targetPos = CAM_HOME;
  let targetLook = CAM_LOOK;
  if (phase === "hit" || (phase === "result" && flight)) {
    const b = ball.position;
    targetPos = new THREE.Vector3(b.x * 0.55, 3.2 + Math.min(b.y, 30) * 0.35, Math.min(3.6, b.z + 24));
    targetLook = new THREE.Vector3(b.x, Math.max(0.5, b.y * 0.8), b.z);
  }
  camPos.lerp(targetPos, phase === "hit" ? k : 1 - Math.exp(-3 * dt));
  camLook.lerp(targetLook, phase === "hit" ? k : 1 - Math.exp(-3 * dt));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (phase === "ready") {
    if (mode === "bat") {
      timer -= dt;
      pitcher.scale.y = 1 - 0.06 * Math.sin(Math.min(1, 1 - timer / 1.1) * Math.PI);
      if (timer <= 0 && !state.over) launchPitch(nextPitchPlan);
    }
    camPos.lerp(CAM_HOME, 1 - Math.exp(-5 * dt));
    camLook.lerp(CAM_LOOK, 1 - Math.exp(-5 * dt));
  } else if (phase === "pitching") {
    updatePitching(dt);
  } else if (phase === "hit") {
    updateHit(dt);
  } else if (phase === "result") {
    timer -= dt;
    if (timer <= 0) {
      if (state.over) {
        phase = "over";
        $("overTitle").textContent = "경기 종료";
        $("overText").textContent =
          mode === "bat"
            ? `${state.runs}득점 · ${state.hits}안타`
            : `${state.runs}실점 · ${state.hits}피안타`;
        $("over").classList.add("show");
      } else {
        toReady();
      }
    }
  }
  pitcher.scale.y += (1 - pitcher.scale.y) * (phase === "ready" ? 0 : 0.2);
  if (phase === "pitching" || phase === "hit" || phase === "result") updateBat();
  updateCamera(dt);
  // Arcade readability: the farther the ball is from the camera, the larger it is drawn.
  const ballScale = Math.min(8, 1 + 0.1 * camera.position.distanceTo(ball.position));
  ball.scale.setScalar(ballScale);
  shadow.scale.setScalar(ballScale);
  reticle.visible = (mode === "bat" && (phase === "ready" || phase === "pitching")) || (mode === "pitch" && phase === "pitching");
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

document.querySelectorAll("#menu [data-mode]").forEach((b) => b.addEventListener("click", () => startGame(b.dataset.mode)));
$("again").addEventListener("click", () => startGame(mode));
$("toMenu").addEventListener("click", () => {
  phase = "menu";
  $("over").classList.remove("show");
  $("menu").classList.add("show");
});

// Test/debug hook: lets automated checks drive the game without synthesizing pointer events.
window.__bb = {
  start: startGame,
  tap: onTap,
  get phase() { return phase; },
  get plan() { return plan; },
  get tPitch() { return tPitch; },
  get state() { return state; },
  get flight() { return flight; },
  get info() { return $("info").textContent; },
  get banner() { return $("banner").textContent; },
};
