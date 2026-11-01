"use client";

import { useEffect, useRef, useState } from "react";
import { PALETTES, THEME_ORDER } from "../themes";
import Guide from "./Guide";

// イラストのセット（サムネイルは、どれも船の絵）。左から、新しい2つ、前の2つ
const ART_ORDER = [
  ["classic", "ヴィンテージ"],
  ["pop", "カラフル"],
  ["painted", "絵画風"],
  ["cartoon", "輪郭つきポップ"],
];

const ICONS = {
  morning: (
    <>
      <path d="M6 15a6 6 0 0 1 12 0" />
      <path d="M3 15h18" />
      <path d="M12 5v2M5.6 8.6l1.4 1.4M18.4 8.6L17 10" />
      <path d="M9 20l3-3 3 3" />
    </>
  ),
  day: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
    </>
  ),
  evening: (
    <>
      <path d="M6 15a6 6 0 0 1 12 0" />
      <path d="M3 15h18" />
      <path d="M12 5v2M5.6 8.6l1.4 1.4M18.4 8.6L17 10" />
      <path d="M9 17l3 3 3-3" />
    </>
  ),
  night: <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
};

const TITLES = { morning: "朝", day: "昼", evening: "夕", night: "晩" };

function Icon({ children }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

/** 右上のボタン類は、ひとつのメニューにまとめる（時間帯・ポップ・全画面・ガイド） */
export default function Controls({ theme, onChange, auto, onAutoChange, art, onArtChange }) {
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const [supported, setSupported] = useState(false);
  const [full, setFull] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    setSupported(!!(document.fullscreenEnabled || document.webkitFullscreenEnabled));
    const sync = () =>
      setFull(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  // メニューの外を押す / Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggleFull = () => {
    const el = document.documentElement;
    if (full) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      Promise.resolve((el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)).catch(() => {});
    }
  };

  return (
    <>
      <div className="top-controls" ref={rootRef}>
        <button
          type="button"
          className="glass icon-btn menu-btn"
          aria-label="メニュー"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon>
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </Icon>
        </button>

        {open && (
          <div className="menu-panel" role="menu">
            <div className="menu-themes">
              {THEME_ORDER.map((key) => (
                <button
                  key={key}
                  type="button"
                  className="menu-btn-i"
                  aria-pressed={theme === key}
                  aria-label={TITLES[key]}
                  title={TITLES[key]}
                  onClick={() => onChange(key)}
                >
                  <Icon>{ICONS[key]}</Icon>
                </button>
              ))}
              <button
                type="button"
                className="menu-btn-i"
                aria-pressed={auto}
                aria-label="時間帯を順に切り替える"
                title="時間帯を順に切り替える"
                onClick={() => onAutoChange(!auto)}
              >
                <Icon>
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <path d="M21 3v5h-5" />
                </Icon>
              </button>
            </div>
            <div className="menu-sets" role="group" aria-label="イラストのセット">
              {ART_ORDER.map(([key, name]) => (
                <button
                  key={key}
                  type="button"
                  className="menu-set"
                  aria-pressed={art === key}
                  aria-label={name}
                  title={name}
                  onClick={() => onArtChange(key)}
                >
                  <img src={`/art/${key}/fishing-boat.webp`} alt="" draggable="false" />
                </button>
              ))}
            </div>
            <div className="menu-actions">
              {supported && (
                <button
                  type="button"
                  className="menu-btn-i"
                  aria-label={full ? "全画面を終了" : "全画面"}
                  title={full ? "全画面を終了" : "全画面"}
                  onClick={toggleFull}
                >
                  <Icon>
                    {full ? (
                      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
                    ) : (
                      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
                    )}
                  </Icon>
                </button>
              )}
              <button
                type="button"
                className="menu-btn-i"
                aria-label="ガイド"
                title="ガイド"
                onClick={() => {
                  setOpen(false);
                  setGuide(true);
                }}
              >
                <Icon>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8" />
                  <path d="M12 17h.01" />
                </Icon>
              </button>
            </div>
          </div>
        )}
      </div>
      {guide && <Guide onClose={() => setGuide(false)} />}
    </>
  );
}
