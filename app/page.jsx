"use client";

import { useEffect, useState } from "react";
import { THEME_ORDER } from "./themes";
import P5Canvas from "./components/P5Canvas";
import WaveMemo from "./components/WaveMemo";
import Controls from "./components/Controls";

export default function Home() {
  const [theme, setTheme] = useState("evening");
  const [art, setArt] = useState("classic"); // classic = 絵画風 / pop = ポップ
  const [auto, setAuto] = useState(false); // 時間帯を、朝→昼→夕→晩の順に自動で切り替える
  useEffect(() => {
    if (!auto) return;
    const next = () =>
      setTheme((cur) => THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1) % THEME_ORDER.length]);
    const first = setTimeout(next, 2500);
    const timer = setInterval(next, 14000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [auto]);

  // 起動時のスプラッシュ: 夕焼けの背景に「Wave Memo」。少し見せてから、ふわっと消える
  const [splash, setSplash] = useState("show");
  useEffect(() => {
    const t1 = setTimeout(() => setSplash("hide"), 1800);
    const t2 = setTimeout(() => setSplash("gone"), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <main className="stage">
      <P5Canvas theme={theme} art={art} />
      <div className="memo-wrap">
        <WaveMemo />
      </div>
      <Controls
        theme={theme}
        onChange={(t) => {
          setAuto(false);
          setTheme(t);
        }}
        auto={auto}
        onAutoChange={setAuto}
        art={art}
        onArtChange={setArt}
      />
      {splash !== "gone" && (
        <div className={`splash${splash === "hide" ? " is-hiding" : ""}`} aria-hidden="true">
          <h1 className="splash-title">
            {"Wave Memo".split("").map((ch, i) => (
              <span key={i} style={{ animationDelay: `${i * 0.13}s` }}>
                {ch === " " ? "\u00a0" : ch}
              </span>
            ))}
          </h1>
        </div>
      )}
    </main>
  );
}
