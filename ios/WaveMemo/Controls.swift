import SwiftUI

/// 右上のボタン類は、ひとつのメニューにまとめる（時間帯・ポップ・ガイド）。
struct Controls: View {
    @Binding var theme: Theme
    @Binding var art: ArtStyle
    @Binding var auto: Bool
    @Binding var open: Bool
    var onGuide: () -> Void
    @Namespace private var ns

    var body: some View {
        VStack(alignment: .trailing, spacing: 8) {
            Button {
                Haptics.tap()
                withAnimation(.spring(response: 0.35, dampingFraction: 0.85)) { open.toggle() }
            } label: {
                Image(systemName: open ? "xmark" : "line.3.horizontal")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .shadow(color: .black.opacity(0.35), radius: 2, y: 1)
                    .frame(width: 44, height: 44)
                    .background(.ultraThinMaterial, in: Circle())
                    .overlay(Circle().strokeBorder(.white.opacity(0.35), lineWidth: 1))
            }
            .accessibilityLabel("メニュー")

            if open {
                panel
                    .transition(.scale(scale: 0.96, anchor: .topTrailing).combined(with: .opacity))
            }
        }
    }

    private let panelWidth: CGFloat = 5 * 46 + 4 * 4 + 16 // アイコン5つぶん。余白を作らない
    private let panelFill = Color(red: 0.10, green: 0.08, blue: 0.19).opacity(0.62)

    private var themeRow: some View {
        HStack(spacing: 4) {
            ForEach(Theme.allCases) { t in
                iconButton(t.symbol, selected: theme == t, label: t.label, group: "theme") {
                    auto = false
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { theme = t }
                }
            }
            iconButton("arrow.triangle.2.circlepath", selected: auto, label: "時間帯を順に切り替える", group: "auto") {
                auto.toggle()
            }
        }
    }

    /// イラストのセットの切り替え（サムネイルは、どれも船の絵）
    private var setRow: some View {
        HStack(spacing: 4) {
            ForEach(ArtStyle.allCases) { a in
                let selected = art == a
                Button {
                    Haptics.tap()
                    withAnimation(.easeInOut(duration: 0.25)) { art = a }
                } label: {
                    Image(a.asset("fishing-boat"))
                        .resizable()
                        .scaledToFit()
                        .padding(7)
                        .frame(maxWidth: .infinity, minHeight: 46, maxHeight: 46)
                        .background(selected ? Color.white.opacity(0.88) : Color.white.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
                        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(selected ? Color.white : .clear, lineWidth: 2))
                }
                .accessibilityLabel(a.label)
                .accessibilityAddTraits(selected ? .isSelected : [])
            }
        }
    }

    private var actionRow: some View {
        HStack(spacing: 4) {
            Link(destination: URL(string: "https://github.com/ryouy/wave-memo")!) {
                Image(systemName: "chevron.left.forwardslash.chevron.right")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 42, maxHeight: 42)
                    .foregroundStyle(.white)
            }
            .accessibilityLabel("GitHub")
            iconButton("questionmark.circle", selected: false, label: "ガイド", group: "guide") { onGuide() }
        }
    }

    private var panel: some View {
        let shape = RoundedRectangle(cornerRadius: 20)
        return VStack(spacing: 6) {
            themeRow
            Rectangle().fill(.white.opacity(0.16)).frame(height: 1)
            setRow
            Rectangle().fill(.white.opacity(0.16)).frame(height: 1)
            actionRow
        }
        .padding(8)
        .frame(width: panelWidth)
        .background(panelFill, in: shape)
        .background(.ultraThinMaterial, in: shape)
        .overlay(shape.strokeBorder(.white.opacity(0.22), lineWidth: 1))
        .shadow(color: .black.opacity(0.25), radius: 16, y: 8)
    }

    /// テキストなしのアイコンボタン（読み上げ用の名前だけ付ける）
    private func iconButton(_ symbol: String, selected: Bool, label: String, group: String, action: @escaping () -> Void) -> some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            Image(systemName: symbol)
                .font(.system(size: 18, weight: .semibold))
                .frame(maxWidth: .infinity, minHeight: 42, maxHeight: 42)
                .foregroundStyle(selected ? Color(red: 0.17, green: 0.14, blue: 0.25) : .white)
                .background {
                    if selected {
                        RoundedRectangle(cornerRadius: 14).fill(.white.opacity(0.9)).matchedGeometryEffect(id: "sel-\(group)", in: ns)
                    }
                }
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

enum Haptics {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
