import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wave Memo プライバシーポリシー / Privacy Policy",
  description: "Wave Memo のプライバシーポリシー / Privacy policy for Wave Memo",
};

const EMAIL = "mosbotfa@gmail.com";
const UPDATED = "2026-11-07";

const box = "rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur";

const rows: [string, string, string][] = [
  ["データ収集 / Data collection", "いいえ", "No"],
  ["トラッキング / Tracking", "なし", "None"],
  ["アカウント登録 / Account", "不要", "Not required"],
  ["メモの外部送信 / Memo sent externally", "なし", "None"],
  ["メモのサーバー保存 / Memo stored on a server", "なし", "None"],
];

export default function Privacy() {
  return (
    <div className="fixed inset-0 overflow-y-auto text-[#3b2f4a]">
      <main className="mx-auto max-w-2xl space-y-6 px-5 py-10">
        <header className="text-center">
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "SnellRoundhand, cursive" }}>
            Wave Memo
          </h1>
          <p className="mt-1 text-sm opacity-80">プライバシーポリシー / Privacy Policy</p>
        </header>

        <section className={box}>
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([k, ja, en]) => (
                <tr key={k} className="border-b border-black/10 last:border-0">
                  <th className="py-2 pr-3 text-left font-medium">{k}</th>
                  <td className="py-2 text-right">{ja} / {en}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className={box}>
          <h2 className="mb-2 font-semibold">日本語</h2>
          <p className="text-sm leading-relaxed">
            Wave Memo(以下「本アプリ」)は、書いた言葉を保存せず、端末の外へ送信することもありません。メモは、波にさらわれるか、アプリを閉じると消え、復元できません。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            本アプリは、氏名・メールアドレス・位置情報などの個人情報を収集しません。アカウント登録は不要です。アクセス解析、広告、トラッキングは使用していません。端末には、時間帯やイラストのセットの設定だけが保存され、外部へ送信されることはありません。
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            本ポリシーを変更する場合は、このページで告知します。ご質問は
            <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>
            までご連絡ください。
          </p>
        </section>

        <section className={box}>
          <h2 className="mb-2 font-semibold">English</h2>
          <p className="text-sm leading-relaxed">
            Wave Memo (the &ldquo;App&rdquo;) does not save what you write and never sends it off your device. Your memo disappears when a wave carries it away or when you close the app, and cannot be restored.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            The App does not collect personal information such as your name, email address or location. No account is required. It uses no analytics, advertising or tracking. Only your time-of-day and illustration-set preferences are stored on the device, and they are never transmitted.
          </p>
          <p className="mt-3 text-sm leading-relaxed">
            If this policy changes, we will announce it on this page. For questions, contact{" "}
            <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </p>
        </section>

        <p className="text-center text-xs opacity-70">
          最終更新 / Last updated: {UPDATED} ・ <a className="underline" href="/support">サポート / Support</a>
        </p>
      </main>
    </div>
  );
}
