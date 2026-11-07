import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wave Memo サポート / Support",
  description: "Wave Memo のサポートとプライバシーポリシー / Support and privacy policy for Wave Memo",
};

const ISSUES = "https://github.com/ryouy/wave-memo/issues";
const EMAIL = "mosbotfa@gmail.com";

const box = "rounded-2xl bg-white/80 p-5 shadow-sm backdrop-blur";

export default function Support() {
  return (
    <div className="fixed inset-0 overflow-y-auto text-[#3b2f4a]">
      <main className="mx-auto max-w-2xl space-y-6 px-5 py-10">
        <header className="text-center">
          <h1 className="text-3xl font-semibold" style={{ fontFamily: "SnellRoundhand, cursive" }}>
            Wave Memo
          </h1>
          <p className="mt-1 text-sm opacity-80">サポート / Support</p>
        </header>

        <section className={box}>
          <h2 className="mb-2 font-semibold">お問い合わせ</h2>
          <p className="text-sm leading-relaxed">
            不具合のご報告やご質問は、GitHub の
            <a className="underline" href={ISSUES}>Issues</a>
            、またはメール(<a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>)からお寄せください。
          </p>
          <h2 className="mb-2 mt-5 font-semibold">Contact</h2>
          <p className="text-sm leading-relaxed">
            For bug reports and questions, please open an issue on{" "}
            <a className="underline" href={ISSUES}>GitHub</a>, or email{" "}
            <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </p>
        </section>

        <section className={box}>
          <h2 className="mb-2 font-semibold">よくある質問</h2>
          <dl className="space-y-3 text-sm leading-relaxed">
            <div>
              <dt className="font-medium">書いた言葉を残せますか?</dt>
              <dd>保存・履歴・元に戻す機能はありません。残したい言葉は、スクリーンショットで残してください。</dd>
            </div>
            <div>
              <dt className="font-medium">言葉が消えてしまいました。</dt>
              <dd>仕様です。波にさらわれるか、アプリを閉じると消えます。復元はできません。</dd>
            </div>
          </dl>
          <h2 className="mb-2 mt-5 font-semibold">FAQ</h2>
          <dl className="space-y-3 text-sm leading-relaxed">
            <div>
              <dt className="font-medium">Can I keep what I write?</dt>
              <dd>No. There is no save, history or undo. Take a screenshot of words you want to keep.</dd>
            </div>
            <div>
              <dt className="font-medium">My words disappeared.</dt>
              <dd>That is by design. Words are carried away by the waves or vanish when you close the app, and cannot be restored.</dd>
            </div>
          </dl>
        </section>

        <p className="text-center text-sm">
          <a className="underline" href="/privacy">プライバシーポリシー / Privacy Policy</a>
        </p>
      </main>
    </div>
  );
}
