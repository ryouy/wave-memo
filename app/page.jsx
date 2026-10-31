"use client";

import { useState } from "react";
import P5Canvas from "./components/P5Canvas";
import WaveMemo from "./components/WaveMemo";
import Controls from "./components/Controls";
import { PALETTES } from "./themes";

export default function Home() {
  const [theme, setTheme] = useState("evening");
  const [art, setArt] = useState("classic"); // classic = 絵画風 / pop = ポップ
  const { ink: [r, g, b], glow } = PALETTES[theme];

  return (
    <main className="stage" style={{ "--ink": `rgb(${r}, ${g}, ${b})`, "--glow": glow }}>
      <P5Canvas theme={theme} art={art} />
      <div className="memo-wrap">
        <WaveMemo />
      </div>
      <Controls theme={theme} onChange={setTheme} art={art} onArtChange={setArt} />
    </main>
  );
}
