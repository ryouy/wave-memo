import SwiftUI

typealias RGBA = SIMD4<Double>

private func c(_ r: Double, _ g: Double, _ b: Double, _ a: Double = 1) -> RGBA {
    RGBA(r / 255, g / 255, b / 255, a)
}

func color(_ v: RGBA, alpha: Double? = nil) -> Color {
    Color(.sRGB, red: v.x, green: v.y, blue: v.z, opacity: alpha ?? v.w)
}

/// 絵のセット。classic = 絵画風イラスト / pop = ポップなイラスト
enum ArtStyle: String, CaseIterable {
    case classic, pop

    var gullFacesLeft: Bool { self == .pop }
    var planeSlope: Double { self == .pop ? 0.2 : 0.17 }

    func asset(_ name: String) -> String { "\(rawValue)-\(name)" }
}

/// 朝・昼・夕・晩
enum Theme: String, CaseIterable, Identifiable {
    case morning, day, evening, night

    var id: String { rawValue }

    var label: String {
        switch self {
        case .morning: "朝"
        case .day: "昼"
        case .evening: "夕"
        case .night: "晩"
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
    var sunK: Double
    var sunX: Double
    var sunScale: Double
    var stars: Double
    var foam: Double

    mutating func approach(_ t: Palette, k: Double) {
        func mix(_ a: RGBA, _ b: RGBA) -> RGBA { a + (b - a) * k }
        func mixd(_ a: Double, _ b: Double) -> Double { a + (b - a) * k }
        ink = mix(ink, t.ink)
        glow = mix(glow, t.glow)
        for i in sky.indices { sky[i] = mix(sky[i], t.sky[i]) }
        for i in sand.indices { sand[i] = mix(sand[i], t.sand[i]) }
        for i in sea.indices { sea[i] = mix(sea[i], t.sea[i]) }
        sunCore = mix(sunCore, t.sunCore)
        sunGlow = mix(sunGlow, t.sunGlow)
        sunReflect = mix(sunReflect, t.sunReflect)
        cloud = mix(cloud, t.cloud)
        tint = mix(tint, t.tint)
        sunK = mixd(sunK, t.sunK)
        sunX = mixd(sunX, t.sunX)
        sunScale = mixd(sunScale, t.sunScale)
        stars = mixd(stars, t.stars)
        foam = mixd(foam, t.foam)
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
                sunK: 0.5, sunX: 0.3, sunScale: 1, stars: 0, foam: 0.6)
        case .day:
            return Palette(
                ink: c(61, 74, 92), glow: c(255, 255, 255, 0.7),
                sky: [c(47, 134, 224), c(95, 176, 240), c(159, 212, 247), c(214, 239, 255)],
                sand: [c(244, 227, 184), c(249, 239, 208), c(255, 251, 234)],
                sea: [c(120, 200, 230, 0.95), c(40, 150, 215, 0.95), c(15, 100, 185, 0.95)],
                sunCore: c(255, 248, 200), sunGlow: c(255, 240, 170), sunReflect: c(255, 255, 255),
                cloud: c(255, 255, 255, 0.85), tint: c(255, 255, 255, 0),
                sunK: -3.4, sunX: 0.58, sunScale: 0.6, stars: 0, foam: 0.6)
        case .evening:
            return Palette(
                ink: c(59, 47, 74), glow: c(255, 255, 255, 0.7),
                sky: [c(28, 20, 87), c(90, 42, 134), c(201, 73, 106), c(249, 128, 53)],
                sand: [c(243, 201, 138), c(251, 233, 196), c(254, 251, 243)],
                sea: [c(236, 140, 100, 0.97), c(120, 100, 170, 0.95), c(48, 98, 190, 0.95)],
                sunCore: c(255, 210, 120), sunGlow: c(255, 150, 60), sunReflect: c(255, 200, 120),
                cloud: c(255, 150, 130, 0.65), tint: c(255, 120, 70, 0.16),
                sunK: 0.3, sunX: 0.66, sunScale: 1, stars: 0, foam: 0.6)
        case .night:
            return Palette(
                ink: c(232, 234, 250), glow: c(8, 10, 48, 0.75),
                sky: [c(5, 8, 30), c(14, 20, 60), c(40, 48, 100), c(84, 90, 146)],
                sand: [c(58, 62, 100), c(78, 82, 120), c(104, 108, 142)],
                sea: [c(70, 80, 140, 0.95), c(28, 44, 104, 0.95), c(10, 20, 70, 0.95)],
                sunCore: c(240, 244, 255), sunGlow: c(150, 170, 255), sunReflect: c(200, 215, 255),
                cloud: c(96, 106, 166, 0.45), tint: c(12, 18, 64, 0.5),
                sunK: -4.5, sunX: 0.3, sunScale: 0.5, stars: 1, foam: 0.3)
        }
    }
}
