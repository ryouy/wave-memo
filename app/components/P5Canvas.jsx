"use client";

import { useEffect, useRef } from "react";

export default function P5Canvas() {
  const sketchRef = useRef(null);

  useEffect(() => {
    let p5Instance;

    const startP5 = async () => {
      const p5 = (await import("p5")).default;

      const sketch = (p) => {
        let t = 0;
        let noiseTime = 0;
        let lastTrigger = 0;
        let lastInterval = 0;

        p.setup = () => {
          p.createCanvas(window.innerWidth, 700).parent(sketchRef.current);
        };

        p.draw = () => {
          p.clear(); // 背景透過

          // ===============================
          // リアルな上下動オフセットを計算 (p.noise() を使用)
          // ===============================
          const noiseValue = p.noise(noiseTime);
          // 波の上下振幅を大きく設定
          const amplitude = 220;
          const verticalOffset = p.map(noiseValue, 0, 1, -amplitude, amplitude);

          // ===============================
          // 波の計算
          // ===============================
          const baseY = p.height / 2 + 60 + verticalOffset;
          const foamHeight = 75; // 波頭の白い泡の幅
          let waveVertices = [];

          for (let x = 0; x <= p.width; x += 5) {
            const y =
              baseY +
              Math.sin(x * 0.015 + t) * 25 +
              Math.sin(x * 0.04 + t * 1.6) * 8;
            waveVertices.push({ x, y });
          }

          // ===============================
          // 1. 白い泡の部分を描画
          // ===============================
          p.noStroke();
          p.fill(255, 255, 255, 155); // 白い波
          p.beginShape();
          // 基準線を左から右へ
          for (const v of waveVertices) {
            p.vertex(v.x, v.y);
          }
          // 下の線を右から左へ (基準線 + foamHeight)
          for (let i = waveVertices.length - 1; i >= 0; i--) {
            p.vertex(waveVertices[i].x, waveVertices[i].y + foamHeight);
          }
          p.endShape(p.CLOSE);

          // ===============================
          // 2. 白い泡より上の領域を緑で塗りつぶす
          // ===============================
          p.noStroke();
          p.fill(65, 137, 232, 180); // 半透明の緑
          p.beginShape();
          p.vertex(0, 0); // 左上
          // 基準線を左から右へ
          for (const v of waveVertices) {
            p.vertex(v.x, v.y);
          }
          p.vertex(p.width, 0); // 右上
          p.endShape(p.CLOSE);

          // 時間経過 (波のサイン形状の変化速度)
          t += 0.01;

          // うねりの時間 (全体の上下動の速度)
          noiseTime += 0.003;

          // 一定間隔（4秒）で確実にイベントを発火させる
          const now = p.millis();
          if (now - lastInterval > 7000) {
            const intensity = p.map(noiseValue, 0, 1, 0.4, 1);
            const samples = [];
            const rect = sketchRef.current?.getBoundingClientRect() || {
              top: 0,
              left: 0,
            };
            for (let i = 0; i < waveVertices.length; i += 6) {
              samples.push({
                x: waveVertices[i].x + rect.left,
                y: waveVertices[i].y + rect.top,
              });
            }
            window.dispatchEvent(
              new CustomEvent("wave-pass", {
                detail: { intensity, wave: { foamHeight, samples } },
              }),
            );
            lastInterval = now;
          }
        };

        p.windowResized = () => {
          p.resizeCanvas(window.innerWidth, 400);
        };
      };

      p5Instance = new p5(sketch);
    };

    startP5();

    return () => {
      if (p5Instance) p5Instance.remove();
    };
  }, []);

  return (
    <div ref={sketchRef} className="relative w-full h-[400px]">
      <img
        src="/boat.png"
        alt="boat"
        className="pointer-events-none absolute top-[48%] w-[90px] sm:w-[110px] md:w-[130px] drop-shadow-[0_6px_10px_rgba(0,0,0,0.25)]"
        style={{ animation: "boat-drift 28s linear infinite" }}
      />
      <img
        src="/crab.png"
        alt="crab"
        className="pointer-events-none absolute left-1/2 w-[60px] sm:w-[70px] md:w-[80px] drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
        style={{
          bottom: "1%",
          animation: "crab-walk 12s ease-in-out infinite",
        }}
      />
      <style jsx global>{`
        @keyframes boat-drift {
          0% {
            transform: translate(-50%, -50%) translateX(120vw);
            opacity: 0;
          }
          6% {
            opacity: 1;
          }
          70% {
            transform: translate(-50%, -50%) translateX(-20vw);
            opacity: 1;
          }
          85% {
            transform: translate(-50%, -50%) translateX(-20vw);
            opacity: 1;
          }
          86% {
            opacity: 0;
          }
          100% {
            transform: translate(-50%, -50%) translateX(120vw);
            opacity: 0;
          }
        }
        @keyframes crab-walk {
          0% {
            transform: translateX(-35vw);
          }
          50% {
            transform: translateX(35vw);
          }
          100% {
            transform: translateX(-35vw);
          }
        }
      `}</style>
    </div>
  );
}
