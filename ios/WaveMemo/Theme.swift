import SwiftUI

typealias RGBA = SIMD4<Double>

private func c(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) -> RGBA {
    RGBA(r / 255, g / 255, b / 255, a)
}

func color(_ v: RGBA, alpha: Double? = nil) -> Color {
    Color(.sRGB, red: v.x, green: v.y, blue: v.z, opacity: alpha ?? v.w)
}

/// 絵のセット（4種類）。classic = ヴィンテージ風 / pop = カラフルなポップ / painted = 絵画風 / cartoon = 輪郭つきのポップ
enum ArtStyle: String, CaseIterable, Identifiable {
    case classic, pop, painted, cartoon

    var id: String { rawValue }

    /// カモメの絵が左向きか
    var gullFacesLeft: Bool { self == .cartoon }

    /// 飛行機が横切るときの上昇の傾き（新しい2つは水平に飛ぶ絵、前の2つは機首を上げた絵）
    var planeSlope: Double {
        switch self {
        case .classic, .pop: 0.03
        case .painted: 0.17
        case .cartoon: 0.2
        }
    }

    var label: String {
        switch self {
        case .classic: L("ヴィンテージ", "Vintage")
        case .pop: L("カラフル", "Colorful")
        case .painted: L("絵画風", "Painted")
        case .cartoon: L("輪郭つきポップ", "Outlined pop")
        }
    }

    func asset(_ name: String) -> String { "\(rawValue)-\(name)" }
}

/// 朝・昼・夕・晩
enum Theme: String, CaseIterable, Identifiable {
    case morning, day, evening, night

    var id: String { rawValue }

    var label: String {
        switch self {
        case .morning: L("朝", "Morning")
        case .day: L("昼", "Day")
        case .evening: L("夕", "Evening")
        case .night: L("晩", "Night")
        }
    }

    var symbol: String {
        switch self {
        case .morning: "sunrise.fill"
        case .day: "sun.max.fill"
        case .evening: "sunset.fill"
        case .night: "moon.stars.fill"
        }
    }

    var palette: Palette { Palette.of(self) }

    /// 太陽の軌道（楕円）上の位置 φ。東(左)の水平線で昇り、真上を通って、西(右)の水平線へ沈み、夜は地平線の下を回って朝に戻る。
    /// 切り替えは必ず φ が増える向きに進む。月は太陽の反対側(φ+π)にいる。
    /// 月が空にいるのは、太陽が完全に沈んでから、また顔を出すまでのあいだだけ（朝夕に、太陽と月が同時に水平線の上に出ないように）
    static let moonFrom = Double.pi + 0.73
    static let moonTo = Double.pi * 2 - 0.73

    /// 太陽の位置 φ から、月の軌道上の位置 ψ を決める。空にいない間は、水平線の下で待つ
    static func moonPsi(_ phi: Double) -> Double {
        let tau = Double.pi * 2
        var p = phi.truncatingRemainder(dividingBy: tau)
        if p < 0 { p += tau }
        if p >= moonFrom && p <= moonTo { return -0.5 + (p - moonFrom) / (moonTo - moonFrom) * (Double.pi + 1.0) }
        if p < Double.pi / 2 { return Double.pi + 0.75 } // 日の出のあとは、右の水平線の下
        return p < moonFrom ? -0.75 : Double.pi + 0.75 // 日没までは左の水平線の下で出番を待つ
    }

    var phi: Double {
        switch self {
        case .morning: Double.pi * 2 - 0.14
        case .day: Double.pi / 2
        case .evening: Double.pi + 0.083
        case .night: Theme.moonFrom + 0.35 * (Theme.moonTo - Theme.moonFrom) // 月が左の高いところにいる
        }
    }
}

/// 時間帯ごとの色。SeaSimulation が現在値から目標値へ滑らかに補間する。
struct Palette {
    var ink: RGBA
    var glow: RGBA
    var sky: [RGBA]
    var sand: [RGBA]
    var sea: [RGBA]
    var sunCore: RGBA
    var sunGlow: RGBA
    var sunReflect: RGBA
    var cloud: RGBA // a = 雲の濃さ
    var tint: RGBA // 絵に重ねる色味（a = 強さ）
    var sunScale: Double
    var stars: Double
    var foam: Double

