import SwiftUI

/// アプリの使いかたのガイド。
struct GuideView: View {
    @Environment(\.dismiss) private var dismiss

    private let sections: [(String, String)] = isJapanese ? [
        ("残らないメモ", "ここに書いた言葉は、保存されません。端末の外へ送られることもありません。波にさらわれるか、アプリを閉じれば、消えます。残したい言葉があるなら、スクリーンショットで、自分の意思で残してください。"),
        ("書く", "画面下の砂浜に、言葉を書きます（45文字まで）。画面のどこかをタップすると書き始められて、もう一度タップするとキーボードがしまわれます。"),
        ("波がさらう", "ふだんの波は、水平線の近くで静かに寄せては返します。ときどき大きな波が砂浜まで下りてきて、上の行から言葉をさらっていきます。どこまで届くかは、そのときしだいです。"),
        ("言葉を海へ", "入力欄に言葉があるときは、水平線の下に「言葉を海へ」のボタンが出ます。押すと、言葉が入力欄を離れて、水平線のほうへ飛んでいき、波に乗って流れていきます。入力欄はきれいになります。"),
        ("朝・昼・夕・晩", "メニューから、時間帯を選べます。夜になるときは、太陽が沈んで、月が昇ります。"),
        ("イラストのセット", "船やカモメ、カニなどのイラストの雰囲気を、メニューの4つのサムネイルから選べます。ヴィンテージ風、カラフルなポップ、絵画風、輪郭つきのポップです。"),
    ] : [
        ("A memo that doesn't stay", "Words you write here are never saved, and never leave your device. A wave will carry them away, or they vanish when you close the app. If there are words you want to keep, keep them yourself with a screenshot."),
        ("Write", "Write on the beach at the bottom of the screen (up to 45 characters). Tap anywhere to start writing, and tap again to put the keyboard away."),
        ("The waves take them", "Usually the waves roll in and out quietly near the horizon. Now and then a big wave comes down to the beach and sweeps away your words, starting from the top line. How far it reaches is up to chance."),
        ("Send to the sea", "When there are words in the field, a \"Send to the sea\" button appears below the horizon. Tap it, and your words leave the field, fly toward the horizon, and drift away on the waves. The field is left clean."),
        ("Morning, day, evening, night", "Choose a time of day from the menu. When night falls, the sun sets and the moon rises."),
        ("Illustration sets", "Pick the mood of the boats, gulls, crabs and more from the four thumbnails in the menu: vintage, colorful pop, painted, and outlined pop."),
    ]

    var body: some View {
        ZStack(alignment: .topTrailing) {
            LinearGradient(
                colors: [
                    Color(red: 0.13, green: 0.08, blue: 0.35),
                    Color(red: 0.44, green: 0.20, blue: 0.49),
                    Color(red: 0.81, green: 0.39, blue: 0.35),
                ],
                startPoint: .top, endPoint: .bottom
            )
            .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    Text("GUIDE")
                        .font(.system(size: 11, weight: .medium))
                        .tracking(5)
                        .foregroundStyle(.white.opacity(0.7))
                    Text("Wave Memo")
                        .font(.custom("SnellRoundhand", size: 54))
                        .foregroundStyle(Color(red: 1, green: 0.96, blue: 0.93))
                        .shadow(color: Color(red: 1, green: 0.75, blue: 0.58).opacity(0.5), radius: 10)
                        .padding(.top, 2)
                    Text(isJapanese ? "Text should not always remain.\n言葉は、波に消える。" : "Text should not always remain.")
                        .font(.system(size: 14))
                        .tracking(1.4)
                        .lineSpacing(5)
                        .foregroundStyle(.white.opacity(0.88))
                        .padding(.top, 4)
                        .padding(.bottom, 22)

                    ForEach(sections, id: \.0) { sec in
                        Divider().overlay(.white.opacity(0.18))
                        VStack(alignment: .leading, spacing: 6) {
                            Text(sec.0).font(.system(size: 16, weight: .semibold)).tracking(1)
                            Text(sec.1).font(.system(size: 14.5)).lineSpacing(6).opacity(0.92)
                        }
                        .foregroundStyle(Color(red: 1, green: 0.96, blue: 0.93))
                        .padding(.vertical, 14)
                    }
                }
                .padding(.horizontal, 26)
                .padding(.top, 44)
                .padding(.bottom, 30)
            }

            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(.white.opacity(0.16), in: Circle())
            }
            .padding(14)
            .accessibilityLabel(L("閉じる", "Close"))
        }
    }
}
