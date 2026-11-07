import SwiftUI

/// 起動時のスプラッシュ。夕焼けの背景に、少し波のようにゆれる「Wave Memo」。
/// LaunchScreen は同じ背景だけを出して、ここで文字が現れる。つなぎ目なく始まって、ふわっと消える。
struct SplashView: View {
    private let letters = Array("Wave Memo")
    @State private var appeared = false

    var body: some View {
        GeometryReader { geo in
            ZStack {
                Image("splash")
                    .resizable()
                    .scaledToFill()
                    .frame(width: geo.size.width, height: geo.size.height)
                    .clipped()

                TimelineView(.animation) { timeline in
                    let t = timeline.date.timeIntervalSinceReferenceDate
                    let size = min(geo.size.width * 0.095, 64)
                    HStack(spacing: size * 0.14) {
                        ForEach(Array(letters.enumerated()), id: \.offset) { i, ch in
                            Text(ch == " " ? "\u{00A0}" : String(ch))
                                .font(.system(size: size, weight: .medium))
                                .offset(y: CGFloat(sin(t * 2.4 + Double(i) * 0.55)) * size * 0.12)
                        }
                    }
                    .foregroundStyle(Color(red: 1, green: 0.965, blue: 0.925))
                    .shadow(color: Color(red: 1, green: 0.75, blue: 0.58).opacity(0.5), radius: 12)
                    .position(x: geo.size.width / 2, y: geo.size.height * 0.322)
                    .opacity(appeared ? 1 : 0)
                }

                Text(L("波のメモ帳", "Text should not always remain."))
                    .font(.system(size: min(geo.size.width * 0.036, 16)))
                    .tracking(1.6)
                    .foregroundStyle(Color(red: 1, green: 0.965, blue: 0.925).opacity(0.9))
                    .shadow(color: Color(red: 1, green: 0.75, blue: 0.58).opacity(0.5), radius: 8)
                    .position(x: geo.size.width / 2, y: geo.size.height * 0.322 + min(geo.size.width * 0.095, 64) * 0.95)
                    .opacity(appeared ? 1 : 0)
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .onAppear { withAnimation(.easeOut(duration: 0.9)) { appeared = true } }
    }
}