    /// 2つの時間帯の色を t(0〜1) で混ぜる。
    static func blend(_ a: Palette, _ b: Palette, t: Double) -> Palette {
        func mix(_ x: RGBA, _ y: RGBA) -> RGBA { x + (y - x) * t }
        func mixd(_ x: Double, _ y: Double) -> Double { x + (y - x) * t }
        var r = a
        r.ink = mix(a.ink, b.ink)
        r.glow = mix(a.glow, b.glow)
        for i in r.sky.indices { r.sky[i] = mix(a.sky[i], b.sky[i]) }
        for i in r.sand.indices { r.sand[i] = mix(a.sand[i], b.sand[i]) }
        for i in r.sea.indices { r.sea[i] = mix(a.sea[i], b.sea[i]) }
        r.sunCore = mix(a.sunCore, b.sunCore)
        r.sunGlow = mix(a.sunGlow, b.sunGlow)
        r.sunReflect = mix(a.sunReflect, b.sunReflect)
        r.cloud = mix(a.cloud, b.cloud)
        r.tint = mix(a.tint, b.tint)
        r.sunScale = mixd(a.sunScale, b.sunScale)
        r.stars = mixd(a.stars, b.stars)
        r.foam = mixd(a.foam, b.foam)
        return r
    }

    static func of(_ theme: Theme) -> Palette {
        switch theme {
        case .morning:
            return Palette(
                ink: c(74, 66, 84), glow: c(255, 255, 255, 0.7),
                sky: [c(91, 143, 214), c(169, 200, 238), c(249, 201, 165), c(255, 217, 160)],
                sand: [c(246, 226, 189), c(251, 239, 213), c(255, 250, 240)],
                sea: [c(255, 200, 160, 0.95), c(130, 185, 215, 0.95), c(60, 140, 200, 0.95)],
                sunCore: c(255, 230, 160), sunGlow: c(255, 190, 110), sunReflect: c(255, 225, 170),
                cloud: c(255, 226, 214, 0.8), tint: c(255, 205, 170, 0.07),
                sunScale: 1, stars: 0, foam: 0.6)
        case .day:
            return Palette(
                ink: c(61, 74, 92), glow: c(255, 255, 255, 0.7),
                sky: [c(47, 134, 224), c(95, 176, 240), c(159, 212, 247), c(214, 239, 255)],
                sand: [c(244, 227, 184), c(249, 239, 208), c(255, 251, 234)],
                sea: [c(120, 200, 230, 0.95), c(40, 150, 215, 0.95), c(15, 100, 185, 0.95)],
                sunCore: c(255, 248, 200), sunGlow: c(255, 240, 170), sunReflect: c(255, 255, 255),
                cloud: c(255, 255, 255, 0.85), tint: c(255, 255, 255, 0),
                sunScale: 0.6, stars: 0, foam: 0.6)
        case .evening:
            return Palette(
                ink: c(59, 47, 74), glow: c(255, 255, 255, 0.7),
                sky: [c(28, 20, 87), c(90, 42, 134), c(201, 73, 106), c(249, 128, 53)],
                sand: [c(243, 201, 138), c(251, 233, 196), c(254, 251, 243)],
                sea: [c(236, 140, 100, 0.97), c(120, 100, 170, 0.95), c(48, 98, 190, 0.95)],
                sunCore: c(255, 210, 120), sunGlow: c(255, 150, 60), sunReflect: c(255, 200, 120),
                cloud: c(255, 150, 130, 0.65), tint: c(255, 120, 70, 0.16),
                sunScale: 1, stars: 0, foam: 0.6)
        case .night:
            return Palette(
                ink: c(232, 234, 250), glow: c(8, 10, 48, 0.75),
                sky: [c(5, 8, 30), c(14, 20, 60), c(40, 48, 100), c(84, 90, 146)],
                sand: [c(58, 62, 100), c(78, 82, 120), c(104, 108, 142)],
                sea: [c(70, 80, 140, 0.95), c(28, 44, 104, 0.95), c(10, 20, 70, 0.95)],
                sunCore: c(255, 210, 120), sunGlow: c(255, 150, 60), sunReflect: c(255, 200, 120),
                cloud: c(96, 106, 166, 0.45), tint: c(12, 18, 64, 0.5),
                sunScale: 1, stars: 1, foam: 0.3)
        }
    }
}
