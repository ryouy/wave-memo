"use client";

import { useEffect, useRef } from "react";

export default function TextOverlay({ text, onDelete }) {
  const canvasRef = useRef(null);
  const lineInfosRef = useRef([]);
  const animRef = useRef(null);

  // n文字で折り返し（およそ7文字）
  const wrapSize = 7;

  const layoutLines = (ctx, maxWidth, paddingLeft, paddingTop, lineHeight) => {
    const lines = [];
    // テキストを行に分割（wrapSizeごと）
    const raw = text.replace(/\r/g, "");
    let idx = 0;
    for (let i = 0; i < raw.length; i += wrapSize) {
      const chunk = raw.slice(i, i + wrapSize);
      const startIndex = i;
      const w = Math.ceil(ctx.measureText(chunk).width);
      const x = paddingLeft;
      const y = paddingTop + (lines.length + 1) * lineHeight;
      lines.push({
        startIndex,
        length: chunk.length,
        text: chunk,
        x,
        y,
        w,
        opacity: 1,
        fading: false,
      });
      idx += chunk.length;
    }
    return lines;
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = "alphabetic";
    const lines = lineInfosRef.current;
    for (const line of lines) {
      ctx.globalAlpha = line.opacity;
      ctx.fillText(line.text, line.x, line.y);
    }
    ctx.globalAlpha = 1;
    animRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ta = document.querySelector(".textarea-clean");
    if (!canvas || !ta) return;

    canvas.width = ta.clientWidth;
    canvas.height = ta.clientHeight;
    canvas.style.width = `${ta.clientWidth}px`;
    canvas.style.height = `${ta.clientHeight}px`;
    canvas.style.pointerEvents = "none";
    const style = window.getComputedStyle(ta);
    const font = `${style.fontSize} ${style.fontFamily}`;
    const paddingLeft = parseFloat(style.paddingLeft || 16);
    const paddingTop = parseFloat(style.paddingTop || 12);
    const lineHeight =
      parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6;

    const ctx = canvas.getContext("2d");
    ctx.font = font;
    ctx.fillStyle = style.color || "#333";

    lineInfosRef.current = layoutLines(
      ctx,
      canvas.width,
      paddingLeft,
      paddingTop,
      lineHeight,
    );

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(animRef.current);
  }, [text]);

  useEffect(() => {
    const handleWave = (e) => {
      const wave = e?.detail?.wave;
      const foam = wave?.foamHeight ?? 60;
      const samples = wave?.samples ?? [];
      if (!samples.length) return;

      const lines = lineInfosRef.current;
      if (!lines.length) return;

      // 波の y を基にターゲットとなる行を決める
      // サンプルから平均 y を取る
      let avgY = samples.reduce((s, v) => s + v.y, 0) / samples.length;

      // find first line whose y is near avgY
      let targetIndex = lines.findIndex(
        (ln) => ln.y >= avgY - 10 && ln.y <= avgY + foam,
      );
      if (targetIndex === -1) {
        // 見つからなければ上の行（0番）をターゲットにする
        targetIndex = 0;
      }

      // 削除する行数は1か2（強度に応じて）
      const intensity = e?.detail?.intensity ?? 0.5;
      const removeLines = Math.random() < 0.5 ? 1 : 2;
      const toRemoveLineIndices = [];

      // 「上の行から」なので targetIndex を上に倒す（上方向へ）
      for (let i = 0; i < removeLines; i++) {
        const idx = Math.max(0, targetIndex - i);
        if (idx < lines.length && !lines[idx].fading)
          toRemoveLineIndices.push(idx);
      }

      if (!toRemoveLineIndices.length) return;

      const removedCharIndices = [];
      const now = performance.now();
      for (const li of toRemoveLineIndices) {
        const line = lines[li];
        line.fading = true;
        const start = now + Math.random() * 120;
        const dur = 700 + Math.random() * 400;
        const step = () => {
          const t = (performance.now() - start) / dur;
          line.opacity = Math.max(0, 1 - t);
          if (line.opacity <= 0) {
            // mark for deletion
            for (let k = 0; k < line.length; k++)
              removedCharIndices.push(line.startIndex + k);
          } else {
            requestAnimationFrame(step);
          }
        };
        requestAnimationFrame(step);
      }

      // 実際の文字削除はアニメが終わる頃に実行
      setTimeout(() => {
        if (removedCharIndices.length) {
          onDelete && onDelete(removedCharIndices.sort((a, b) => b - a));
        }
      }, 900);
    };

    window.addEventListener("wave-pass", handleWave);
    return () => window.removeEventListener("wave-pass", handleWave);
  }, [onDelete]);

  return (
    <canvas ref={canvasRef} style={{ position: "absolute", left: 0, top: 0 }} />
  );
}
