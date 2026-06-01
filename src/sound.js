// ─── Web Audio 合成音效 ───
// 用 oscillator 合成，不用音檔資產

let ctx;
function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

function tone(freq, t0, dur, gain = 0.15, type = "sine") {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

// SSR 命中：三音上升 + 一道餘韻
export function playSSR() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume();
    const t = c.currentTime;
    tone(880,  t,        0.2, 0.18);
    tone(1320, t + 0.08, 0.25, 0.16);
    tone(1760, t + 0.18, 0.4,  0.14);
  } catch {}
}

// SR：兩音較輕
export function playSR() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume();
    const t = c.currentTime;
    tone(660,  t,       0.15, 0.12);
    tone(990,  t + 0.06, 0.2, 0.10);
  } catch {}
}

// 點擊小聲
export function playTick() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === "suspended") c.resume();
    tone(1200, c.currentTime, 0.05, 0.08, "triangle");
  } catch {}
}
