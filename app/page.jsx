"use client";

import { useState, useEffect, useRef } from "react";
import P5Canvas from "./components/P5Canvas";
import TextOverlay from "./components/TextOverlay";
import "./styles/input.css"; // ✅ CSSをインポート

function LeftRock() {
  const [showImg, setShowImg] = useState(true);
  return (
    <div
      style={{
        position: "absolute",
        left: -140,
        top: "15%",
        zIndex: 0,
        pointerEvents: "none",
        transform: "rotate(-6deg)",
      }}
    >
      {showImg ? (
        <img
          src="/rock-left.svg"
          alt="rock left"
          width={240}
          height={240}
          onError={() => setShowImg(false)}
        />
      ) : (
        <svg
          width="240"
          height="240"
          viewBox="0 0 300 300"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="gL" x1="0" x2="1">
              <stop offset="0%" stopColor="#8f6f52" />
              <stop offset="100%" stopColor="#c6a882" />
            </linearGradient>
            <filter id="s1" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="2"
                dy="6"
                stdDeviation="10"
                floodColor="#000"
                floodOpacity="0.25"
              />
            </filter>
          </defs>
          <path
            filter="url(#s1)"
            d="M20 240 C60 140 140 120 180 160 C220 200 260 180 280 140 L280 260 L20 260 Z"
            fill="url(#gL)"
          />
        </svg>
      )}
    </div>
  );
}

function RightRock() {
  const [showImg, setShowImg] = useState(true);
  return (
    <div
      style={{
        position: "absolute",
        right: -140,
        top: "15%",
        zIndex: 0,
        pointerEvents: "none",
        transform: "rotate(6deg)",
      }}
    >
      {showImg ? (
        <img
          src="/rock-right.svg"
          alt="rock right"
          width={240}
          height={240}
          onError={() => setShowImg(false)}
        />
      ) : (
        <svg
          width="240"
          height="240"
          viewBox="0 0 300 300"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="gR" x1="0" x2="1">
              <stop offset="0%" stopColor="#7f5f43" />
              <stop offset="100%" stopColor="#b89266" />
            </linearGradient>
            <filter id="s2" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="-2"
                dy="6"
                stdDeviation="10"
                floodColor="#000"
                floodOpacity="0.25"
              />
            </filter>
          </defs>
          <path
            filter="url(#s2)"
            d="M280 240 C240 140 160 120 120 160 C80 200 40 180 20 140 L20 260 L280 260 Z"
            fill="url(#gR)"
          />
        </svg>
      )}
    </div>
  );
}

export default function Home() {
  const [text, setText] = useState("");
  const textRef = useRef("");

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const handleDelete = (indices) => {
    if (!indices) return;
    // プレフィックス削除命令の場合
    if (typeof indices === "object" && indices.removePrefix) {
      const count = indices.count || 0;
      console.log("Removing prefix count:", count);
      setText((prev) => prev.slice(count));
      return;
    }
    if (!Array.isArray(indices) || !indices.length) return;
    // indices は元の文字列内のインデックスの配列
    console.log("Deleting char indices:", indices);
    setText((prev) => {
      const arr = prev.split("");
      // 降順で削除してインデックスずれを防ぐ
      indices
        .slice()
        .sort((a, b) => b - a)
        .forEach((i) => {
          if (i >= 0 && i < arr.length) arr.splice(i, 1);
        });
      console.log("Resulting text:", arr.join(""));
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
      <div className="mt-24 w-full flex justify-center">
        <div style={{ position: "relative", display: "inline-block" }}>
          {/* 左右に岩風オブジェクトを配置（装飾）: 外部画像を優先し、存在しない場合はインラインSVGにフォールバック */}
          <LeftRock />
          <RightRock />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="波のそばで、想いを綴ってください..."
            className="textarea-clean"
            style={{ position: "relative", zIndex: 1 }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 2,
              pointerEvents: "none",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <TextOverlay text={text} onDelete={handleDelete} />
          </div>
        </div>
      </div>
    </main>
  );
}
