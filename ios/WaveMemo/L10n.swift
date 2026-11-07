import Foundation

/// 端末の優先言語が日本語なら日本語、それ以外は英語を返す。
let isJapanese: Bool = Locale.preferredLanguages.first?.hasPrefix("ja") ?? false

func L(_ ja: String, _ en: String) -> String { isJapanese ? ja : en }
