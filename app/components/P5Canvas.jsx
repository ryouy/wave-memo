"use client";

import { useEffect, useRef } from "react";
import { PALETTES } from "../themes";

const HORIZON = 0.34; // 水平線の位置（画面高さ比）。常に見えている
const REST = 0.4; // 波が引いたときの波先の位置（水平線のすぐ下）
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
const rand = (a, b) => a + Math.random() * (b - a);

const clone = (v) => (Array.isArray(v) ? v.map(clone) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
// 現在のパレット(cur)を目標(tgt)へ近づける
function approach(cur, tgt, k) {
  for (const key of Object.keys(cur)) {
    const a = cur[key];
    const b = tgt[key];
    if (typeof a === "number") cur[key] = a + (b - a) * k;
    else if (a && typeof a === "object") approach(a, b, k);
  }
}
const STARS = Array.from({ length: 80 }, (_, i) => {
  const f = (n) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { x: f(1), y: f(2), r: 0.6 + f(3) * 1.3, ph: f(4) * 6.28 };
});
const hash = (a, b) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const rgba = (c, a = c[3] ?? 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

// ---- コードで描く船・岩・カニ ----
const mulberry32 = (a) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const shade = (c, k, a = 1) => `rgba(${(c[0] * k) | 0}, ${(c[1] * k) | 0}, ${(c[2] * k) | 0}, ${a})`;

function makeRock(seed) {
  const rnd = mulberry32(seed);
  const n = 12;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 0.8 + rnd() * 0.22;
    const y = Math.sin(a) * r;
    pts.push([Math.cos(a) * r, y > 0 ? y * 0.3 : y]); // 下側はつぶして地面に据える
  }
  const rp = () => [(rnd() - 0.5) * 1.3, -rnd() * 0.8];
  const facets = Array.from({ length: 3 }, () => [rp(), rp(), rp()]);
  const cracks = Array.from({ length: 3 }, () => [rp(), rp(), rp()]);
  return { pts, facets, cracks };
}
const ROCKS = [makeRock(11), makeRock(23), makeRock(37), makeRock(58)];

// (cx, groundY) に置く。w は岩の幅
function drawRock(ctx, rock, cx, groundY, w, h, dim, flip) {
  const sx = w / 2;
  const sy = h / 2;
  const cy = groundY - sy * 0.3 * 0.9;
  ctx.save();
  ctx.translate(cx, cy);
  if (flip) ctx.scale(-1, 1);
  // 接地の影
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, sy * 0.3 * 0.9, sx * 1.05, sy * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  const P = rock.pts.map(([x, y]) => [x * sx, y * sy]);
  const n = P.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const path = () => {
    ctx.beginPath();
    const m0 = mid(P[n - 1], P[0]);
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(P[i], P[(i + 1) % n]);
      ctx.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]);
    }
    ctx.closePath();
  };
  const g = ctx.createLinearGradient(-sx, -sy, sx * 0.8, sy * 0.4);
  g.addColorStop(0, shade([178, 168, 148], dim));
  g.addColorStop(0.55, shade([122, 112, 98], dim));
  g.addColorStop(1, shade([72, 64, 58], dim));
  path();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  path();
  ctx.clip();
  ctx.fillStyle = shade([40, 34, 30], dim, 0.16);
  for (const f of rock.facets) {
    ctx.beginPath();
    ctx.moveTo(f[0][0] * sx, f[0][1] * sy);
    ctx.lineTo(f[1][0] * sx, f[1][1] * sy);
    ctx.lineTo(f[2][0] * sx, f[2][1] * sy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = shade([40, 34, 30], dim, 0.4);
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.lineJoin = "round";
  for (const c of rock.cracks) {
    ctx.beginPath();
    ctx.moveTo(c[0][0] * sx, c[0][1] * sy);
    ctx.lineTo(c[1][0] * sx, c[1][1] * sy);
    ctx.lineTo(c[2][0] * sx, c[2][1] * sy);
    ctx.stroke();
  }
  // 左上の光
  const hl = ctx.createRadialGradient(-sx * 0.35, -sy * 0.55, 0, -sx * 0.35, -sy * 0.55, sx * 0.8);
  hl.addColorStop(0, `rgba(255, 245, 225, ${0.28 * dim})`);
  hl.addColorStop(1, "rgba(255, 245, 225, 0)");
  ctx.fillStyle = hl;
  ctx.fillRect(-sx, -sy, sx * 2, sy * 2);
  ctx.restore();
  path();
  ctx.strokeStyle = shade([40, 34, 30], dim, 0.5);
  ctx.lineWidth = Math.max(1, w * 0.01);
  ctx.stroke();
  ctx.restore();
}

// 小さな船。船首は右向きに描き、dir<0 のとき反転する
function drawBoat(ctx, x, y, u, dir, tilt, dim) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(dir, 1);
  // 水面の影
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 0.1 * u, 3.3 * u, 0.22 * u, 0, 0, Math.PI * 2);
  ctx.fill();
  // 帆とマスト
  ctx.strokeStyle = shade([70, 56, 48], dim);
  ctx.lineWidth = 0.14 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(1.1 * u, -1.3 * u);
  ctx.lineTo(1.1 * u, -5 * u);
  ctx.stroke();
  ctx.fillStyle = shade([250, 240, 216], dim, 0.96);
  ctx.beginPath();
  ctx.moveTo(1.25 * u, -4.9 * u);
  ctx.quadraticCurveTo(3.1 * u, -3.3 * u, 3 * u, -1.9 * u);
  ctx.lineTo(1.25 * u, -1.9 * u);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade([232, 120, 90], dim, 0.95);
  ctx.beginPath();
  ctx.moveTo(1.1 * u, -5 * u);
  ctx.lineTo(0.2 * u, -4.75 * u);
  ctx.lineTo(1.1 * u, -4.45 * u);
  ctx.closePath();
  ctx.fill();
  // 船室
  ctx.fillStyle = shade([226, 232, 238], dim);
  ctx.fillRect(-1.9 * u, -2.6 * u, 2 * u, 1.5 * u);
  ctx.fillStyle = shade([58, 92, 112], dim);
  ctx.fillRect(-2.1 * u, -2.9 * u, 2.4 * u, 0.35 * u);
  ctx.fillStyle = shade([40, 70, 92], dim);
  ctx.fillRect(-1.6 * u, -2.25 * u, 0.55 * u, 0.55 * u);
  ctx.fillRect(-0.8 * u, -2.25 * u, 0.55 * u, 0.55 * u);
  // 船体
  const hull = ctx.createLinearGradient(0, -1.5 * u, 0, 0.1 * u);
  hull.addColorStop(0, shade([200, 70, 58], dim));
  hull.addColorStop(1, shade([140, 38, 34], dim));
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(-3 * u, -1.1 * u);
  ctx.lineTo(3.5 * u, -1.5 * u);
  ctx.quadraticCurveTo(2.8 * u, 0.1 * u, 1.4 * u, 0.1 * u);
  ctx.lineTo(-2.2 * u, 0.1 * u);
  ctx.quadraticCurveTo(-2.9 * u, 0, -3 * u, -1.1 * u);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade([250, 244, 232], dim, 0.9);
  ctx.lineWidth = 0.2 * u;
  ctx.beginPath();
  ctx.moveTo(-2.95 * u, -0.95 * u);
  ctx.lineTo(3.3 * u, -1.3 * u);
  ctx.stroke();
  ctx.restore();
}

