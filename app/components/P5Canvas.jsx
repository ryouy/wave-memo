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
const rgba = (c, a = c[3] ?? 1) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`;

// ---- イラスト（public/art）の描画 ----
// 絵のセット。classic = 絵画風イラスト / pop = ポップなイラスト。絵ごとの向きの違いもここで吸収する
const ART_SETS = {
  classic: { dir: "/art/classic", gullFacesLeft: false, planeSlope: 0.17 },
  pop: { dir: "/art/pop", gullFacesLeft: true, planeSlope: 0.2 },
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

export default function P5Canvas({ theme, art }) {
  const sketchRef = useRef(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const artRef = useRef(art);
  artRef.current = art;

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
        const sprites = {};
        for (const [key, set] of Object.entries(ART_SETS)) {
          for (const n of SPRITE_NAMES) {
            const im = new Image();
            im.src = `${set.dir}/${n}.webp`;
            sprites[`${key}/${n}`] = im;
          }
        }
        const artSet = () => ART_SETS[artRef.current] || ART_SETS.classic;

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

        // 画像を (x, y) に描く。ax/ay は画像上の基準点(0〜1)、flip で左右反転、sy で縦方向の伸縮(羽ばたき)
        const drawSprite = (ctx, name, x, y, w, o = {}) => {
          const im = sprites[`${artRef.current}/${name}`];
          if (!im || !im.complete || !im.naturalWidth) return 0;
          const h = (w * im.naturalHeight) / im.naturalWidth;
          const cv = spriteCanvas(im, `${artRef.current}/${name}`, w, pal.tint);
          ctx.save();
          ctx.translate(x, y);
          if (o.rot) ctx.rotate(o.rot);
          ctx.scale(o.flip ? -1 : 1, o.sy || 1);
          if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
          ctx.drawImage(cv, -w * (o.ax ?? 0.5), -h * (o.ay ?? 0.5), w, h);
          ctx.restore();
          return h;
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
            const pw = clamp(Math.min(W, H) * 0.2, 56, 150);
            plane = {
              dir,
              w: pw,
              x0: dir > 0 ? -pw : W + pw,
              x: dir > 0 ? -pw : W + pw,
              y0: rand(0.2, 0.3) * H,
              vx: (W + pw * 2) / 26000,
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
              s = clamp(Math.min(W, H) * 0.06, 26, 70) * b.size * (1 - 0.8 * k);
              a = 1 - Math.max(0, (k - 0.75) / 0.25);
            } else {
              x = b.x0 + b.dir * (W + 80) * k;
              y = b.y0 + Math.sin(k * 6 * b.sway + b.ph) * H * 0.02;
              s = clamp(Math.min(W, H) * 0.06, 26, 70) * b.size;
            }
            const flap = Math.sin(clock * 0.008 + b.ph);
            const left = b.away ? b.x1 < b.x0 : b.dir < 0;
            drawSprite(ctx, "flying-seagull", x, y, s, {
              flip: artSet().gullFacesLeft ? !left : left,
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
          const boatK = (boatClock % 45000) / 32000;
          if (boatK < 1) {
            const bw = clamp(Math.min(W, H) * 0.17, 64, 170);
            const bx = W + bw - (W + bw * 2) * boatK;
            const by = horizonY + Math.min(14, seaH * 0.5) + Math.sin(clock * 0.0016) * bw * 0.02;
            ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
            ctx.beginPath();
            ctx.ellipse(bx, by + 1, bw * 0.46, bw * 0.03, 0, 0, Math.PI * 2);
            ctx.fill();
            drawSprite(ctx, "fishing-boat", bx, by, bw, {
              flip: true, // 船首を進行方向(左)へ
              ay: 0.92,
              rot: Math.sin(clock * 0.0011) * 0.03,
            });
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

          // ---- 貝・カニ・岩（画面幅に合わせて大きさを決める） ----
          const m = Math.min(W, H);
          const rw = clamp(Math.min(W * 0.28, H * 0.42), 100, 330);
          const sw = clamp(m * 0.075, 26, 64);
          const cw = clamp(m * 0.11, 44, 110);
          // カニは左右の岩のあいだだけを歩く。貝はその中央寄りに置く
          const half = Math.max(W * 0.05, W / 2 - rw * 1.25 - cw * 0.5);
          drawSprite(ctx, "scallop-shell", W * 0.5 - half * 0.6, H * 0.975, sw, { rot: -0.35 });
          const crabX = W * 0.5 + Math.sin(clock * 0.000524) * half;
          ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
          ctx.beginPath();
          ctx.ellipse(crabX, H * 0.965, cw * 0.42, cw * 0.05, 0, 0, Math.PI * 2);
          ctx.fill();
          drawSprite(ctx, "sand-crab", crabX, H * 0.965 - Math.abs(Math.sin(clock * 0.012)) * cw * 0.03, cw, {
            ay: 0.88,
            rot: Math.sin(clock * 0.012) * 0.04,
          });
          const rock = (x, w2, flip) => {
            const rim = sprites[`${artRef.current}/shore-rock`];
            const rh = w2 * (rim && rim.naturalWidth ? rim.naturalHeight / rim.naturalWidth : 0.58);
            ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
            ctx.beginPath();
            ctx.ellipse(x, H - rh * 0.1, w2 * 0.52, rh * 0.1, 0, 0, Math.PI * 2);
            ctx.fill();
            drawSprite(ctx, "shore-rock", x, H + rh * 0.16, w2, { ay: 1, flip });
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
