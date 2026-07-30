// sound.js
let ctx = null;
function ensure() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); }

const sound = {
  ding() {
    ensure();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.001;
    o.connect(g); g.connect(ctx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    o.stop(ctx.currentTime + 0.35);
  },
  drumroll() {
    ensure();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 1.2);
    g.gain.value = 0.001;
    o.connect(g); g.connect(ctx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4);
    o.stop(ctx.currentTime + 1.5);
  },
  buzz() {
    ensure();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 120;
    o.connect(g); g.connect(ctx.destination);
    g.gain.value = 0.2; o.start();
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.stop(ctx.currentTime + 0.42);
  },
  // 무승부 — 짧고 중립적인 두 음
  tie() {
    ensure();
    [520, 520].forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.value = 0.001;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.22;
      o.start(t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.stop(t + 0.22);
    });
  },
  // 매칭 시작 시 "섞이면서 계산하는" 느낌의 짧은 블립들
  shuffle() {
    ensure();
    const now = ctx.currentTime;
    const notes = 8;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'square';
      const freq = 260 + Math.random() * 520;
      o.frequency.value = freq;
      g.gain.value = 0.001;
      o.connect(g); g.connect(ctx.destination);
      const t = now + i * 0.08;
      o.start(t);
      g.gain.exponentialRampToValueAtTime(0.14, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.stop(t + 0.07);
    }
  },
  // 순위 공개 직전 — 긴장되는 효과음 (조금 길게, ~1.5초)
  suspense() {
    ensure();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 1.3);
    g.gain.value = 0.001;
    o.connect(g); g.connect(ctx.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.45);
    o.stop(ctx.currentTime + 1.5);
  },
  // 1위 공개 — 축하하는 짧은 팡파르 (조금 길게, ~1.1초)
  fanfare() {
    ensure();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq;
      g.gain.value = 0.001;
      o.connect(g); g.connect(ctx.destination);
      const t = now + i * 0.15;
      o.start(t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.stop(t + 0.47);
    });
  }
};
