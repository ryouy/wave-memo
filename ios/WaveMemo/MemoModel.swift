import SwiftUI
import UIKit

let memoMaxLength = 45
private let fadeDuration = 1.8
private let liftDuration = 0.9

/// メモの文字と、波にさらわれる行のアニメーションを持つ。
@MainActor
final class MemoModel: ObservableObject {
    @Published var text = ""
    /// 先頭から何文字(UTF-16)が、波にさらわれて薄くなっているか
    @Published var fadeCount = 0
    @Published var fadeProgress = 0.0
    /// 行が増えたとき、既存の行が下から「持ち上がる」ためのオフセット
    @Published var lift: CGFloat = 0
    @Published var focusToken = 0

    weak var textView: UITextView?
    /// 「言葉を海へ」で飛ばす言葉（行ごと）・出発点（画面座標）・文字サイズを、景色に渡す
    var onSendWords: (([String], CGPoint, CGFloat) -> Void)?
    private var fading = false
    /// 送信などで途中の「さらう」を取り消すための世代番号（古いタイマーが、新しく書いた文字を消さないように）
    private var fadeToken = 0

    init() {
        #if DEBUG
        // 動作確認用: -demoText "..." で初期テキストを渡せる
        if let demo = UserDefaults.standard.string(forKey: "demoText") { text = demo }
        #endif
    }

    func requestFocus() { focusToken += 1 }

    /// 行が増えたぶんだけ、既存の行を一度下へずらして、ゆっくり元の位置へ持ち上げる。
    func bumpLift(_ d: CGFloat) {
        lift = d
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 30_000_000)
            withAnimation(.easeOut(duration: liftDuration)) { self.lift = 0 }
        }
    }

    var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

    /// 入力欄の言葉を、水平線の近くへ飛ばして、入力欄をきれいにする。
    func sendToSea() {
        guard canSend, let tv = textView else { return }
        tv.unmarkText()
        let ns = tv.text as NSString
        var lines: [String] = []
        let lm = tv.layoutManager
        let glyphs = lm.numberOfGlyphs
        if glyphs > 0 {
            lm.enumerateLineFragments(forGlyphRange: NSRange(location: 0, length: glyphs)) { _, _, _, glyphRange, _ in
                let cr = lm.characterRange(forGlyphRange: glyphRange, actualGlyphRange: nil)
                lines.append(ns.substring(with: cr).replacingOccurrences(of: "\n", with: ""))
            }
        }
        while let last = lines.last, last.trimmingCharacters(in: .whitespaces).isEmpty { lines.removeLast() }
        while let first = lines.first, first.trimmingCharacters(in: .whitespaces).isEmpty { lines.removeFirst() }
        let frame = tv.convert(tv.bounds, to: nil)
        let center = CGPoint(x: frame.midX, y: frame.midY)
        let fs = tv.font?.pointSize ?? 24
        onSendWords?(Array(lines.prefix(8)), center, fs)

        tv.textStorage.replaceCharacters(in: NSRange(location: 0, length: ns.length), with: "")
        text = ""
        fadeToken += 1
        fadeCount = 0
        fadeProgress = 0
        fading = false
    }

    /// 波先(reachY)より上にある行を、上から順にさらう。
    func sweep(reachY: CGFloat) {
        guard !fading, !text.isEmpty, let tv = textView else { return }
        let lm = tv.layoutManager
        let glyphs = lm.numberOfGlyphs
        guard glyphs > 0 else { return }
        var count = 0
        lm.enumerateLineFragments(forGlyphRange: NSRange(location: 0, length: glyphs)) { rect, _, _, glyphRange, stop in
            let top = tv.convert(CGPoint(x: 0, y: rect.minY + tv.textContainerInset.top), to: nil).y
            if top >= reachY {
                stop.pointee = true
                return
            }
            count += lm.characterRange(forGlyphRange: glyphRange, actualGlyphRange: nil).length
        }
        let ns = text as NSString
        count = min(count, ns.length)
        guard count > 0 else { return }

        // 空白だけの行は、アニメーションせずに即座に消す
        if ns.substring(to: count).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            text = ns.substring(from: count)
            return
        }

        fading = true
        fadeToken += 1
        let token = fadeToken
        fadeCount = count
        fadeProgress = 0
        let start = Date()
        Timer.scheduledTimer(withTimeInterval: 1.0 / 60, repeats: true) { [weak self] timer in
            MainActor.assumeIsolated {
                guard let self, token == self.fadeToken else { timer.invalidate(); return }
                let p = min(1, Date().timeIntervalSince(start) / fadeDuration)
                self.fadeProgress = p
                if p >= 1 {
                    timer.invalidate()
                    self.finishFade(count, token: token)
                }
            }
        }
    }

    /// 薄くなった行を実際に消す。日本語入力の変換中(markedText)は文字を差し替えられないので、確定するまで待つ。
    /// （待たずに model.text だけ書き換えると、確定時に古い文字が戻ってしまう）
    private func finishFade(_ count: Int, token: Int) {
        guard token == fadeToken else { return }
        guard let tv = textView else {
            let ns = text as NSString
            text = ns.substring(from: min(count, ns.length))
            endFade()
            return
        }
        if tv.markedTextRange != nil {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in self?.finishFade(count, token: token) }
            return
        }
        let n = min(count, (tv.text as NSString).length)
        let selected = tv.selectedRange
        tv.textStorage.replaceCharacters(in: NSRange(location: 0, length: n), with: "")
        tv.selectedRange = NSRange(location: max(0, selected.location - n), length: selected.length)
        text = tv.text
        endFade()
    }

    private func endFade() {
        fadeCount = 0
        fadeProgress = 0
        fading = false
    }
}
