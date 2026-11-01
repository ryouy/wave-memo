"use client";

import { useEffect } from "react";

const SECTIONS = [
  {
    title: "残らないメモ",
    body: "ここに書いた言葉は、保存されません。端末の外へ送られることもありません。波にさらわれるか、画面を閉じれば、消えます。残したい言葉があるなら、スクリーンショットで、自分の意思で残してください。",
  },
  {
    title: "書く",
    body: "画面下の砂浜に、言葉を書きます（45文字まで）。スマホでは、入力欄のまわりをタップすると書き始められて、もう一度タップするとキーボードがしまわれます。",
  },
  {
    title: "波がさらう",
    body: "ふだんの波は、水平線の近くで静かに寄せては返します。ときどき大きな波が砂浜まで下りてきて、上の行から言葉をさらっていきます。どこまで届くかは、そのときしだいです。",
  },
  {
    title: "言葉を海へ",
    body: "入力欄に言葉があるときは、水平線の下に「言葉を海へ」のボタンが出ます。押すと、言葉が入力欄を離れて、水平線のほうへ飛んでいき、波に乗って流れていきます。入力欄はきれいになります。",
  },
  {
    title: "朝・昼・夕・晩",
    body: "メニューから、時間帯を選べます。夜になるときは、太陽が沈んで、月が昇ります。",
  },
  {
    title: "ポップ / 絵画風",
    body: "船やカモメ、カニなどのイラストの雰囲気を、ポップなものと、絵画のようなものから選べます。",
  },
];

export default function Guide({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="guide" role="dialog" aria-modal="true" aria-labelledby="guide-title" onClick={onClose}>
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="guide-close" onClick={onClose} aria-label="閉じる">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <p className="guide-eyebrow">GUIDE</p>
        <h2 id="guide-title" className="guide-title">Wave Memo</h2>
        <p className="guide-lead">Text should not always remain.<br />言葉は、波に消える。</p>
        <div className="guide-body">
          {SECTIONS.map((sec) => (
            <section key={sec.title} className="guide-sec">
              <h3>{sec.title}</h3>
              <p>{sec.body}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
