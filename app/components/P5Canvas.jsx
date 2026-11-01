"use client";

import { useEffect, useRef } from "react";
import { PALETTES } from "../themes";

const HORIZON = 0.34; // 水平線の位置（画面高さ比）。常に見えている
const REST = 0.4; // 波が引いたときの波先の位置（水平線のすぐ下）
const ease = (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, x)));
const rand = (a, b) => a + Math.random() * (b - a);

const clone = (v) => (Array.isArray(v) ? v.map(clone) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
const MOON = { core: [240, 244, 255], glow: [150, 170, 255], reflect: [200, 215, 255], scale: 0.5 };

const TAU = Math.PI * 2;
// 太陽の軌道（楕円）。東(左)の水平線で昇り、真上を通って、西(右)の水平線へ沈み、夜は地平線の下を回って朝に戻る。
// φ は軌道上の位置。時間帯の切り替えは、必ずこの向き(φが増える向き)に進む。月は太陽の反対側(φ+π)にいる。
// 月が空にいるのは、太陽が完全に沈んでから、また顔を出すまでのあいだだけ（朝夕に、太陽と月が同時に水平線の上に出ないように）
const MOON_FROM = Math.PI + 0.73;
const MOON_TO = TAU - 0.73;
const THEME_PHI = {
  morning: TAU - 0.14,
  day: Math.PI / 2,
  evening: Math.PI + 0.083,
  night: MOON_FROM + 0.35 * (MOON_TO - MOON_FROM), // 月が左の高いところにいる
};
// 太陽の位置 φ から、月の軌道上の位置 ψ を決める。空にいない間は、水平線の下で待つ
function moonPsi(phi) {
  const p = ((phi % TAU) + TAU) % TAU;
  if (p >= MOON_FROM && p <= MOON_TO) return -0.5 + ((p - MOON_FROM) / (MOON_TO - MOON_FROM)) * (Math.PI + 1.0);
  if (p < Math.PI / 2) return Math.PI + 0.75; // 日の出のあとは、右の水平線の下
  return p < MOON_FROM ? -0.75 : Math.PI + 0.75; // 日没までは左の水平線の下で出番を待つ
}
// 時間帯の並び(φの小さい順)。空・海・星などの色は、いまの φ に応じて、この隣り合う2つを混ぜる
const KEYFRAMES = [
  ["day", THEME_PHI.day],
  ["evening", THEME_PHI.evening],
  ["night", THEME_PHI.night],
  ["morning", THEME_PHI.morning],
  ["day", THEME_PHI.day + TAU],
];
const ORBIT_X = 0.3; // 軌道の横の広がり（画面幅比）
const SUN_K = 3.6; // 太陽の最高点（太陽の半径の何倍、水平線の上か）
const MOON_K = 5;
const smooth = (t) => t * t * (3 - 2 * t);
function mixInto(out, a, b, t) {
  for (const key of Object.keys(out)) {
    const va = a[key];
    const vb = b[key];
    if (typeof va === "number") out[key] = va + (vb - va) * t;
    else if (va && typeof va === "object") mixInto(out[key], va, vb, t);
  }
}
const STARS = Array.from({ length: 80 }, (_, i) => {
  const f = (n) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
  return { x: f(1), y: f(2), r: 0.6 + f(3) * 1.3, ph: f(4) * 6.28 };
});
const rgba = (c, a = c[3] ?? 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

// ---- イラスト（public/art）の描画 ----
// 絵のセット（4種類）。絵ごとの向きの違いもここで吸収する
const ART_SETS = {
  // 新しいヴィンテージ風・カラフルなポップ。飛行機は水平に飛ぶ絵なので、ほぼ水平に横切る
  classic: { dir: "/art/classic", gullFacesLeft: false, planeSlope: 0.03 },
  pop: { dir: "/art/pop", gullFacesLeft: false, planeSlope: 0.03 },
  // 前の絵画風・輪郭つきのポップ（旅客機は機首を上げて上昇する）
  painted: { dir: "/art/painted", gullFacesLeft: false, planeSlope: 0.17 },
  cartoon: { dir: "/art/cartoon", gullFacesLeft: true, planeSlope: 0.2 },
};
const SPRITE_NAMES = ["fishing-boat", "flying-seagull", "sand-crab", "shore-rock", "distant-plane", "scallop-shell"];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const tintCache = new Map();

// 画像を表示サイズ(の近似)まで段階的に縮小し、時間帯の色味(tint)を重ねたキャンバスを返す。結果はキャッシュする。
function spriteCanvas(im, name, w, tint) {
  const dpr = window.devicePixelRatio || 1;
  const qw = Math.max(8, Math.ceil(w / 8) * 8);
  const ta = Math.round(tint[3] * 20);
  const key = `${name}|${qw}|${dpr}|${tint[0] >> 4},${tint[1] >> 4},${tint[2] >> 4},${ta}`;
  let cv = tintCache.get(key);
  if (cv) return cv;
  if (tintCache.size > 120) tintCache.clear();
  const tw = Math.max(1, Math.round(qw * dpr));
  const th = Math.max(1, Math.round((tw * im.naturalHeight) / im.naturalWidth));
  let src = im;
  let cw = im.naturalWidth;
  let ch = im.naturalHeight;
  while (cw / 2 >= tw) {
    const c = document.createElement("canvas");
    cw = Math.floor(cw / 2);
    ch = Math.floor(ch / 2);
    c.width = cw;
    c.height = ch;
    c.getContext("2d").drawImage(src, 0, 0, cw, ch);
    src = c;
  }
  cv = document.createElement("canvas");
  cv.width = tw;
  cv.height = th;
  const c2 = cv.getContext("2d");
  c2.imageSmoothingQuality = "high";
  c2.drawImage(src, 0, 0, tw, th);
  if (ta > 0) {
    c2.globalCompositeOperation = "source-atop";
    c2.fillStyle = `rgba(${tint[0] | 0}, ${tint[1] | 0}, ${tint[2] | 0}, ${ta / 20})`;
    c2.fillRect(0, 0, tw, th);
  }
  tintCache.set(key, cv);
  return cv;
}

// 縦長のスマホで空く、画面下の砂浜の飾り: 砂の波紋・足あと・小石・ヒトデ。時間帯の色味に合わせて暗くなる
function drawSandDetails(ctx, pal, W, H, gy) {
  const tn = pal.tint;
  const k = tn[3];
  const mix = (r, g, b) => [r * (1 - k) + tn[0] * k, g * (1 - k) + tn[1] * k, b * (1 - k) + tn[2] * k];
  const brown = mix(122, 92, 64);
  const rgb = (c, a) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;
  ctx.save();
  // 砂の風紋
  ctx.lineCap = "round";
  for (let i = 0; i < 7; i++) {
    const y0 = gy + H * 0.035 + i * H * 0.027;
    ctx.strokeStyle = rgb(brown, 0.075 * (1 - i * 0.07));
    ctx.lineWidth = 1.2 + i * 0.25;
    ctx.beginPath();
    for (let x = 0; x <= W + 8; x += 8) {
      const yy = y0 + Math.sin(x * 0.012 + i * 1.9) * (2 + i * 0.8) + Math.sin(x * 0.031 + i) * 1.2;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // 足あと: 下から海のほうへ、左右交互に続く（遠いほど小さく薄い）
  const n = 11;
  const yNear = H * 0.985;
  const yFar = gy + H * 0.055;
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const y = yNear - u * (yNear - yFar);
    const side = i % 2 ? 1 : -1;
    const x = W * (0.34 + 0.07 * Math.sin(u * 3.2)) + side * W * 0.02 * (1 - u * 0.4);
    const sc = 1 - u * 0.45;
    const a = 0.17 - u * 0.09;
    ctx.fillStyle = rgb(brown, a);
    ctx.beginPath();
    ctx.ellipse(x, y, W * 0.011 * sc, W * 0.019 * sc, side * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x - side * W * 0.002 * sc, y + W * 0.03 * sc, W * 0.0075 * sc, W * 0.0085 * sc, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 小石
  const pebbles = [
    [0.12, 0.915, 0.014],
    [0.2, 0.955, 0.009],
    [0.63, 0.935, 0.011],
    [0.9, 0.975, 0.016],
    [0.5, 0.99, 0.008],
  ];
  for (const [fx, fy, fr] of pebbles) {
    ctx.fillStyle = rgb(mix(150, 130, 112), 0.55);
    ctx.beginPath();
    ctx.ellipse(W * fx, H * fy, W * fr * 1.3, W * fr, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.beginPath();
    ctx.ellipse(W * fx - W * fr * 0.3, H * fy - W * fr * 0.3, W * fr * 0.45, W * fr * 0.3, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // ヒトデ
  const cx = W * 0.77;
  const cy = H * 0.925;
  const R = W * 0.06;
  const star = mix(238, 126, 94);
  ctx.translate(cx, cy);
  ctx.rotate(-0.35);
  ctx.beginPath();
  for (let a = 0; a <= 360; a += 4) {
    const th = (a * Math.PI) / 180;
    const rr = R * (0.46 + 0.54 * Math.pow(Math.abs(Math.cos(2.5 * th)), 0.8));
    const px = Math.cos(th) * rr;
    const py = Math.sin(th) * rr;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = rgb(star, 0.92);
  ctx.fill();
  ctx.strokeStyle = rgb(mix(196, 86, 62), 0.55);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 232, 214, 0.7)";
  for (let arm = 0; arm < 5; arm++) {
    const th = (arm * 72 * Math.PI) / 180;
    for (let q = 0.28; q < 0.9; q += 0.2) {
      ctx.beginPath();
      ctx.arc(Math.cos(th) * R * q, Math.sin(th) * R * q, R * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export default function P5Canvas({ theme, art }) {
  const sketchRef = useRef(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const artRef = useRef(art);
  artRef.current = art;

  useEffect(() => {
    let p5Instance;
    let resizer;
    let onSend;
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
        let nextCloud = rand(3000, 8000);
        let boatClock = 20000; // 起動後まもなく船が見えるように
        let bubbles = []; // 波が引いたあとの砂浜に残る、しゅわしゅわした泡
        let wetBottom = 0;
        let plane = null;
        let words = []; // 「言葉を海へ」で飛ばされた言葉
        let nextBird = rand(4000, 9000);
        let nextPlane = rand(20000, 35000);
        const pal = clone(PALETTES[themeRef.current]);
        let phi = THEME_PHI[themeRef.current]; // 太陽の軌道上の位置
        let omega = 0;
        let artCur = artRef.current; // イラストの切り替えは、ふわっと重ねて入れ替える
        let artPrev = artCur;
        let artFade = 1;
        const sprites = {};
        for (const [key, set] of Object.entries(ART_SETS)) {
          for (const n of SPRITE_NAMES) {
            const im = new Image();
            im.src = `${set.dir}/${n}.webp`;
            sprites[`${key}/${n}`] = im;
          }
        }
        const artSet = () => ART_SETS[artCur] || ART_SETS.classic;

        const size = () => ({
          w: sketchRef.current?.clientWidth || window.innerWidth,
          h: sketchRef.current?.clientHeight || window.innerHeight,
        });

        const spawnBirds = (W, H, horizonY) => {
          const away = Math.random() < 0.4;
          const r = Math.random();
          // 1羽が多く、ときどき小さな群れ・大きめの群れ
          const n = r < 0.55 ? 1 : r < 0.85 ? 2 + Math.floor(Math.random() * 2) : 4 + Math.floor(Math.random() * 2);
          const dir = Math.random() < 0.5 ? 1 : -1;
          const baseY = rand(0.05, 0.27) * H;
          const baseX = away ? rand(0.2, 0.8) * W : dir > 0 ? -40 : W + 40;
          const dur = away ? rand(8000, 14000) : rand(11000, 26000);
          const sizeBase = rand(0.7, 1.4);
          const rate = rand(0.005, 0.011); // 羽ばたきの速さも、群れごとに違う
          for (let i = 0; i < n; i++) {
            birds.push({
              away,
              dir,
              age: -i * rand(300, 700), // 群れは少しずつずらして飛ばす
              dur: dur * rand(0.92, 1.08),
              x0: baseX - dir * i * rand(26, 50),
              y0: baseY + i * rand(8, 30) * (Math.random() < 0.5 ? 1 : -1),
              // 奥へ消える鳥は水平線の少し上へ向かう
              x1: baseX + rand(-0.12, 0.12) * W,
              y1: horizonY - 6,
              size: sizeBase * rand(0.85, 1.15),
              ph: rand(0, 6.28),
              rate: rate * rand(0.9, 1.1),
              sway: rand(0.6, 1.4),
            });
          }
        };
        const spawnCloud = (W, H) => {
          const dir = Math.random() < 0.5 ? 1 : -1;
          const frac = rand(0.1, 0.42); // 小さな雲から、大きな雲まで
          const w = W * frac;
          const tall = rand(0.5, 1.4); // 平たい雲 / もこもこした雲
          const n = Math.max(5, Math.min(13, Math.round(5 + frac * 18 + rand(-1, 2))));
          const puffs = [];
          for (let i = 0; i < n; i++) {
            const u = (i + 0.5) / n;
            const hump = Math.sin(u * Math.PI);
            puffs.push({
              dx: (u - 0.5) * w,
              dy: -hump * w * 0.05 * tall * rand(0.6, 1.2) + rand(-0.01, 0.01) * w,
              r: w * (0.07 + 0.11 * hump) * rand(0.75, 1.2),
            });
          }
          clouds.push({
            dir,
            w,
            puffs,
            x: dir > 0 ? -w * 0.6 : W + w * 0.6,
            y: rand(0.04, 0.27) * H,
            vx: (W + w * 1.2) / (rand(70000, 150000) * (1.2 - frac * 0.8)),
            alpha: rand(0.45, 1),
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

        // 画像を (x, y) に描く。ax/ay は画像上の基準点(0〜1)、flip で左右反転、sy で縦方向の伸縮(羽ばたき)
        const drawOne = (ctx, set, name, x, y, w, o, alpha) => {
          const im = sprites[`${set}/${name}`];
          if (!im || !im.complete || !im.naturalWidth) return 0;
          const h = (w * im.naturalHeight) / im.naturalWidth;
          const cv = spriteCanvas(im, `${set}/${name}`, w, pal.tint);
          const flip = o.gullLeft !== undefined ? (ART_SETS[set].gullFacesLeft ? !o.gullLeft : o.gullLeft) : o.flip;
          ctx.save();
          ctx.translate(x, y);
          if (o.rot) ctx.rotate(o.rot);
          ctx.scale(flip ? -1 : 1, o.sy || 1);
          ctx.globalAlpha = alpha;
          ctx.drawImage(cv, -w * (o.ax ?? 0.5), -h * (o.ay ?? 0.5), w, h);
          ctx.restore();
          return h;
        };
        const drawSprite = (ctx, name, x, y, w, o = {}) => {
          const a = o.alpha ?? 1;
          if (artFade < 1) {
            drawOne(ctx, artPrev, name, x, y, w, o, a * (1 - artFade));
            return drawOne(ctx, artCur, name, x, y, w, o, a * artFade);
          }
          return drawOne(ctx, artCur, name, x, y, w, o, a);
        };

        // 入力欄の言葉が、水平線の近くまで飛んでいき、波に乗って流れていく
        onSend = (e) => {
          const d = e.detail;
          if (!d?.lines?.length) return;
          const box = sketchRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
          const W = p.width;
          const H = p.height;
          const dir = Math.random() < 0.5 ? 1 : -1;
          const tx = rand(0.22, 0.78) * W;
          const x0 = d.cx - box.left;
          const y0 = d.cy - box.top;
          const ty = H * HORIZON + H * rand(0.035, 0.07);
          words.push({
            lines: d.lines,
            fs: d.fs,
            x0,
            y0,
            tx,
            ty,
            cx: (x0 + tx) / 2 + rand(-0.15, 0.15) * W,
            cy: Math.min(y0, ty) - H * 0.18,
            dir,
            vx: dir * W * rand(0.00002, 0.00005),
            ph: rand(0, 6.28),
            age: 0,
            flyMs: 3200,
            floatMs: 16000,
          });
        };
        window.addEventListener("send-words", onSend);

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
          // 太陽の軌道上の位置を、必ず進む向きに動かす（時間を戻す選択でも、夕・夜を回ってから朝になる）
          const phiTarget = THEME_PHI[themeRef.current];
          let delta = (((phiTarget - phi) % TAU) + TAU) % TAU;
          if (delta > TAU - 0.01) delta = 0;
          const desired = delta < 0.002 ? 0 : Math.min(0.9, delta * 1.6 + 0.05);
          omega += (desired - omega) * (1 - Math.exp(-dt / 250));
          phi = (phi + Math.min(delta, (omega * dt) / 1000)) % TAU;
          // 空・海・砂・星・雲などの色は、いまの軌道上の位置から決める（夕→朝なら、夜の暗さを通る）
          const ph = phi < Math.PI / 2 ? phi + TAU : phi;
          let seg = 0;
          while (seg < KEYFRAMES.length - 2 && ph >= KEYFRAMES[seg + 1][1]) seg++;
          const [nameA, angA] = KEYFRAMES[seg];
          const [nameB, angB] = KEYFRAMES[seg + 1];
          mixInto(pal, PALETTES[nameA], PALETTES[nameB], smooth(Math.min(1, Math.max(0, (ph - angA) / (angB - angA)))));
          // 文字の色・にじみも、いまの空の明るさに合わせる
          if (p.frameCount % 5 === 0) {
            const stage = sketchRef.current?.parentElement;
            if (stage) {
              const st = Math.min(1, Math.max(0, pal.stars));
              stage.style.setProperty("--ink", `rgb(${pal.ink.map((v) => v | 0).join(",")})`);
              stage.style.setProperty(
                "--glow",
                `rgba(${[255 - 247 * st, 255 - 245 * st, 255 - 207 * st].map((v) => v | 0).join(",")}, ${0.7 + 0.05 * st})`,
              );
            }
          }
          if (artRef.current !== artCur) {
            artPrev = artCur;
            artCur = artRef.current;
            artFade = 0;
          }
          artFade = Math.min(1, artFade + dt / 450);
          t += dt * 0.0004;

          if (phase === "wait" && phaseTime > waitMs) {
            phase = "down";
            phaseTime = 0;
            if (clock >= nextBigAt) {
              // 大きな波: 文字のある砂浜まで下りてくる
              target = rand(0.6, 0.96); // どこまで迫るかは、そのときしだい
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
            baseY + Math.sin(x * freq + t * 0.55) * amp + Math.sin(x * freq * 2.5 + t * 0.8) * amp * 0.33;
          // 波の縁をたどる x の位置。0 から右端の少し外まで。往復で同じ点を使うので、どの画面幅でも左端(x=0)まで届く
          const xs = [];
          {
            let x = 0;
            while (x < W + 6) {
              xs.push(x);
              x += 6;
            }
            xs.push(x);
          }

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

          // ---- 太陽と月（別の天体。水平線より下は描かない） ----
          const unit = Math.min(W, H) * 0.11;
          const phiMoon = moonPsi(phi);
          const sunR = unit * pal.sunScale;
          const moonR = unit * MOON.scale;
          const bodies = [
            { x: W * (0.5 - ORBIT_X * Math.cos(phi)), r: sunR, fade: 1, k: -SUN_K * Math.sin(phi), core: pal.sunCore, glow: pal.sunGlow, refl: pal.sunReflect, moon: false },
            { x: W * (0.5 - ORBIT_X * Math.cos(phiMoon)), r: moonR, k: -MOON_K * Math.sin(phiMoon), core: MOON.core, glow: MOON.glow, refl: MOON.reflect, moon: true, fade: 0.38 + 0.62 * Math.min(1, Math.max(0, pal.stars)) },
          ];
          for (const b of bodies) {
            b.y = horizonY + b.r * b.k;
            b.vis = Math.max(0, Math.min(1, 1.5 - b.k)); // 沈みきったら反射も消える
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, horizonY);
          ctx.clip();
          p.noStroke();
          for (const b of bodies) {
            if (b.k > 2.4) continue;
            ctx.globalAlpha = b.fade; // 昼の月は淡く
            for (let i = 6; i >= 1; i--) {
              p.fill(b.glow[0], b.glow[1], b.glow[2], 14);
              p.circle(b.x, b.y, b.r * (1 + i * 0.55));
            }
            p.fill(b.core[0], b.core[1], b.core[2]);
            p.circle(b.x, b.y, b.r * 2);
            if (b.moon) {
              p.fill(196, 204, 230, 80);
              p.circle(b.x - b.r * 0.3, b.y - b.r * 0.2, b.r * 0.45);
              p.circle(b.x + b.r * 0.35, b.y + b.r * 0.25, b.r * 0.3);
              p.circle(b.x + b.r * 0.1, b.y - b.r * 0.55, b.r * 0.2);
            } else {
              p.fill(255, 245, 210, 200);
              p.circle(b.x, b.y, b.r * 1.5);
            }
          }
          ctx.globalAlpha = 1;
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
            nextBird = clock + rand(22000, 50000);
          }
          if (!plane && clock > nextPlane) {
            const dir = Math.random() < 0.5 ? 1 : -1;
            const pw = clamp(Math.min(W, H) * 0.2 * rand(0.65, 1.4), 44, 190);
            plane = {
              dir,
              w: pw,
              x0: dir > 0 ? -pw : W + pw,
              x: dir > 0 ? -pw : W + pw,
              y0: rand(0.12, 0.32) * H,
              vx: (W + pw * 2) / rand(20000, 38000),
            };
            nextPlane = clock + rand(80000, 150000);
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, horizonY);
          ctx.clip();
          if (clock > nextCloud && clouds.length < 2) {
            spawnCloud(W, H);
            nextCloud = clock + rand(35000, 80000);
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
              s = clamp(Math.min(W, H) * 0.06, 26, 70) * b.size * (1 - 0.8 * k);
              a = 1 - Math.max(0, (k - 0.75) / 0.25);
            } else {
              x = b.x0 + b.dir * (W + 80) * k;
              y = b.y0 + Math.sin(k * 6 * b.sway + b.ph) * H * 0.02;
              s = clamp(Math.min(W, H) * 0.06, 26, 70) * b.size;
            }
            const flap = Math.sin(clock * b.rate + b.ph);
            const left = b.away ? b.x1 < b.x0 : b.dir < 0;
            drawSprite(ctx, "flying-seagull", x, y, s, {
              gullLeft: left,
              sy: 1 + flap * 0.16,
              rot: (left ? 1 : -1) * flap * 0.05,
              alpha: a,
            });
          }
          if (plane) {
            plane.x += plane.vx * plane.dir * dt;
            // 機首を少し上げたまま、ゆっくり上昇していく
            const py = plane.y0 - Math.abs(plane.x - plane.x0) * artSet().planeSlope + Math.sin(clock * 0.0017) * 2;
            drawSprite(ctx, "distant-plane", plane.x, py, plane.w, { flip: plane.dir < 0, alpha: 0.95 });
            if (plane.x < -plane.w * 1.5 || plane.x > W + plane.w * 1.5) plane = null;
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
          for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(xs[i], waveY(xs[i]));
          ctx.closePath();
          ctx.fill();

          // 太陽・月の反射（海面のきらめき）
          for (const b of bodies) {
            if (b.vis < 0.02) continue;
            for (let y = horizonY + 4; y < baseY - 6; y += 7) {
              const k = (y - horizonY) / Math.max(1, H * 0.5);
              const w = b.r * (0.5 + k * 1.6) * (0.7 + 0.3 * Math.sin(y * 0.4 + t * 0.9));
              p.fill(b.refl[0], b.refl[1], b.refl[2], Math.max(0, 120 - k * 150) * b.vis * b.fade);
              p.rect(b.x - w / 2, y, w, 2.5, 2);
            }
          }

          // 遠近感のあるさざ波: 水平線付近は細かく密に、手前ほど太く間隔が広い。ゆっくり手前へ寄ってくる
          const seaH = baseY - horizonY;
          if (seaH > 12) {
            const ROWS = 4;
            const drift = (t * 0.035) % 1;
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
              ctx.lineDashOffset = -t * (30 + depth * 120) * 0.35 + i * 40;
              ctx.beginPath();
              for (let x = 0; x <= W + 8; x += 8) {
                const yy = y + Math.sin((x / wl) * 6.283 + t * 0.3 + i * 1.7) * (0.6 + depth * 5);
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

          // ---- 船（水平線の近くを、ゆっくり右から左へ。船体の下は水の中に沈めて、浮かんでゆらゆら） ----
          boatClock += dt;
          const boatK = (boatClock % 66000) / 48000;
          if (boatK < 1) {
            const bw = clamp(Math.min(W, H) * 0.17, 64, 170);
            const bx = W + bw - (W + bw * 2) * boatK;
            const waterY = horizonY + Math.min(14, seaH * 0.5);
            const bob = Math.sin(clock * 0.0007) * bw * 0.025;
            // 水の中の影
            ctx.fillStyle = "rgba(20, 30, 70, 0.2)";
            ctx.beginPath();
            ctx.ellipse(bx, waterY + 3, bw * 0.5, bw * 0.035, 0, 0, Math.PI * 2);
            ctx.fill();
            // 水面より下は描かない（船体の下のほうが水に沈む）
            ctx.save();
            ctx.beginPath();
            ctx.rect(bx - bw, 0, bw * 2, waterY);
            ctx.clip();
            drawSprite(ctx, "fishing-boat", bx, waterY + bob, bw, {
              flip: true, // 船首を進行方向(左)へ
              ay: 0.87,
              rot: Math.sin(clock * 0.0005 + 1) * 0.028,
            });
            ctx.restore();
            // 船のまわりの水面の波紋
            ctx.lineCap = "round";
            ctx.lineWidth = 1.4;
            for (let i = 0; i < 2; i++) {
              const half = bw * (0.54 - i * 0.14);
              ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 - i * 0.2})`;
              ctx.beginPath();
              for (let x = -half; x <= half; x += 4) {
                const yy = waterY + 1.5 + i * 3.5 + Math.sin(x * 0.09 + clock * 0.0009 + i) * 1.1;
                if (x === -half) ctx.moveTo(bx + x, yy);
                else ctx.lineTo(bx + x, yy);
              }
              ctx.stroke();
            }
          }

          // ---- 海へ送られた言葉（飛んでいって、遠ざかりながら流れて消える） ----
          words = words.filter((w) => w.age < w.flyMs + w.floatMs);
          const wordsDark = pal.stars > 0.5;
          for (const w of words) {
            w.age += dt;
            let x, y, sc, a, rot;
            if (w.age < w.flyMs) {
              const u = ease(w.age / w.flyMs);
              x = (1 - u) * (1 - u) * w.x0 + 2 * (1 - u) * u * w.cx + u * u * w.tx;
              y = (1 - u) * (1 - u) * w.y0 + 2 * (1 - u) * u * w.cy + u * u * w.ty;
              sc = 1 - 0.62 * u;
              a = 1;
              rot = Math.sin(u * Math.PI) * 0.12 * w.dir;
            } else {
              const f = w.age - w.flyMs;
              const q = f / w.floatMs;
              x = w.tx + w.vx * f;
              y = w.ty - Math.min(f * 0.0005, H * 0.015) + Math.sin(clock * 0.0014 + w.ph) * 3;
              sc = 0.38 - 0.12 * q;
              a = Math.pow(1 - q, 1.3);
              rot = Math.sin(clock * 0.0011 + w.ph) * 0.03;
            }
            const size = Math.max(9, w.fs * sc);
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(rot);
            ctx.font = `${size}px "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowColor = wordsDark ? `rgba(8, 10, 48, ${0.7 * a})` : `rgba(255, 255, 255, ${0.6 * a})`;
            ctx.shadowBlur = 8 * sc;
            ctx.fillStyle = rgba(pal.ink, a);
            const n = w.lines.length;
            w.lines.forEach((ln, i) => ctx.fillText(ln, 0, (i - (n - 1) / 2) * size * 1.3));
            ctx.restore();
          }

          // ---- 波が引いたあとの濡れた砂 ----
          const frontBottom = baseY + foamHeight + amp * 0.5;
          if (frontBottom > wetBottom) wetBottom = frontBottom;
          else wetBottom = Math.max(frontBottom, wetBottom - dt * H * 0.000012);
          const wetH = wetBottom - frontBottom;
          if (wetH > 2) {
            ctx.fillStyle = `rgba(80, 60, 72, ${0.1 * Math.min(1, wetH / (H * 0.05))})`;
            ctx.beginPath();
            xs.forEach((x, i) => {
              const y0 = waveY(x) + foamHeight * 0.5;
              if (i === 0) ctx.moveTo(x, y0);
              else ctx.lineTo(x, y0);
            });
            for (let i = xs.length - 1; i >= 0; i--) {
              ctx.lineTo(xs[i], wetBottom + Math.sin(xs[i] * 0.02 + t * 0.3) * 5);
            }
            ctx.closePath();
            ctx.fill();
          }

          // ---- 白い泡 ----
          ctx.fillStyle = `rgba(255, 255, 255, ${pal.foam})`;
          ctx.beginPath();
          xs.forEach((x, i) => {
            if (i === 0) ctx.moveTo(x, waveY(x));
            else ctx.lineTo(x, waveY(x));
          });
          for (let i = xs.length - 1; i >= 0; i--) {
            const x = xs[i];
            const wob = Math.sin(x * 0.015 - t * 0.55) * 5;
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
              const y = yTop + Math.pow(Math.random(), 1.6) * Math.max(2, wetBottom - yTop);
              // 遠近感: 奥(水平線寄り)ほど小さく・薄く・多く、手前ほど大きく・はっきり・少なく
              const d = Math.max(0, Math.min(1, (y - horizonY) / (H - horizonY)));
              if (Math.random() > 1 - d * 0.55) continue;
              bubbles.push({
                x,
                y,
                d,
                r: rand(0.8, 2.4) * (0.25 + 2.2 * d * d),
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
            const a = pal.foam * (1 - k * 0.6) * (1 - pop) * (0.5 + 0.5 * b.d);
            ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.4})`;
            ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
            ctx.lineWidth = 0.6 + b.d * 1.0;
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
            const yy = waveY(x) - foamHeight * 1.1 + Math.sin(x * freq * 1.7 - t * 0.5) * amp * 0.4;
            if (x === 0) ctx.moveTo(x, yy);
            else ctx.lineTo(x, yy);
          }
          ctx.stroke();

          // ---- 貝・カニ・岩（画面幅に合わせて大きさを決める） ----
          const m = Math.min(W, H);
          const rw = clamp(Math.min(W * 0.28, H * 0.42), 100, 330);
          const sw = clamp(m * 0.075, 26, 64);
          const cw = clamp(m * 0.11, 44, 110);
          // 縦長のスマホは、キーボードを出すと岩やカニが上へ来るので、最初から画面の下のほうに置く。その下の砂浜には足あとや星の砂を置く
          const phone = H / W >= 1.6;
          const gy = phone ? H * 0.86 : H; // 岩・カニ・貝の接地線
          if (phone) drawSandDetails(ctx, pal, W, H, gy);
          // カニは左右の岩のあいだだけを歩く。貝はその中央寄りに置く
          const half = Math.max(W * 0.05, W / 2 - rw * 1.25 - cw * 0.5);
          drawSprite(ctx, "scallop-shell", W * 0.5 - half * 0.6, gy - H * 0.025, sw, { rot: -0.35 });
          const crabX = W * 0.5 + Math.sin(clock * 0.000524) * half;
          const crabY = gy - H * 0.035;
          ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
          ctx.beginPath();
          ctx.ellipse(crabX, crabY, cw * 0.42, cw * 0.05, 0, 0, Math.PI * 2);
          ctx.fill();
          drawSprite(ctx, "sand-crab", crabX, crabY - Math.abs(Math.sin(clock * 0.012)) * cw * 0.03, cw, {
            ay: 0.88,
            rot: Math.sin(clock * 0.012) * 0.04,
          });
          const rock = (x, w2, flip) => {
            const rim = sprites[`${artCur}/shore-rock`];
            const rh = w2 * (rim && rim.naturalWidth ? rim.naturalHeight / rim.naturalWidth : 0.58);
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.beginPath();
            ctx.ellipse(x, gy - rh * 0.1, w2 * 0.52, rh * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            drawSprite(ctx, "shore-rock", x, gy + rh * 0.16, w2, { ay: 1, flip });
          };
          rock(rw * 0.42, rw, false);
          rock(rw * 0.98, rw * 0.5, true);
          rock(W - rw * 0.42, rw, true);
          rock(W - rw * 0.98, rw * 0.5, false);

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

        // 画面の回転やキーボードの出入りで、描く領域の大きさが変わったら追従する
        resizer = new ResizeObserver(() => {
          const { w, h } = size();
          if (w > 0 && h > 0 && (w !== p.width || h !== p.height)) p.resizeCanvas(w, h);
        });
        resizer.observe(sketchRef.current);
      };

      p5Instance = new p5(sketch);
    };

    startP5();

    return () => {
      cancelled = true;
      if (onSend) window.removeEventListener("send-words", onSend);
      resizer?.disconnect();
      if (p5Instance) p5Instance.remove();
    };
  }, []);

  return <div ref={sketchRef} className="sea" />;
}
