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
  const inputRef = useRef(null);
  const fadingRef = useRef(0);
  const textRef = useRef("");
  const composingRef = useRef(false);
  const fadeTokenRef = useRef(0); // 送信で途中のフェードを取り消すための世代番号

  // マウス操作の環境でだけ自動フォーカスする（スマホでは起動直後にキーボードが景色を隠してしまうため）
  useEffect(() => {
    if (window.matchMedia?.("(pointer: fine)").matches) inputRef.current?.focus();
  }, []);

  // タッチ操作: 入力欄とボタン以外をタップすると、キーボードを収納（出ていなければ入力を開始）。
  // タップ直後にブラウザが勝手にフォーカスを外すので、押した時点の状態を覚えておいて click で切り替える
  useEffect(() => {
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    if (!coarse) return;
    let wasFocused = false;
    const onDown = () => {
      wasFocused = document.activeElement === inputRef.current;
    };
    const onClick = (e) => {
      if (e.target.closest?.(".memo, .top-controls, .send-btn, .guide")) return;
      const ta = inputRef.current;
      if (!ta) return;
      if (wasFocused) ta.blur();
      else ta.focus();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("click", onClick);
    };
  }, []);

  // スマホのキーボードが出たら、景色全体を「キーボードの上の見える範囲」に収める。
  // 画面の高さ(--app-h)と上端(--vv-top)を、見えている領域(visualViewport)に合わせる
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const sync = () => {
      root.style.setProperty("--app-h", `${Math.round(vv.height)}px`);
      root.style.setProperty("--vv-top", `${Math.round(vv.offsetTop)}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      root.style.removeProperty("--app-h");
      root.style.removeProperty("--vv-top");
    };
  }, []);

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

  // 「言葉を海へ」: 入力欄の言葉を、水平線の近くへ飛ばして、入力欄をきれいにする
  const sendToSea = () => {
    const mirror = mirrorRef.current;
    const value = textRef.current;
    if (!mirror || !value.trim()) return;
    const lines = [];
    let pos = 0;
    for (const l of measureLines(mirror)) {
      lines.push(value.slice(pos, pos + l.length).replace(/\n/g, ""));
      pos += l.length;
    }
    while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
    while (lines.length && !lines[0].trim()) lines.shift();
    const rect = mirror.getBoundingClientRect();
    window.dispatchEvent(
      new CustomEvent("send-words", {
        detail: {
          lines: lines.slice(0, 8),
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2,
          fs: parseFloat(getComputedStyle(mirror).fontSize) || 24,
        },
      }),
    );
    fadeTokenRef.current += 1;
    fadingRef.current = 0;
    setFading(0);
    setText("");
    inputRef.current?.focus();
  };

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
      const token = ++fadeTokenRef.current;
      // 日本語入力の変換中に value を差し替えると変換が壊れる/古い文字が戻るので、確定するまで待つ
      const finish = () => {
        if (token !== fadeTokenRef.current) return; // 送信などで取り消された
        if (composingRef.current) {
          setTimeout(finish, 100);
          return;
        }
        setText((prev) => prev.slice(count));
        fadingRef.current = 0;
        setFading(0);
      };
      setTimeout(finish, FADE_MS);
    };

    window.addEventListener("wave-pass", onWave);
    return () => window.removeEventListener("wave-pass", onWave);
  }, []);

  const fadeCount = Math.min(fading, text.length);

  return (
    <>
      <button
        type="button"
        className={`send-btn${text.trim() ? " is-on" : ""}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={sendToSea}
        tabIndex={text.trim() ? 0 : -1}
        aria-hidden={!text.trim()}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 3L3 10.5l7 2.5 2.5 7L21 3z" />
          <path d="M10 13l11-10" />
        </svg>
        言葉を海へ
      </button>
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
          onCompositionStart={() => (composingRef.current = true)}
          onCompositionEnd={() => (composingRef.current = false)}
          placeholder="波に想いを綴ってください..."
          aria-label="メモ"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          maxLength={45}
          ref={inputRef}
        />
      </div>
    </>
  );
}
