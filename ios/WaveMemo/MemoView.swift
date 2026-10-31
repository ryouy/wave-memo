import SwiftUI
import UIKit

/// 画面下に置く入力欄。下端を固定して、行が増えると既存の行が上へせり上がる。
struct MemoView: View {
    @ObservedObject var model: MemoModel
    let theme: Theme
    let screenWidth: CGFloat

    var body: some View {
        let fs = min(33.6, max(17.6, screenWidth * 0.042))
        let w = min(screenWidth * 0.94, fs * 15)
        let ink = color(theme.palette.ink, alpha: 1)
        ZStack(alignment: .top) {
            MemoTextView(model: model, fontSize: fs, ink: theme.palette.ink, glow: theme.palette.glow)
                .frame(width: w)
            if model.text.isEmpty {
                Text("波に想いを綴ってください...")
                    .font(.system(size: fs).italic())
                    .foregroundStyle(ink.opacity(0.55))
                    .lineLimit(1)
                    .minimumScaleFactor(0.5)
                    .padding(.top, fs * 0.3)
                    .frame(width: w)
                    .allowsHitTesting(false)
            }
        }
        .offset(y: model.lift)
    }
}

struct MemoTextView: UIViewRepresentable {
    @ObservedObject var model: MemoModel
    let fontSize: CGFloat
    let ink: RGBA
    let glow: RGBA

    private func uiColor(_ v: RGBA, alpha: Double? = nil) -> UIColor {
        UIColor(red: v.x, green: v.y, blue: v.z, alpha: alpha ?? v.w)
    }

    private func insets() -> UIEdgeInsets {
        UIEdgeInsets(top: fontSize * 0.3, left: fontSize * 0.2, bottom: fontSize * 0.3, right: fontSize * 0.2)
    }

    func makeUIView(context: Context) -> UITextView {
        let tv = UITextView()
        tv.backgroundColor = .clear
        tv.isScrollEnabled = false
        tv.textAlignment = .center
        tv.textContainer.lineFragmentPadding = 0
        tv.textContainer.lineBreakMode = .byCharWrapping // 文字単位で折り返す
        tv.autocorrectionType = .no
        tv.autocapitalizationType = .none
        tv.spellCheckingType = .no
        tv.smartQuotesType = .no
        tv.smartDashesType = .no
        tv.delegate = context.coordinator
        tv.accessibilityLabel = "メモ"
        tv.text = model.text
        model.textView = tv
        return tv
    }

    func updateUIView(_ tv: UITextView, context: Context) {
        let font = UIFont.systemFont(ofSize: fontSize)
        let inkColor = uiColor(ink, alpha: 1)
        let shadow = NSShadow()
        shadow.shadowColor = uiColor(glow)
        shadow.shadowBlurRadius = 8
        shadow.shadowOffset = .zero

        tv.textContainerInset = insets()
        tv.tintColor = inkColor
        tv.font = font
        tv.textColor = inkColor
        tv.typingAttributes = [
            .font: font, .foregroundColor: inkColor, .shadow: shadow,
            .paragraphStyle: centered(),
        ]

        // 波に消された直後など、プログラムから文字が変わったときだけ流し込む
        if tv.text != model.text, tv.markedTextRange == nil {
            tv.text = model.text
        }

        // 文字の見た目だけ更新する（文字や選択範囲には触れない）
        let storage = tv.textStorage
        let full = NSRange(location: 0, length: storage.length)
        storage.beginEditing()
        storage.addAttributes([.font: font, .foregroundColor: inkColor, .shadow: shadow, .paragraphStyle: centered()], range: full)
        let n = min(model.fadeCount, storage.length)
        if n > 0 {
            let alpha = max(0, 1 - model.fadeProgress)
            let range = NSRange(location: 0, length: n)
            storage.addAttribute(.foregroundColor, value: inkColor.withAlphaComponent(alpha), range: range)
            let fadedShadow = NSShadow()
            fadedShadow.shadowColor = uiColor(glow, alpha: glow.w * alpha)
            fadedShadow.shadowBlurRadius = 8
            fadedShadow.shadowOffset = .zero
            storage.addAttribute(.shadow, value: fadedShadow, range: range)
        }
        storage.endEditing()

        if context.coordinator.focusToken != model.focusToken {
            context.coordinator.focusToken = model.focusToken
            DispatchQueue.main.async { tv.becomeFirstResponder() }
        }
        context.coordinator.syncHeight(tv, announce: false)
    }

    private func centered() -> NSMutableParagraphStyle {
        let p = NSMutableParagraphStyle()
        p.alignment = .center
        p.lineBreakMode = .byCharWrapping
        return p
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UITextView, context: Context) -> CGSize? {
        let w = proposal.width ?? 300
        let fit = uiView.sizeThatFits(CGSize(width: w, height: .greatestFiniteMagnitude))
        let minH = UIFont.systemFont(ofSize: fontSize).lineHeight + fontSize * 0.6
        return CGSize(width: w, height: max(ceil(fit.height), ceil(minH)))
    }

    func makeCoordinator() -> Coordinator { Coordinator(model) }

    final class Coordinator: NSObject, UITextViewDelegate {
        let model: MemoModel
        var focusToken = 0
        private var lastHeight: CGFloat = 0

        init(_ model: MemoModel) { self.model = model }

        func measure(_ tv: UITextView) -> CGFloat {
            tv.sizeThatFits(CGSize(width: tv.bounds.width, height: .greatestFiniteMagnitude)).height
        }

        /// 行数が増えた(=高さが増えた)ときは、増えた分だけ既存の行を持ち上げる
        func syncHeight(_ tv: UITextView, announce: Bool) {
            guard tv.bounds.width > 0 else { return }
            let h = measure(tv)
            if announce, lastHeight > 0, h > lastHeight + 1 {
                let d = h - lastHeight
                Task { @MainActor in self.model.bumpLift(d) }
            }
            lastHeight = h
        }

        func textViewDidChange(_ tv: UITextView) {
            model.text = tv.text
            syncHeight(tv, announce: true)
        }

        func textView(_ tv: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
            if text.isEmpty { return true }
            let next = (tv.text as NSString).replacingCharacters(in: range, with: text)
            return (next as NSString).length <= memoMaxLength
        }
    }
}
