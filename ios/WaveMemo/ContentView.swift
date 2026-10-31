import SwiftUI

struct ContentView: View {
    @AppStorage("theme") private var themeRaw = Theme.evening.rawValue
    @AppStorage("art") private var artRaw = ArtStyle.classic.rawValue
    @StateObject private var memo = MemoModel()
    @StateObject private var keyboard = KeyboardObserver()
    @State private var sim = SeaSimulation()

    private var theme: Binding<Theme> {
        Binding(get: { Theme(rawValue: themeRaw) ?? .evening }, set: { themeRaw = $0.rawValue })
    }

    private var art: Binding<ArtStyle> {
        Binding(get: { ArtStyle(rawValue: artRaw) ?? .classic }, set: { artRaw = $0.rawValue })
    }

    var body: some View {
        GeometryReader { geo in
            let insets = geo.safeAreaInsets
            let fullWidth = geo.size.width + insets.leading + insets.trailing
            let fullHeight = geo.size.height + insets.top + insets.bottom
            // キーボードが出たら、景色全体を「キーボードの上の見える範囲」に収める
            let kb = keyboard.height
            let sceneHeight = max(120, fullHeight - kb)
            ZStack(alignment: .top) {
                SeaSceneView(sim: sim, theme: theme.wrappedValue, art: art.wrappedValue)
                    .frame(width: fullWidth, height: sceneHeight)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .ignoresSafeArea()

                // どこをタップしても入力でき、下へ払うとキーボードを閉じる
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .onTapGesture { memo.requestFocus() }
                    .gesture(
                        DragGesture(minimumDistance: 24).onEnded { v in
                            if v.translation.height > 40 { UIApplication.shared.endEditing() }
                        })

                // 入力欄は見える範囲の下から約12%。キーボードが出ても、その上に収まる
                VStack {
                    Spacer()
                    MemoView(model: memo, theme: theme.wrappedValue, screenWidth: fullWidth)
                        .padding(.bottom, max(12, kb + sceneHeight * 0.12 - insets.bottom))
                }
                .frame(width: fullWidth)

                VStack {
                    HStack {
                        Spacer()
                        Controls(theme: theme, art: art)
                    }
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .onAppear {
            sim.onSweep = { reachY in memo.sweep(reachY: reachY) }
            #if DEBUG
            // 動作確認用: -demoFocus YES で、2秒後にキーボードを出す
            if UserDefaults.standard.bool(forKey: "demoFocus") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { memo.requestFocus() }
            }
            // 動作確認用: -demoSweep YES で、6秒後に必ず波が文字に届く
            if UserDefaults.standard.bool(forKey: "demoSweep") {
                DispatchQueue.main.asyncAfter(deadline: .now() + 6) { memo.sweep(reachY: 100_000) }
            }
            #endif
        }
    }
}

/// 毎フレーム、シミュレーションを進めて描く。
struct SeaSceneView: View {
    let sim: SeaSimulation
    let theme: Theme
    let art: ArtStyle

    var body: some View {
        TimelineView(.animation) { timeline in
            Canvas { ctx, size in
                sim.theme = theme
                sim.art = art
                sim.render(&ctx, size: size, now: timeline.date)
            }
        }
    }
}

extension UIApplication {
    func endEditing() {
        sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
    }
}