function drawCrab(ctx, x, y, u, phase, dim) {
  const body = [232, 88, 58];
  const dark = [150, 44, 34];
  ctx.save();
  ctx.translate(x, y + Math.abs(Math.sin(phase)) * u * 0.06);
  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.beginPath();
  ctx.ellipse(0, 0, u * 1.9, u * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of [-1, 1]) {
    // 脚（左右3本ずつ、交互にちょこちょこ動く）
    ctx.strokeStyle = shade(dark, dim);
    ctx.lineWidth = u * 0.2;
    for (let i = 0; i < 3; i++) {
      const w = Math.sin(phase + i * 1.3 + (s > 0 ? Math.PI : 0)) * u * 0.18;
      const sy = -u * (0.75 - i * 0.2);
      ctx.beginPath();
      ctx.moveTo(s * u * 0.8, sy);
      ctx.lineTo(s * u * (1.5 + i * 0.12), sy - u * 0.45);
      ctx.lineTo(s * u * (1.95 + i * 0.1) + w, -u * 0.02);
      ctx.stroke();
    }
    // はさみ
    const wave = Math.sin(phase * 0.5 + (s > 0 ? 0 : 1.5)) * u * 0.12;
    const hx = s * u * 1.75;
    const hy = -u * 1.95 + wave;
    ctx.strokeStyle = shade(body, dim);
    ctx.lineWidth = u * 0.22;
    ctx.beginPath();
    ctx.moveTo(s * u * 1, -u * 1.1);
    ctx.lineTo(hx, hy + u * 0.35);
    ctx.stroke();
    ctx.fillStyle = shade(body, dim);
    ctx.beginPath();
    ctx.arc(hx, hy, u * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shade(dark, dim);
    ctx.lineWidth = u * 0.1;
    ctx.beginPath();
    ctx.moveTo(hx, hy - u * 0.05);
    ctx.lineTo(hx - s * u * 0.15, hy - u * 0.5);
    ctx.stroke();
    // 目
    ctx.strokeStyle = shade(dark, dim);
    ctx.lineWidth = u * 0.1;
    ctx.beginPath();
    ctx.moveTo(s * u * 0.4, -u * 1.6);
    ctx.lineTo(s * u * 0.45, -u * 2.05);
    ctx.stroke();
    ctx.fillStyle = shade([255, 255, 255], dim);
    ctx.beginPath();
    ctx.arc(s * u * 0.45, -u * 2.15, u * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(s * u * 0.45, -u * 2.15, u * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  // 甲羅
  const g = ctx.createLinearGradient(0, -u * 1.8, 0, -u * 0.3);
  g.addColorStop(0, shade([246, 112, 76], dim));
  g.addColorStop(1, shade(body, dim));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, -u * 0.95, u * 1.3, u * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(255, 220, 190, ${0.35 * dim})`;
  ctx.beginPath();
  ctx.ellipse(-u * 0.35, -u * 1.3, u * 0.5, u * 0.22, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default function P5Canvas({ theme }) {
  const sketchRef = useRef(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    let p5Instance;
    let cancelled = false;

    const startP5 = async () => {
      const p5 = (await import("p5")).default;
      if (cancelled || !sketchRef.current) return;

      const sketch = (p) => {
        let t = 0;
        // 波の状態機械: wait -> down(文字をさらう) -> up -> wait ...
        let phase = "wait";
        let phaseTime = 0; // 現フェーズの経過ms（deltaTimeで積算してコマ落ちに強くする）
        let waitMs = 1500;
        let target = REST;
        let level = REST;
        let swept = false;
        let downMs = 5000;
        let upMs = 6500;
        let clock = 0;
        let nextBigAt = rand(9000, 14000); // 文字をさらう大きな波は、たまにだけ来る
        let birds = [];
        let clouds = [];
        let nextCloud = rand(1500, 4000);
        let boatClock = 20000; // 起動後まもなく船が見えるように
        let bubbles = []; // 波が引いたあとの砂浜に残る、しゅわしゅわした泡
        let wetBottom = 0;
        let plane = null;
        let nextBird = rand(2500, 5000);
        let nextPlane = rand(12000, 20000);
        const pal = clone(PALETTES[themeRef.current]);

        const size = () => ({
          w: sketchRef.current?.clientWidth || window.innerWidth,
          h: sketchRef.current?.clientHeight || window.innerHeight,
        });

        const spawnBirds = (W, H, horizonY) => {
          const away = Math.random() < 0.4;
          const n = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 2) : 1;
          const dir = Math.random() < 0.5 ? 1 : -1;
          const baseY = rand(0.08, 0.22) * H;
          const baseX = away ? rand(0.2, 0.8) * W : dir > 0 ? -40 : W + 40;
          const dur = away ? rand(8000, 11000) : rand(13000, 19000);
          for (let i = 0; i < n; i++) {
            birds.push({
              away,
              dir,
              age: -i * 450, // 群れは少しずつずらして飛ばす
              dur,
              x0: baseX - dir * i * 36,
              y0: baseY + i * rand(10, 26),
              // 奥へ消える鳥は水平線の少し上へ向かう
              x1: baseX + rand(-0.12, 0.12) * W,
              y1: horizonY - 6,
              size: rand(0.8, 1.15),
              ph: rand(0, 6.28),
              sway: rand(0.6, 1.4),
            });
          }
        };

        const spawnCloud = (W, H) => {
          const dir = Math.random() < 0.5 ? 1 : -1;
          const w = W * rand(0.14, 0.26);
          const n = 7 + Math.floor(Math.random() * 4);
          const puffs = [];
          for (let i = 0; i < n; i++) {
            const u = (i + 0.5) / n;
            const hump = Math.sin(u * Math.PI);
            puffs.push({
              dx: (u - 0.5) * w,
              dy: -hump * w * 0.05 * rand(0.6, 1.2) + rand(-0.01, 0.01) * w,
              r: w * (0.08 + 0.1 * hump) * rand(0.8, 1.15),
            });
          }
          clouds.push({
            dir,
            w,
            puffs,
            x: dir > 0 ? -w * 0.6 : W + w * 0.6,
            y: rand(0.05, 0.22) * H,
            vx: (W + w * 1.2) / rand(70000, 110000),
            alpha: rand(0.7, 1),
          });
        };

        const drawCloud = (ctx, c, col, a0) => {
          for (const pf of c.puffs) {
            ctx.save();
            ctx.translate(c.x + pf.dx, c.y + pf.dy);
            ctx.scale(1, 0.62);
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, pf.r);
            const a = a0 * c.alpha;
            g.addColorStop(0, rgba(col, a));
            g.addColorStop(0.6, rgba(col, a * 0.6));
            g.addColorStop(1, rgba(col, 0));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(0, 0, pf.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        };

        const drawGull = (ctx, x, y, s, flap, alpha, col) => {
          ctx.save();
          ctx.translate(x, y);
          ctx.strokeStyle = rgba(col, alpha);
          ctx.lineWidth = Math.max(1.2, s * 0.16);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          const tip = flap * s * 0.65;
          ctx.beginPath();
          ctx.moveTo(-s * 1.15, tip);
          ctx.quadraticCurveTo(-s * 0.55, -s * 0.55 + tip * 0.35, 0, 0);
          ctx.quadraticCurveTo(s * 0.55, -s * 0.55 + tip * 0.35, s * 1.15, tip);
          ctx.stroke();
          ctx.restore();
        };

        const drawPlane = (ctx, pl, col) => {
          const u = pl.u;
          ctx.save();
          ctx.translate(pl.x, pl.y + Math.sin(clock * 0.0017) * u * 0.18);
          ctx.rotate(Math.sin(clock * 0.0011) * 0.035 * pl.dir);
          ctx.scale(pl.dir, 1);
          ctx.fillStyle = rgba(col, 0.88);
          ctx.strokeStyle = rgba(col, 0.88);
          ctx.lineWidth = u * 0.07;
          // 胴体
          ctx.beginPath();
          ctx.ellipse(0, 0, u * 1.6, u * 0.34, 0, 0, Math.PI * 2);
          ctx.fill();
          // 尾翼
          ctx.beginPath();
          ctx.moveTo(-u * 1.3, -u * 0.1);
          ctx.lineTo(-u * 1.95, -u * 0.95);
          ctx.lineTo(-u * 1.5, -u * 0.95);
          ctx.lineTo(-u * 0.85, -u * 0.1);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(-u * 1.55, 0, u * 0.42, u * 0.07, 0, 0, Math.PI * 2);
          ctx.fill();
          // 複葉の翼と支柱
          ctx.beginPath();
          ctx.ellipse(u * 0.2, -u * 0.62, u * 0.95, u * 0.08, 0, 0, Math.PI * 2);
          ctx.ellipse(u * 0.2, u * 0.3, u * 0.95, u * 0.08, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-u * 0.3, -u * 0.6);
          ctx.lineTo(-u * 0.3, u * 0.28);
          ctx.moveTo(u * 0.7, -u * 0.6);
          ctx.lineTo(u * 0.7, u * 0.28);
          ctx.stroke();
          // プロペラ（回転して見える）
          const L = u * 0.62 * Math.abs(Math.cos(clock * 0.06));
          ctx.fillStyle = rgba(col, 0.22);
          ctx.beginPath();
          ctx.ellipse(u * 1.68, 0, u * 0.07, u * 0.62, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = u * 0.09;
          ctx.beginPath();
          ctx.moveTo(u * 1.68, -L);
          ctx.lineTo(u * 1.68, L);
          ctx.stroke();
          ctx.restore();
        };

        p.setup = () => {
          const { w, h } = size();
          p.createCanvas(w, h).parent(sketchRef.current);
        };

        p.draw = () => {
          p.clear();
          const ctx = p.drawingContext;
          const W = p.width;
          const H = p.height;
          const dt = Math.min(p.deltaTime || 16, 50);
          phaseTime += dt;
          clock += dt;
          approach(pal, PALETTES[themeRef.current], 1 - Math.exp(-dt / 350));
          t += dt * 0.0004;

          if (phase === "wait" && phaseTime > waitMs) {
            phase = "down";
            phaseTime = 0;
            if (clock >= nextBigAt) {
              // 大きな波: 文字のある砂浜まで下りてくる
              target = rand(0.8, 0.93);
              downMs = 5500;
              upMs = 7000;
              swept = false;
              nextBigAt = clock + rand(14000, 28000);
            } else {
              // 普段のゆるいうねり: 水平線の近くで寄せて返すだけ
              target = rand(0.45, 0.53);
              downMs = 4500;
              upMs = 5500;
              swept = true;
            }
          } else if (phase === "down" && phaseTime > downMs) {
            phase = "up";
            phaseTime = 0;
          } else if (phase === "up" && phaseTime > upMs) {
            phase = "wait";
            phaseTime = 0;
            waitMs = rand(1500, 3500);
          }
          if (phase === "down") {
            level = REST + (target - REST) * ease(phaseTime / downMs);
          } else if (phase === "up") {
            level = target + (REST - target) * ease(phaseTime / upMs);
          } else {
            level = REST;
          }

          const horizonY = H * HORIZON;
          const baseY = H * level;
          // 遠近感: 手前(下)に来るほど、波は大きく・うねりは長く・泡は厚くなる
          const near = Math.max(0, Math.min(1, (level - HORIZON) / (0.95 - HORIZON)));
          const foamHeight = H * (0.03 + near * 0.05);
          const amp = 8 + near * 16;
          const freq = 0.014 - near * 0.006;
          const waveY = (x) =>
            baseY + Math.sin(x * freq + t * 1.5) * amp + Math.sin(x * freq * 2.5 + t * 2.2) * amp * 0.33;

          // ---- 空と砂浜 ----
          const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
          sky.addColorStop(0, rgba(pal.sky[0], 1));
          sky.addColorStop(0.45, rgba(pal.sky[1], 1));
          sky.addColorStop(0.78, rgba(pal.sky[2], 1));
          sky.addColorStop(1, rgba(pal.sky[3], 1));
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, W, horizonY + 1);
          const sand = ctx.createLinearGradient(0, horizonY, 0, H);
          sand.addColorStop(0, rgba(pal.sand[0], 1));
          sand.addColorStop(0.35, rgba(pal.sand[1], 1));
          sand.addColorStop(1, rgba(pal.sand[2], 1));
          ctx.fillStyle = sand;
          ctx.fillRect(0, horizonY, W, H - horizonY);

          // ---- 太陽（水平線より下は描かない） ----
          const r = Math.min(W, H) * 0.11 * pal.sunScale;
          const sx = W * pal.sunX;
          const sy = horizonY + r * pal.sunK;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, horizonY);
          ctx.clip();
          p.noStroke();
          for (let i = 6; i >= 1; i--) {
            p.fill(pal.sunGlow[0], pal.sunGlow[1], pal.sunGlow[2], 14);
            p.circle(sx, sy, r * (1 + i * 0.55));
          }
          p.fill(pal.sunCore[0], pal.sunCore[1], pal.sunCore[2]);
          p.circle(sx, sy, r * 2);
          p.fill(255, 245, 210, 200);
          p.circle(sx, sy, r * 1.5);
          ctx.restore();

          // ---- 星（夜だけ） ----
          if (pal.stars > 0.02) {
            p.noStroke();
            for (const st of STARS) {
              const tw = 0.6 + 0.4 * Math.sin(clock * 0.0015 + st.ph);
              const fade = 1 - (st.y * 0.85);
              p.fill(255, 255, 240, 230 * pal.stars * tw * fade);
              p.circle(st.x * W, st.y * horizonY * 0.95, st.r);
            }
          }

          // ---- 鳥と飛行機 ----
          if (clock > nextBird) {
            spawnBirds(W, H, horizonY);
            nextBird = clock + rand(7000, 16000);
          }
          if (!plane && clock > nextPlane) {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const u = Math.min(W, H) * 0.035;
            plane = {
              dir,
              u,
              x: dir > 0 ? -u * 4 : W + u * 4,
              y: rand(0.07, 0.2) * H,
              vx: (W + u * 8) / 26000,
            };
            nextPlane = clock + rand(35000, 60000);
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, horizonY);
          ctx.clip();
          if (clock > nextCloud && clouds.length < 3) {
            spawnCloud(W, H);
            nextCloud = clock + rand(15000, 35000);
          }
          clouds = clouds.filter((c) => c.x > -c.w * 0.8 && c.x < W + c.w * 0.8);
          for (const c of clouds) {
            c.x += c.vx * c.dir * dt;
            drawCloud(ctx, c, pal.cloud, pal.cloudA);
          }
          birds = birds.filter((b) => b.age < b.dur);
          for (const b of birds) {
            b.age += dt;
            if (b.age < 0) continue;
            const k = b.age / b.dur;
            let x, y, s, a = 1;
            if (b.away) {
              x = b.x0 + (b.x1 - b.x0) * ease(k * 0.9 + 0.05 * k);
              y = b.y0 + (b.y1 - b.y0) * k * k;
              s = Math.min(W, H) * 0.022 * b.size * (1 - 0.82 * k);
              a = 1 - Math.max(0, (k - 0.75) / 0.25);
            } else {
              x = b.x0 + b.dir * (W + 80) * k;
              y = b.y0 + Math.sin(k * 6 * b.sway + b.ph) * H * 0.02;
              s = Math.min(W, H) * 0.022 * b.size;
            }
            const flap = Math.sin(clock * 0.008 + b.ph) * (b.away ? 0.9 : 0.75);
            drawGull(ctx, x, y, s, flap, a, pal.silhouette);
          }
          if (plane) {
            plane.x += plane.vx * plane.dir * dt;
            drawPlane(ctx, plane, pal.silhouette);
            if (plane.x < -plane.u * 5 || plane.x > W + plane.u * 5) plane = null;
          }
          ctx.restore();

          // ---- 海（水平線から波先まで。水平線は常に見える） ----
          const grad = ctx.createLinearGradient(0, horizonY, 0, H * 0.9);
          grad.addColorStop(0, rgba(pal.sea[0]));
          grad.addColorStop(0.18, rgba(pal.sea[1]));
          grad.addColorStop(1, rgba(pal.sea[2]));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.moveTo(0, horizonY);
          ctx.lineTo(W, horizonY);
          for (let x = W; x >= 0; x -= 6) ctx.lineTo(x, waveY(x));
          ctx.closePath();
          ctx.fill();

          // 太陽の反射（海面のきらめき）
          for (let y = horizonY + 4; y < baseY - 6; y += 7) {
            const k = (y - horizonY) / Math.max(1, H * 0.5);
            const w = r * (0.5 + k * 1.6) * (0.7 + 0.3 * Math.sin(y * 0.4 + t * 3));
            p.fill(pal.sunReflect[0], pal.sunReflect[1], pal.sunReflect[2], Math.max(0, 120 - k * 150));
            p.rect(sx - w / 2, y, w, 2.5, 2);
          }

          // 遠近感のあるさざ波: 水平線付近は細かく密に、手前ほど太く間隔が広い。ゆっくり手前へ寄ってくる
          const seaH = baseY - horizonY;
          if (seaH > 12) {
            const ROWS = 4;
            const drift = (t * 0.2) % 1;
            const strength = Math.min(1, seaH / (H * 0.18)) * (pal.foam / 0.6);
            ctx.lineCap = "round";
            for (let i = 0; i < ROWS; i++) {
              const d = (i + drift) / ROWS;
              const depth = Math.pow(d, 1.9);
              const y = horizonY + seaH * depth;
              if (y > baseY - amp - 6) continue;
              const wl = 30 + depth * 260;
              ctx.strokeStyle = `rgba(255, 255, 255, ${Math.sin(Math.PI * d) * 0.3 * strength})`;
              ctx.lineWidth = 0.8 + depth * 2.6;
              ctx.setLineDash([20 + depth * 220, 14 + depth * 120]);
              ctx.lineDashOffset = -t * (30 + depth * 120) * 3 + i * 40;
              ctx.beginPath();
              for (let x = 0; x <= W + 8; x += 8) {
                const yy = y + Math.sin((x / wl) * 6.283 + t * 1.2 + i * 1.7) * (0.6 + depth * 5);
                if (x === 0) ctx.moveTo(x, yy);
                else ctx.lineTo(x, yy);
              }
              ctx.stroke();
            }
            ctx.setLineDash([]);
          }

          // 水平線
          ctx.strokeStyle = "rgba(255, 220, 170, 0.8)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, horizonY);
          ctx.lineTo(W, horizonY);
          ctx.stroke();

          // ---- 船（水平線の近くを、ゆっくり右から左へ） ----
          boatClock += dt;
          const BOAT_MOVE = 32000;
          const boatK = (boatClock % 45000) / BOAT_MOVE;
          if (boatK < 1) {
            const bu = Math.max(8, Math.min(W, H) * 0.02);
            const bx = W + bu * 6 - (W + bu * 12) * boatK;
            const by = horizonY + Math.min(14, seaH * 0.5) + Math.sin(clock * 0.0016) * bu * 0.2;
            drawBoat(ctx, bx, by, bu, -1, Math.sin(clock * 0.0011) * 0.03, pal.dim);
          }

          // ---- 波が引いたあとの濡れた砂 ----
          const frontBottom = baseY + foamHeight + amp * 0.5;
          if (frontBottom > wetBottom) wetBottom = frontBottom;
          else wetBottom = Math.max(frontBottom, wetBottom - dt * H * 0.000012);
          const wetH = wetBottom - frontBottom;
          if (wetH > 2) {
            ctx.fillStyle = `rgba(80, 60, 72, ${0.1 * Math.min(1, wetH / (H * 0.05))})`;
            ctx.beginPath();
            for (let x = 0; x <= W + 6; x += 6) {
              const y0 = waveY(x) + foamHeight * 0.5;
              if (x === 0) ctx.moveTo(x, y0);
              else ctx.lineTo(x, y0);
            }
            for (let x = W + 6; x >= 0; x -= 6) {
              ctx.lineTo(x, wetBottom + Math.sin(x * 0.02 + t) * 5);
            }
            ctx.closePath();
            ctx.fill();
          }

          // ---- 白い泡 ----
          ctx.fillStyle = `rgba(255, 255, 255, ${pal.foam})`;
          ctx.beginPath();
          for (let x = 0; x <= W + 6; x += 6) {
            if (x === 0) ctx.moveTo(x, waveY(x));
            else ctx.lineTo(x, waveY(x));
          }
          for (let x = W + 6; x >= 0; x -= 6) {
            const wob = Math.sin(x * 0.015 - t * 1.6) * 5;
            ctx.lineTo(x, waveY(x) + foamHeight + wob);
          }
          ctx.closePath();
          ctx.fill();

          // しゅわしゅわ: 引いていく波が残す小さな泡が、生まれて弾ける
          if (phase === "up" && wetH > 4 && bubbles.length < 70) {
            const n = Math.ceil(dt * W * 0.00003);
            for (let i = 0; i < n; i++) {
              const x = Math.random() * W;
              const yTop = waveY(x) + foamHeight * 0.8;
              bubbles.push({
                x,
                y: yTop + Math.pow(Math.random(), 1.6) * Math.max(2, wetBottom - yTop),
                r: rand(0.8, 3),
                age: 0,
                life: rand(1200, 3200),
                ph: rand(0, 6.28),
              });
            }
          }
          bubbles = bubbles.filter((b) => b.age < b.life);
          for (const b of bubbles) {
            b.age += dt;
            const k = b.age / b.life;
            const pop = k > 0.85 ? (k - 0.85) / 0.15 : 0;
            const bx = b.x + Math.sin(clock * 0.002 + b.ph) * 1.5;
            const a = pal.foam * (1 - k * 0.6) * (1 - pop);
            ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.4})`;
            ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(bx, b.y, b.r * (1 + pop * 1.2), 0, Math.PI * 2);
            if (!pop) ctx.fill();
            ctx.stroke();
          }

          // 波頭の白い線と、少し奥を追ってくる薄い波筋
          ctx.lineCap = "round";
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, pal.foam * 1.4)})`;
          ctx.lineWidth = 1.5 + near * 2.5;
          ctx.beginPath();
          for (let x = 0; x <= W + 6; x += 6) {
            if (x === 0) ctx.moveTo(x, waveY(x));
            else ctx.lineTo(x, waveY(x));
          }
          ctx.stroke();
          ctx.strokeStyle = `rgba(255, 255, 255, ${pal.foam * 0.4})`;
          ctx.lineWidth = 1 + near * 1.5;
          ctx.beginPath();
          for (let x = 0; x <= W + 6; x += 6) {
            const yy = waveY(x) - foamHeight * 1.1 + Math.sin(x * freq * 1.7 - t * 1.4) * amp * 0.4;
            if (x === 0) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();

          // ---- カニと岩 ----
          const cu = Math.max(11, Math.min(34, Math.min(W, H) * 0.032));
          drawCrab(ctx, W * 0.5 + Math.sin(clock * 0.000524) * W * 0.3, H * 0.955, cu, clock * 0.012, pal.dim);
          const rw = Math.max(110, Math.min(W * 0.26, 320));
          const gy = H + 4;
          drawRock(ctx, ROCKS[0], rw * 0.5 - 6, gy, rw, rw * 0.72, pal.dim, false);
          drawRock(ctx, ROCKS[1], rw * 1.0, gy, rw * 0.55, rw * 0.4, pal.dim, true);
          drawRock(ctx, ROCKS[2], W - rw * 0.5 + 6, gy, rw, rw * 0.72, pal.dim, true);
          drawRock(ctx, ROCKS[3], W - rw * 1.0, gy, rw * 0.55, rw * 0.4, pal.dim, false);

          // 波が文字の位置まで来たら、波先より上の行をさらう
          if (phase === "down" && !swept && phaseTime > downMs * 0.65) {
            swept = true;
            const top = sketchRef.current?.getBoundingClientRect().top || 0;
            window.dispatchEvent(
              new CustomEvent("wave-pass", {
                detail: { reachY: top + baseY + foamHeight },
              }),
            );
          }
        };

        p.windowResized = () => {
          const { w, h } = size();
          p.resizeCanvas(w, h);
        };
      };

      p5Instance = new p5(sketch);
    };

    startP5();

    return () => {
      cancelled = true;
      if (p5Instance) p5Instance.remove();
    };
  }, []);

  return <div ref={sketchRef} className="sea" />;
}
