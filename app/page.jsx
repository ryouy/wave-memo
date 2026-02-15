"use client";

import { useState, useEffect, useRef } from "react";
import P5Canvas from "./components/P5Canvas";
import TextOverlay from "./components/TextOverlay";
import "./styles/input.css"; // ✅ CSSをインポート

export default function Home() {
  const [text, setText] = useState("");
  const textRef = useRef("");

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const handleDelete = (indices) => {
    if (!indices || !indices.length) return;
    // indices は元の文字列内のインデックスの配列
    setText((prev) => {
      const arr = prev.split("");
      // 降順で削除してインデックスずれを防ぐ
      indices
        .slice()
        .sort((a, b) => b - a)
        .forEach((i) => {
          if (i >= 0 && i < arr.length) arr.splice(i, 1);
        });
      return arr.join("");
    });
  };

  useEffect(() => {
    const handleWave = (e) => {
      const intensity = e?.detail?.intensity ?? 0.5;
      // 段階的にランダムな文字を削除して「ふわっと消える」を表現
      const performDeletion = () => {
        setText((prev) => {
          if (!prev || prev.length === 0) return prev;
          const len = prev.length;
          // 1回あたり削除する文字数（強度に応じて増減）
          const removeCount = Math.max(1, Math.floor(len * intensity * 0.03));
          const chars = prev.split("");
          for (let i = 0; i < removeCount; i++) {
            if (chars.length === 0) break;
            const idx = Math.floor(Math.random() * chars.length);
            chars.splice(idx, 1);
          }
          return chars.join("");
        });
      };

      // ふわっと削除: 数ステップに分けて実行
      const steps = Math.max(1, Math.floor(3 * intensity));
      for (let i = 0; i < steps; i++) {
        setTimeout(performDeletion, i * 180);
      }
    };

    window.addEventListener("wave-pass", handleWave);
    return () => window.removeEventListener("wave-pass", handleWave);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-gray-800 relative">
      {/* P5Canvasを背景として画面上部に絶対配置 */}

      <P5Canvas />

      {/* mainがjustify-centerなので、このdivが画面の上下中央に来る。
        mt-24 を指定して「中央より少し下」に調整する。
      */}
      <div className="mt-24">
        <div style={{ position: "relative", display: "inline-block" }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="波のそばで、想いを綴ってください..."
            className="textarea-clean"
            style={{ position: "relative", zIndex: 1 }}
          />
          <div style={{ position: "absolute", left: 0, top: 0, zIndex: 2 }}>
            <TextOverlay text={text} onDelete={handleDelete} />
          </div>
        </div>
      </div>
    </main>
  );
}
