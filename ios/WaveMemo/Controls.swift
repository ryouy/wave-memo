import SwiftUI

/// 右上の操作。時間帯の切り替え（朝・昼・夕・晩）と、ポップ/絵画風のトグル。
struct Controls: View {
    @Binding var theme: Theme
    @Binding var art: ArtStyle
    @Namespace private var ns

    var body: some View {
        HStack(spacing: 8) {
            HStack(spacing: 2) {
                ForEach(Theme.allCases) { t in
                    let selected = theme == t
                    Button {
                        Haptics.tap()
                        withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) { theme = t }
                    } label: {
                        Image(systemName: t.symbol)
                            .font(.system(size: 17, weight: .semibold))
                            .frame(width: 40, height: 36)
                            .foregroundStyle(selected ? Color.black.opacity(0.78) : .white)
                            .shadow(color: .black.opacity(selected ? 0 : 0.35), radius: 2, y: 1)
                            .background {
                                if selected {
                                    Capsule().fill(.white.opacity(0.9)).matchedGeometryEffect(id: "sel", in: ns)
                                }
                            }
                    }
                    .accessibilityLabel(t.label)
                    .accessibilityAddTraits(selected ? .isSelected : [])
                }
            }
            .glass()

            let pop = art == .pop
            Button {
                Haptics.tap()
                withAnimation(.easeInOut(duration: 0.25)) { art = pop ? .classic : .pop }
            } label: {
                Image(systemName: "sparkles")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 40, height: 36)
                    .foregroundStyle(pop ? Color.black.opacity(0.78) : .white)
                    .shadow(color: .black.opacity(pop ? 0 : 0.35), radius: 2, y: 1)
                    .background { if pop { Capsule().fill(.white.opacity(0.9)) } }
            }
            .glass()
            .accessibilityLabel("ポップなイラスト")
            .accessibilityAddTraits(pop ? .isSelected : [])
        }
    }
}

private extension View {
    func glass() -> some View {
        padding(3)
            .background(.ultraThinMaterial, in: Capsule())
            .overlay(Capsule().strokeBorder(.white.opacity(0.35), lineWidth: 1))
    }
}

enum Haptics {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
}
