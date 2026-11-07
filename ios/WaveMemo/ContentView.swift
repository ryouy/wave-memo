import SwiftUI

struct ContentView: View {
    @AppStorage("theme") private var themeRaw = Theme.evening.rawValue
    @AppStorage("art") private var artRaw = ArtStyle.classic.rawValue
    @StateObject private var memo = MemoModel()
    @StateObject private var keyboard = KeyboardObserver()
    @State private var menuOpen = false
    @State private var autoCycle = false // 時間帯を、朝→昼→夕→晩の順に自動で切り替える
    @State private var showGuide = false
    @State private var splashVisible = true
    @State private var liveInk: RGBA? // いまの空の明るさに合わせた文字色（夕→朝の途中で夜の色を通る）
    @State private var liveGlow: RGBA?
    @State private var sim = SeaSimulation()

    private var theme: Binding<Theme> {
        Binding(get: { Theme(rawValue: themeRaw) ?? .evening }, set: { themeRaw = $0.rawValue })
    }

    private var art: Binding<ArtStyle> {
        Binding(get: { ArtStyle(rawValue: artRaw) ?? .classic }, set: { artRaw = $0.rawValue })
    }

    /// 画面全体(安全領域も含む)を基準に、子を alignment の位置に置く層。
    /// ignoresSafeArea だと層が上の余白ぶん下にずれるので、座標で直接決める。
    private func screenLayer<Content: View>(
        _ width: CGFloat, _ height: CGFloat, top: CGFloat, alignment: Alignment, @ViewBuilder content: () -> Content
    ) -> some View {
        ZStack(alignment: alignment) { content() }
            .frame(width: width, height: height, alignment: alignment)
            .position(x: width / 2, y: height / 2 - top)
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
                screenLayer(fullWidth, fullHeight, top: insets.top, alignment: .bottom) {
                    MemoView(
                        model: memo, ink: liveInk ?? theme.wrappedValue.palette.ink,
                        glow: liveGlow ?? theme.wrappedValue.palette.glow, screenWidth: fullWidth)
                        .padding(.bottom, kb + sceneHeight * memoBottom)
                }

                // 「言葉を海へ」: キーボードのすぐ上の右側。入力欄に言葉があるときだけ現れる
                screenLayer(fullWidth, fullHeight, top: insets.top, alignment: .bottomTrailing) {
                    Button {
                        Haptics.tap()
                        memo.sendToSea()
                    } label: {
                        Label(L("言葉を海へ", "Send to the sea"), systemImage: "paperplane")
                            .font(.system(size: 14.5))
                            .foregroundStyle(.white)
                            .shadow(color: .black.opacity(0.35), radius: 2, y: 1)
                            .padding(.horizontal, 15)
                            .padding(.vertical, 9)
                            .background(Color(red: 0.16, green: 0.13, blue: 0.27).opacity(0.52), in: Capsule())
                            .background(.ultraThinMaterial, in: Capsule())
                            .overlay(Capsule().strokeBorder(.white.opacity(0.4), lineWidth: 1))
                    }
                    .opacity(memo.canSend ? 1 : 0)
                    .offset(y: memo.canSend ? 0 : 6)
                    .allowsHitTesting(memo.canSend)
                    .animation(.easeOut(duration: 0.35), value: memo.canSend)
                    .padding(.trailing, 14)
                    .padding(.bottom, kb + (kb > 0 ? 10 : max(14, insets.bottom)))
                }

                // メニューの外をタップしたら閉じる
                if menuOpen {
                    Color.black.opacity(0.001)
                        .ignoresSafeArea()
                        .onTapGesture { withAnimation(.spring(response: 0.3, dampingFraction: 0.85)) { menuOpen = false } }
                }

                VStack {
                    HStack {
                        Spacer()
                        Controls(theme: theme, art: art, auto: $autoCycle, open: $menuOpen) {
                            withAnimation { menuOpen = false }
                            showGuide = true
                        }
                    }
                    Spacer()
                }
                .padding(.horizontal, 12)
                .padding(.top, 8)

                if splashVisible {
                    SplashView()
                        .transition(.opacity)
                        .zIndex(10)
                }
            }
        }
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .statusBarHidden(true)
        .persistentSystemOverlays(.hidden)
        .sheet(isPresented: $showGuide) { GuideView() }
        .task(id: autoCycle) {
            guard autoCycle else { return }
            try? await Task.sleep(nanoseconds: 2_500_000_000)
            while !Task.isCancelled {
                let all = Theme.allCases
                let i = all.firstIndex(of: theme.wrappedValue) ?? 0
                themeRaw = all[(i + 1) % all.count].rawValue
                try? await Task.sleep(nanoseconds: 14_000_000_000)
            }
        }
        .onAppear {
            sim.onSweep = { reachY in memo.sweep(reachY: reachY) }
            sim.onInk = { ink, glow in
                liveInk = ink
                liveGlow = glow
            }
            memo.onSendWords = { lines, from, fs in sim.sendWords(lines: lines, from: from, fontSize: fs) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
                withAnimation(.easeOut(duration: 1.0)) { splashVisible = false }
            }
            #if DEBUG
            // 動作確認用: -demoSend / -demoMenu / -demoGuide
            let ud = UserDefaults.standard
            if ud.bool(forKey: "demoSend") { DispatchQueue.main.asyncAfter(deadline: .now() + 4) { memo.sendToSea() } }
            if ud.bool(forKey: "demoMenu") { DispatchQueue.main.asyncAfter(deadline: .now() + 3) { withAnimation { menuOpen = true } } }
            if ud.bool(forKey: "demoGuide") { DispatchQueue.main.asyncAfter(deadline: .now() + 3) { showGuide = true } }
            if let to = ud.string(forKey: "demoTheme") { DispatchQueue.main.asyncAfter(deadline: .now() + 3) { themeRaw = to } }
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
