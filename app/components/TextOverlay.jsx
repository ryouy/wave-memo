"use client";

import { useEffect, useRef } from "react";

export default function TextOverlay({ text, onDelete }) {
  const canvasRef = useRef(null);
  const lineInfosRef = useRef([]);
  const animRef = useRef(null);

  // 固定でn文字ごとに折り返す（要求に合わせておおよそ10文字）
  const wrapSize = 10;

  const layoutLines = (_ctx, maxWidth, paddingLeft, paddingTop, lineHeight) => {
    const lines = [];
    const raw = text.replace(/\r/g, "");

    let index = 0;
    while (index < raw.length) {
      // 末尾の改行なら空行として扱う
      if (raw[index] === "\n") {
        lines.push({ startIndex: index, length: 0, text: "", x: paddingLeft, y: paddingTop + (lines.length + 1) * lineHeight, w: 0, opacity: 1, fading: false });
        index += 1;
        continue;
      }

      const chunk = raw.slice(index, index + wrapSize);
      const y = paddingTop + (lines.length + 1) * lineHeight;
      lines.push({ startIndex: index, length: chunk.length, text: chunk, x: paddingLeft, y, w: 0, opacity: 1, fading: false });
      index += chunk.length;
    }

    // テキストが空の場合は一行の空行を用意
    if (lines.length === 0) {
      lines.push({ startIndex: 0, length: 0, text: "", x: paddingLeft, y: paddingTop + lineHeight, w: 0, opacity: 1, fading: false });
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
    // 描画は「フェード中の行」のみ行い、textarea 本体の表示と重複しないようにする
    for (const line of lines) {
      if (!line.fading) continue;
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

    // HiDPI 対応
    const dpr = window.devicePixelRatio || 1;
    const taRect = ta.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(taRect.width * dpr));
    canvas.height = Math.max(1, Math.floor(taRect.height * dpr));
    canvas.style.width = `${taRect.width}px`;
    canvas.style.height = `${taRect.height}px`;
    canvas.style.pointerEvents = "none";
    const style = window.getComputedStyle(ta);
    const font = `${style.fontStyle || ""} ${style.fontWeight || ""} ${style.fontSize} ${style.fontFamily}`.trim();
    const paddingLeft = parseFloat(style.paddingLeft || 16);
    const paddingTop = parseFloat(style.paddingTop || 12);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6;

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.font = font;
    ctx.fillStyle = style.color || "#333";

    lineInfosRef.current = layoutLines(
      ctx,
      taRect.width,
      paddingLeft,
      paddingTop,
      lineHeight,
    );

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      ctx.restore();
    };
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
        const canvas = canvasRef.current;
        const ta = document.querySelector(".textarea-clean");
        if (!canvas || !ta) return;
        const canvasRect = ta.getBoundingClientRect();

        // サンプルの平均Y（ページ座標）
        let avgY = samples.reduce((s, v) => s + v.y, 0) / samples.length;

        // 各行のページ座標Yを計算して、avgY と近い行を探す
        let targetIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          const ln = lines[i];
          // ln.y はキャンバス内の描画Y（ピクセル、CSS単位）なので、要素のtopとスクロールを考慮
          const lineGlobalY = canvasRect.top + ln.y - ta.scrollTop;
          if (lineGlobalY >= avgY - 10 && lineGlobalY <= avgY + foam) {
            targetIndex = i;
            break;
          }
        }
      if (targetIndex === -1) {
        // 見つからなければ上の行（0番）をターゲットにする
        targetIndex = 0;
      }

      // 削除は常に最上行から1〜2行（上から順に消える仕様）
      const intensity = e?.detail?.intensity ?? 0.5;
      const removeLines = intensity > 0.75 ? 2 : 1;
      const toRemoveLineIndices = [];
      for (let i = 0; i < removeLines; i++) {
        const idx = i; // 上から順に
        if (idx < lines.length && !lines[idx].fading) toRemoveLineIndices.push(idx);
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
          // デバッグ: どのインデックスが削除されるか確認
          const asc = removedCharIndices.sort((a, b) => a - b);
          console.log("TextOverlay -> requesting delete indices:", asc);

          // もし先頭からの連続した範囲（プレフィックス）であれば、より確実に
          // 削除できるようにプレフィックス削除命令を送る
          const min = asc[0];
          const max = asc[asc.length - 1];
          const isPrefix = min === 0 && asc.length === max - min + 1;
          if (isPrefix) {
            const count = asc.length;
            console.log("TextOverlay -> requesting removePrefix:", count);
            onDelete && onDelete({ removePrefix: true, count, indices: asc });
          } else {
            onDelete && onDelete(asc.reverse());
          }
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
