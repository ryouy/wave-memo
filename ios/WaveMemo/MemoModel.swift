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
    private var fading = false

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
        fadeCount = count
        fadeProgress = 0
        let start = Date()
        Timer.scheduledTimer(withTimeInterval: 1.0 / 60, repeats: true) { [weak self] timer in
            MainActor.assumeIsolated {
                guard let self else { timer.invalidate(); return }
                let p = min(1, Date().timeIntervalSince(start) / fadeDuration)
                self.fadeProgress = p
                if p >= 1 {
                    timer.invalidate()
                    self.finishFade(count)
                }
            }
        }
    }

    private func finishFade(_ count: Int) {
        let ns = text as NSString
        text = ns.substring(from: min(count, ns.length))
        fadeCount = 0
        fadeProgress = 0
        fading = false
    }
}
