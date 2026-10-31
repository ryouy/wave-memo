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
            // 縦長のスマホは、入力欄を高め(下から30%)に置く。キーボードが出ると景色ごと縮むので、岩やカニも一緒に上がる
            let memoBottom: CGFloat = fullHeight / max(1, fullWidth) >= 1.6 ? 0.30 : 0.12
            ZStack(alignment: .top) {
                SeaSceneView(sim: sim, theme: theme.wrappedValue, art: art.wrappedValue)
                    .frame(width: fullWidth, height: sceneHeight)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                    .ignoresSafeArea()

                // キーボード以外をタップすると、キーボードを収納（出ていなければ入力を開始）。下へ払っても閉じる
                Color.clear
                    .contentShape(Rectangle())
                    .ignoresSafeArea()
                    .onTapGesture {
                        // キーボードが出ているときは収納、出ていないときは入力を始める
                        if keyboard.height > 0 { UIApplication.shared.endEditing() } else { memo.requestFocus() }
                    }
                    .gesture(
                        DragGesture(minimumDistance: 24).onEnded { v in
                            if v.translation.height > 40 { UIApplication.shared.endEditing() }
                        })

                // 入力欄は見える範囲(キーボードの上)の下から30%/12%。画面全体を基準に置く
                VStack {
                    Spacer()
                    MemoView(model: memo, theme: theme.wrappedValue, screenWidth: fullWidth)
                        .padding(.bottom, kb + sceneHeight * memoBottom)
                }
                .frame(width: fullWidth)
                .frame(maxHeight: .infinity)
                .ignoresSafeArea()

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
