"use client";

import { useEffect, useState } from "react";
import { PALETTES, THEME_ORDER } from "../themes";

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

export default function Controls({ theme, onChange, art, onArtChange }) {
  const [supported, setSupported] = useState(false);
  const [full, setFull] = useState(false);

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

  const toggleFull = () => {
    const el = document.documentElement;
    if (full) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      Promise.resolve((el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)).catch(() => {});
    }
  };

  return (
    <div className="top-controls">
      <div className="glass" role="group" aria-label="時間帯">
        {THEME_ORDER.map((key) => (
          <button
            key={key}
            type="button"
            className="icon-btn"
            aria-pressed={theme === key}
            aria-label={TITLES[key]}
            title={TITLES[key]}
            onClick={() => onChange(key)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {ICONS[key]}
            </svg>
          </button>
        ))}
      </div>
      <div className="glass">
        <button
          type="button"
          className="icon-btn"
          aria-pressed={art === "pop"}
          aria-label="ポップなイラストに切り替え"
          title={art === "pop" ? "ポップ（オン）" : "ポップ（オフ）"}
          onClick={() => onArtChange(art === "pop" ? "classic" : "pop")}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
            <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7L19 15z" />
          </svg>
        </button>
      </div>
      {supported && (
        <div className="glass">
          <button
            type="button"
            className="icon-btn"
            aria-label={full ? "全画面を終了" : "全画面"}
            title={full ? "全画面を終了" : "全画面"}
            onClick={toggleFull}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              {full ? (
                <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
              ) : (
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              )}
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
