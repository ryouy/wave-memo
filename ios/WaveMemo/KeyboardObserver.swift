import SwiftUI
import UIKit

/// ソフトウェアキーボードの高さ（画面下端から、キーボード上端までの距離）。
@MainActor
final class KeyboardObserver: ObservableObject {
    @Published var height: CGFloat = 0
    private var token: NSObjectProtocol?

    init() {
        #if DEBUG
        // 動作確認用: -demoKb 336 で、キーボードが出ている状態の配置を確かめる
        let demo = UserDefaults.standard.double(forKey: "demoKb")
        if demo > 0 { height = demo }
        #endif
        token = NotificationCenter.default.addObserver(
            forName: UIResponder.keyboardWillChangeFrameNotification, object: nil, queue: .main
        ) { [weak self] note in
            MainActor.assumeIsolated {
                guard let self,
                    let end = (note.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue
                else { return }
                let screen = UIScreen.main.bounds.height
                let h = max(0, screen - end.minY)
                let duration = (note.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? Double) ?? 0.25
                withAnimation(.easeOut(duration: duration)) { self.height = h }
            }
        }
    }

    deinit {
        if let token { NotificationCenter.default.removeObserver(token) }
    }
}
