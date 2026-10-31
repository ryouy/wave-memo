"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const FADE_MS = 1800;
const LIFT_MS = 900;

// ミラー要素内の各「見た目の行」が何文字かを数える（textarea と同一スタイルなので折返しが一致する）
function measureLines(mirror) {
  const lines = [];
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let current = null;
  let top = 0;
  let forceNew = true;
  let node;
  while ((node = walker.nextNode())) {
    const value = node.nodeValue;
    for (let i = 0; i < value.length; i++) {
      const ch = value[i];
      if (ch === "​") continue; // 末尾のダミー文字
      if (ch !== "\n") {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        if (rect && !forceNew && rect.top > top + rect.height / 2) {
          forceNew = true;
        }
        if (rect && forceNew) top = rect.top;
      }
      if (forceNew || !current) {
        current = { length: 0, blank: true, top };
        lines.push(current);
        forceNew = false;
      }
      current.length += 1;
      if (ch.trim() !== "") current.blank = false;
      if (ch === "\n") forceNew = true;
    }
  }
  return lines;
}

export default function WaveMemo() {
  const [text, setText] = useState("");
  const [fading, setFading] = useState(0); // 先頭から何文字がフェード中か
  const [lift, setLift] = useState({ y: 0, animate: false });
  const mirrorRef = useRef(null);
  const fadingRef = useRef(0);
  const textRef = useRef("");

  useEffect(() => {
    textRef.current = text;
  }, [text]);

  // 下端を固定して行が増えるので、増えた分だけ既存の行を「持ち上げる」アニメーションにする
  const prevHeightRef = useRef(0);
  useLayoutEffect(() => {
    const h = mirrorRef.current?.offsetHeight ?? 0;
    const prev = prevHeightRef.current;
    prevHeightRef.current = h;
    if (prev > 0 && h > prev + 1) {
      setLift({ y: h - prev, animate: false });
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setLift({ y: 0, animate: true })),
      );
    }
  }, [text]);

  useEffect(() => {
    const onWave = (e) => {
      if (fadingRef.current > 0 || !textRef.current) return;
      const mirror = mirrorRef.current;
      if (!mirror) return;

      // 波先(reachY)より上にある行を、上から順にさらう
      const reachY = e?.detail?.reachY ?? 0;
      const all = measureLines(mirror);
      const lines = [];
      for (const l of all) {
        if (l.top >= reachY) break;
        lines.push(l);
      }
      const count = lines.reduce((s, l) => s + l.length, 0);
      if (!count) return;

      // 空白だけの行はアニメーションせずに即座に消す
      if (lines.every((l) => l.blank)) {
        setText((prev) => prev.slice(count));
        return;
      }

      fadingRef.current = count;
      setFading(count);
      setTimeout(() => {
        setText((prev) => prev.slice(count));
        fadingRef.current = 0;
        setFading(0);
      }, FADE_MS);
    };

    window.addEventListener("wave-pass", onWave);
    return () => window.removeEventListener("wave-pass", onWave);
  }, []);

  const fadeCount = Math.min(fading, text.length);

  return (
    <div
      className="memo"
      style={{
        transform: `translateY(${lift.y}px)`,
        transition: lift.animate ? `transform ${LIFT_MS}ms ease-out` : "none",
      }}
    >
      <div ref={mirrorRef} className="memo-text memo-mirror" aria-hidden="true">
        {fadeCount > 0 && (
          <span className="memo-fade">{text.slice(0, fadeCount)}</span>
        )}
        {text.slice(fadeCount)}
        {"​"}
      </div>
      <textarea
        className="memo-text memo-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="波に想いを綴ってください..."
        aria-label="メモ"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        maxLength={45}
        autoFocus
      />
    </div>
  );
}
