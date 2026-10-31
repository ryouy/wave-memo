import SwiftUI
import UIKit

private let horizon: CGFloat = 0.34 // 水平線の位置（画面高さ比）。常に見えている
private let rest: Double = 0.4 // 波が引いたときの波先の位置

private func clamp(_ v: CGFloat, _ lo: CGFloat, _ hi: CGFloat) -> CGFloat { min(hi, max(lo, v)) }
private func ease(_ x: Double) -> Double { 0.5 - 0.5 * cos(Double.pi * min(1, max(0, x))) }
private func rand(_ a: Double, _ b: Double) -> Double { Double.random(in: a...b) }

/// 画面ごとの寸法と、波先の形。
private struct Geo {
    let W: CGFloat
    let H: CGFloat
    let horizonY: CGFloat
    let baseY: CGFloat
    let foamHeight: CGFloat
    let amp: CGFloat
    let freq: CGFloat
    let near: CGFloat
    let t: Double

    func waveY(_ x: CGFloat) -> CGFloat {
        baseY + sin(x * freq + t * 1.5) * amp + sin(x * freq * 2.5 + t * 2.2) * amp * 0.33
    }
}

/// 空・海・波・生き物をまとめて描く。描画のたびに advance して状態を進める（Canvas から毎フレーム呼ぶ）。
final class SeaSimulation {
    var theme: Theme = .evening
    var art: ArtStyle = .classic
    /// 波が文字の位置まで届いた。引数は波先の y（画面座標）。
    var onSweep: ((CGFloat) -> Void)?

    private var pal = Palette.of(.evening)
    private var lastDate: Date?
    private var clock = 0.0 // ms
    private var t = 0.0

    private enum Phase { case wait, down, up }
    private var phase = Phase.wait
    private var phaseTime = 0.0
    private var waitMs = 1500.0
    private var target = rest
    private var level = rest
    private var swept = false
    private var downMs = 5000.0
    private var upMs = 6500.0
    private var nextBigAt = rand(9000, 14000) // 文字をさらう大きな波は、たまにだけ来る

    private struct Bird {
        var away: Bool
        var dir: Double
        var age: Double
        var dur: Double
        var x0: Double, y0: Double, x1: Double, y1: Double
        var size: Double
        var ph: Double
        var sway: Double
    }

    private struct Plane {
        var dir: Double
        var w: CGFloat
        var x0: CGFloat
        var x: CGFloat
        var y0: CGFloat
        var vx: CGFloat
    }

    private struct Puff { var dx: CGFloat, dy: CGFloat, r: CGFloat }

    private struct Cloud {
        var dir: CGFloat
        var w: CGFloat
        var puffs: [Puff]
        var x: CGFloat
        var y: CGFloat
        var vx: CGFloat
        var alpha: Double
    }

    private struct Bubble { var x: CGFloat, y: CGFloat, r: CGFloat, age: Double, life: Double, ph: Double }

    private var birds: [Bird] = []
    private var plane: Plane?
    private var clouds: [Cloud] = []
    private var bubbles: [Bubble] = []
    private var nextBird = rand(2500, 5000)
    private var nextPlane = rand(12000, 20000)
    private var nextCloud = rand(1500, 4000)
    private var boatClock = 20000.0 // 起動後まもなく船が見えるように
    private var wetBottom: CGFloat = 0

    private static let stars: [(x: Double, y: Double, r: Double, ph: Double)] = (0..<80).map { i in
        func f(_ n: Double) -> Double {
            let v = sin(Double(i) * 127.1 + n * 311.7) * 43758.5453
            return v - v.rounded(.down)
        }
        return (f(1), f(2), 0.6 + f(3) * 1.3, f(4) * 6.28)
    }

    private var aspects: [String: CGFloat] = [:]
    private func aspect(_ name: String) -> CGFloat {
        if let a = aspects[name] { return a }
        let s = UIImage(named: name)?.size ?? CGSize(width: 1, height: 1)
        let a = s.height / max(1, s.width)
        aspects[name] = a
        return a
    }

    // MARK: - 毎フレーム

    func render(_ ctx: inout GraphicsContext, size: CGSize, now: Date) {
        let W = size.width
        let H = size.height
        guard W > 1, H > 1 else { return }

        var dt = 16.0
        if let last = lastDate { dt = min(max(now.timeIntervalSince(last) * 1000, 0), 50) }
        lastDate = now
        phaseTime += dt
        clock += dt
        t += dt * 0.0004
        pal.approach(theme.palette, k: 1 - exp(-dt / 350))
        stepWave()

        let horizonY = H * horizon
        let baseY = H * CGFloat(level)
        let near = clamp((CGFloat(level) - horizon) / (0.95 - horizon), 0, 1)
        let g = Geo(
            W: W, H: H, horizonY: horizonY, baseY: baseY,
            foamHeight: H * (0.03 + near * 0.05),
            amp: 8 + near * 16,
            freq: 0.014 - near * 0.006,
            near: near, t: t)

        drawSkyAndSand(&ctx, g)
        drawStars(&ctx, g)
        let sun = drawSun(&ctx, g)
        drawSkyLife(&ctx, g, dt: dt)
        drawSea(&ctx, g)
        drawReflection(&ctx, g, sun: sun)
        drawRipples(&ctx, g)
        drawHorizonLine(&ctx, g)
        drawBoat(&ctx, g, dt: dt)
        let wetH = drawWetSand(&ctx, g, dt: dt)
        drawFoam(&ctx, g)
        drawBubbles(&ctx, g, wetH: wetH, dt: dt)
        drawCrest(&ctx, g)
        drawShoreProps(&ctx, g)

        if phase == .down, !swept, phaseTime > downMs * 0.65 {
            swept = true
            let reach = baseY + g.foamHeight
            DispatchQueue.main.async { [weak self] in self?.onSweep?(reach) }
        }
    }

    // 波の状態機械: wait → down(文字をさらう) → up → wait …
    private func stepWave() {
        if phase == .wait, phaseTime > waitMs {
            phase = .down
            phaseTime = 0
            if clock >= nextBigAt {
                // 大きな波: 文字のある砂浜まで下りてくる
                target = rand(0.8, 0.93)
                downMs = 5500
                upMs = 7000
                swept = false
                nextBigAt = clock + rand(14000, 28000)
            } else {
                // 普段のゆるいうねり: 水平線の近くで寄せて返すだけ
                target = rand(0.45, 0.53)
                downMs = 4500
                upMs = 5500
                swept = true
            }
        } else if phase == .down, phaseTime > downMs {
            phase = .up
            phaseTime = 0
        } else if phase == .up, phaseTime > upMs {
            phase = .wait
            phaseTime = 0
            waitMs = rand(1500, 3500)
        }
        switch phase {
        case .down: level = rest + (target - rest) * ease(phaseTime / downMs)
        case .up: level = target + (rest - target) * ease(phaseTime / upMs)
        case .wait: level = rest
        }
    }

    // MARK: - 空・太陽

    private func drawSkyAndSand(_ ctx: inout GraphicsContext, _ g: Geo) {
        let skyStops: [Gradient.Stop] = [
            .init(color: color(pal.sky[0], alpha: 1), location: 0),
            .init(color: color(pal.sky[1], alpha: 1), location: 0.45),
            .init(color: color(pal.sky[2], alpha: 1), location: 0.78),
            .init(color: color(pal.sky[3], alpha: 1), location: 1),
        ]
        ctx.fill(
            Path(CGRect(x: 0, y: 0, width: g.W, height: g.horizonY + 1)),
            with: .linearGradient(Gradient(stops: skyStops), startPoint: .zero, endPoint: CGPoint(x: 0, y: g.horizonY)))
        let sandStops: [Gradient.Stop] = [
            .init(color: color(pal.sand[0], alpha: 1), location: 0),
            .init(color: color(pal.sand[1], alpha: 1), location: 0.35),
            .init(color: color(pal.sand[2], alpha: 1), location: 1),
        ]
        ctx.fill(
            Path(CGRect(x: 0, y: g.horizonY, width: g.W, height: g.H - g.horizonY)),
            with: .linearGradient(
                Gradient(stops: sandStops), startPoint: CGPoint(x: 0, y: g.horizonY), endPoint: CGPoint(x: 0, y: g.H)))
    }

    private func drawStars(_ ctx: inout GraphicsContext, _ g: Geo) {
        guard pal.stars > 0.02 else { return }
        for st in Self.stars {
            let tw = 0.6 + 0.4 * sin(clock * 0.0015 + st.ph)
            let fade = 1 - st.y * 0.85
            let a = min(1, 0.9 * pal.stars * tw * fade)
            let cx = st.x * g.W
            let cy = st.y * g.horizonY * 0.95
            ctx.fill(
                Path(ellipseIn: CGRect(x: cx - st.r / 2, y: cy - st.r / 2, width: st.r, height: st.r)),
                with: .color(Color(red: 1, green: 1, blue: 0.94, opacity: a)))
        }
    }

    private struct SunInfo { var x: CGFloat; var r: CGFloat }

    private func drawSun(_ ctx: inout GraphicsContext, _ g: Geo) -> SunInfo {
        let r = min(g.W, g.H) * 0.11 * CGFloat(pal.sunScale)
        let sx = g.W * CGFloat(pal.sunX)
        let sy = g.horizonY + r * CGFloat(pal.sunK)
        var c = ctx
        c.clip(to: Path(CGRect(x: 0, y: 0, width: g.W, height: g.horizonY))) // 水平線より下は描かない
        for i in stride(from: 6, through: 1, by: -1) {
            let rr = r * (1 + CGFloat(i) * 0.55) / 2
            c.fill(
                Path(ellipseIn: CGRect(x: sx - rr, y: sy - rr, width: rr * 2, height: rr * 2)),
                with: .color(color(pal.sunGlow, alpha: 14.0 / 255)))
        }
        c.fill(Path(ellipseIn: CGRect(x: sx - r, y: sy - r, width: r * 2, height: r * 2)), with: .color(color(pal.sunCore, alpha: 1)))
        let ri = r * 0.75
        c.fill(
            Path(ellipseIn: CGRect(x: sx - ri, y: sy - ri, width: ri * 2, height: ri * 2)),
            with: .color(Color(red: 1, green: 0.96, blue: 0.82, opacity: 200.0 / 255)))
        return SunInfo(x: sx, r: r)
    }

    // MARK: - 空の生き物（雲・鳥・飛行機）

    private func spawnBirds(_ g: Geo) {
        let away = Double.random(in: 0...1) < 0.4
        let n = Double.random(in: 0...1) < 0.35 ? Int.random(in: 2...3) : 1
        let dir: Double = Bool.random() ? 1 : -1
        let baseY = rand(0.08, 0.22) * g.H
        let baseX = away ? rand(0.2, 0.8) * g.W : (dir > 0 ? -40 : g.W + 40)
        let dur = away ? rand(8000, 11000) : rand(13000, 19000)
        for i in 0..<n {
            birds.append(
                Bird(
                    away: away, dir: dir, age: -Double(i) * 450, dur: dur,
                    x0: baseX - dir * Double(i) * 36, y0: baseY + Double(i) * rand(10, 26),
                    x1: baseX + rand(-0.12, 0.12) * g.W, y1: g.horizonY - 6,
                    size: rand(0.8, 1.15), ph: rand(0, 6.28), sway: rand(0.6, 1.4)))
        }
    }

    private func spawnCloud(_ g: Geo) {
        let dir: CGFloat = Bool.random() ? 1 : -1
        let w = g.W * rand(0.14, 0.26)
        let n = Int.random(in: 7...10)
        var puffs: [Puff] = []
        for i in 0..<n {
            let u = (CGFloat(i) + 0.5) / CGFloat(n)
            let hump = sin(u * .pi)
            puffs.append(
                Puff(
                    dx: (u - 0.5) * w,
                    dy: -hump * w * 0.05 * rand(0.6, 1.2) + rand(-0.01, 0.01) * w,
                    r: w * (0.08 + 0.1 * hump) * rand(0.8, 1.15)))
        }
        clouds.append(
            Cloud(
                dir: dir, w: w, puffs: puffs,
                x: dir > 0 ? -w * 0.6 : g.W + w * 0.6, y: rand(0.05, 0.22) * g.H,
                vx: (g.W + w * 1.2) / rand(70000, 110000), alpha: rand(0.7, 1)))
    }

    private func drawSkyLife(_ ctx: inout GraphicsContext, _ g: Geo, dt: Double) {
        if clock > nextBird {
            spawnBirds(g)
            nextBird = clock + rand(7000, 16000)
        }
        if plane == nil, clock > nextPlane {
            let dir: Double = Bool.random() ? 1 : -1
            let pw = clamp(min(g.W, g.H) * 0.2, 56, 150)
            let x0 = dir > 0 ? -pw : g.W + pw
            plane = Plane(dir: dir, w: pw, x0: x0, x: x0, y0: rand(0.2, 0.3) * g.H, vx: (g.W + pw * 2) / 26000)
            nextPlane = clock + rand(35000, 60000)
        }
        if clock > nextCloud, clouds.count < 3 {
            spawnCloud(g)
            nextCloud = clock + rand(15000, 35000)
        }

        var c = ctx
        c.clip(to: Path(CGRect(x: 0, y: 0, width: g.W, height: g.horizonY)))

        // 雲
        clouds.removeAll { $0.x < -$0.w * 0.8 || $0.x > g.W + $0.w * 0.8 }
        for i in clouds.indices {
            clouds[i].x += clouds[i].vx * clouds[i].dir * CGFloat(dt)
            let cl = clouds[i]
            let a = pal.cloud.w * cl.alpha
            for pf in cl.puffs {
                var pc = c
                pc.translateBy(x: cl.x + pf.dx, y: cl.y + pf.dy)
                pc.scaleBy(x: 1, y: 0.62)
                let grad = Gradient(stops: [
                    .init(color: color(pal.cloud, alpha: a), location: 0),
                    .init(color: color(pal.cloud, alpha: a * 0.6), location: 0.6),
                    .init(color: color(pal.cloud, alpha: 0), location: 1),
                ])
                pc.fill(
                    Path(ellipseIn: CGRect(x: -pf.r, y: -pf.r, width: pf.r * 2, height: pf.r * 2)),
                    with: .radialGradient(grad, center: .zero, startRadius: 0, endRadius: pf.r))
            }
        }

        // 鳥
        birds.removeAll { $0.age >= $0.dur }
        let gullBase = clamp(min(g.W, g.H) * 0.06, 26, 70)
        for i in birds.indices {
            birds[i].age += dt
            let b = birds[i]
            if b.age < 0 { continue }
            let k = b.age / b.dur
            var x: Double, y: Double, s: CGFloat, a = 1.0
            if b.away {
                x = b.x0 + (b.x1 - b.x0) * ease(k * 0.9 + 0.05 * k)
                y = b.y0 + (b.y1 - b.y0) * k * k
                s = gullBase * b.size * (1 - 0.8 * k)
                a = 1 - max(0, (k - 0.75) / 0.25)
            } else {
                x = b.x0 + b.dir * (Double(g.W) + 80) * k
                y = b.y0 + sin(k * 6 * b.sway + b.ph) * Double(g.H) * 0.02
                s = gullBase * b.size
            }
            let flap = sin(clock * 0.008 + b.ph)
            let left = b.away ? b.x1 < b.x0 : b.dir < 0
            sprite(
                &c, "flying-seagull", x: x, y: y, w: s,
                flip: art.gullFacesLeft ? !left : left,
                rot: (left ? 1 : -1) * flap * 0.05, sy: 1 + flap * 0.16, alpha: a)
        }

        // 飛行機: 機首を少し上げたまま、ゆっくり上昇していく
        if var pl = plane {
            pl.x += pl.vx * CGFloat(pl.dir) * CGFloat(dt)
            let py = pl.y0 - abs(pl.x - pl.x0) * CGFloat(art.planeSlope) + CGFloat(sin(clock * 0.0017)) * 2
            sprite(&c, "distant-plane", x: pl.x, y: py, w: pl.w, flip: pl.dir < 0, alpha: 0.95)
            plane = (pl.x < -pl.w * 1.5 || pl.x > g.W + pl.w * 1.5) ? nil : pl
        }
    }

    // MARK: - 海

    private func drawSea(_ ctx: inout GraphicsContext, _ g: Geo) {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: g.horizonY))
        p.addLine(to: CGPoint(x: g.W, y: g.horizonY))
        var x = g.W
        while x >= 0 {
            p.addLine(to: CGPoint(x: x, y: g.waveY(x)))
            x -= 6
        }
        p.closeSubpath()
        let stops: [Gradient.Stop] = [
            .init(color: color(pal.sea[0]), location: 0),
            .init(color: color(pal.sea[1]), location: 0.18),
            .init(color: color(pal.sea[2]), location: 1),
        ]
        ctx.fill(
            p,
            with: .linearGradient(
                Gradient(stops: stops), startPoint: CGPoint(x: 0, y: g.horizonY), endPoint: CGPoint(x: 0, y: g.H * 0.9)))
    }

    /// 太陽の反射（海面のきらめき）
    private func drawReflection(_ ctx: inout GraphicsContext, _ g: Geo, sun: SunInfo) {
        var y = g.horizonY + 4
        while y < g.baseY - 6 {
            let k = (y - g.horizonY) / max(1, g.H * 0.5)
            let w = sun.r * (0.5 + k * 1.6) * (0.7 + 0.3 * CGFloat(sin(Double(y) * 0.4 + t * 3)))
            let a = max(0, 120 - Double(k) * 150) / 255
            ctx.fill(
                Path(roundedRect: CGRect(x: sun.x - w / 2, y: y, width: w, height: 2.5), cornerRadius: 1.2),
                with: .color(color(pal.sunReflect, alpha: a)))
            y += 7
        }
    }

    /// 遠近感のあるさざ波。水平線付近は細かく密に、手前ほど太く間隔が広い。ゆっくり手前へ寄ってくる。
    private func drawRipples(_ ctx: inout GraphicsContext, _ g: Geo) {
        let seaH = g.baseY - g.horizonY
        guard seaH > 12 else { return }
        let rows = 4
        let drift = (t * 0.2).truncatingRemainder(dividingBy: 1)
        let strength = Double(min(1, seaH / (g.H * 0.18))) * (pal.foam / 0.6)
        for i in 0..<rows {
            let d = (Double(i) + drift) / Double(rows)
            let depth = CGFloat(pow(d, 1.9))
            let y = g.horizonY + seaH * depth
            if y > g.baseY - g.amp - 6 { continue }
            let wl = 30 + depth * 260
            var p = Path()
            var x: CGFloat = 0
            while x <= g.W + 8 {
                let yy = y + CGFloat(sin(Double(x / wl) * 6.283 + t * 1.2 + Double(i) * 1.7)) * (0.6 + depth * 5)
                if x == 0 { p.move(to: CGPoint(x: x, y: yy)) } else { p.addLine(to: CGPoint(x: x, y: yy)) }
                x += 8
            }
            let style = StrokeStyle(
                lineWidth: 0.8 + depth * 2.6, lineCap: .round,
                dash: [20 + depth * 220, 14 + depth * 120],
                dashPhase: CGFloat(-t * Double(30 + depth * 120) * 3) + CGFloat(i) * 40)
            ctx.stroke(p, with: .color(.white.opacity(sin(.pi * d) * 0.3 * strength)), style: style)
        }
    }

    private func drawHorizonLine(_ ctx: inout GraphicsContext, _ g: Geo) {
        var p = Path()
        p.move(to: CGPoint(x: 0, y: g.horizonY))
        p.addLine(to: CGPoint(x: g.W, y: g.horizonY))
        ctx.stroke(p, with: .color(Color(red: 1, green: 0.86, blue: 0.67, opacity: 0.8)), lineWidth: 1.5)
    }

    // MARK: - 船・濡れた砂・泡

    private func drawBoat(_ ctx: inout GraphicsContext, _ g: Geo, dt: Double) {
        boatClock += dt
        let k = CGFloat(boatClock.truncatingRemainder(dividingBy: 45000) / 32000)
        guard k < 1 else { return }
        let seaH = g.baseY - g.horizonY
        let bw = clamp(min(g.W, g.H) * 0.17, 64, 170)
        let bx = g.W + bw - (g.W + bw * 2) * k
        let by = g.horizonY + min(14, seaH * 0.5) + CGFloat(sin(clock * 0.0016)) * bw * 0.02
        ctx.fill(
            Path(ellipseIn: CGRect(x: bx - bw * 0.46, y: by + 1 - bw * 0.03, width: bw * 0.92, height: bw * 0.06)),
            with: .color(.black.opacity(0.16)))
        sprite(&ctx, "fishing-boat", x: bx, y: by, w: bw, ay: 0.92, flip: true, rot: sin(clock * 0.0011) * 0.03)
    }

    /// 波が引いたあとの濡れた砂。濡れた帯の高さを返す。
    private func drawWetSand(_ ctx: inout GraphicsContext, _ g: Geo, dt: Double) -> CGFloat {
        let frontBottom = g.baseY + g.foamHeight + g.amp * 0.5
        if frontBottom > wetBottom {
            wetBottom = frontBottom
        } else {
            wetBottom = max(frontBottom, wetBottom - CGFloat(dt) * g.H * 0.000012)
        }
        let wetH = wetBottom - frontBottom
        guard wetH > 2 else { return wetH }
        var p = Path()
        var x: CGFloat = 0
        while x <= g.W + 6 {
            let pt = CGPoint(x: x, y: g.waveY(x) + g.foamHeight * 0.5)
            if x == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            x += 6
        }
        x = g.W + 6
        while x >= 0 {
            p.addLine(to: CGPoint(x: x, y: wetBottom + CGFloat(sin(Double(x) * 0.02 + t)) * 5))
            x -= 6
        }
        p.closeSubpath()
        let a = 0.1 * Double(min(1, wetH / (g.H * 0.05)))
        ctx.fill(p, with: .color(Color(red: 80 / 255, green: 60 / 255, blue: 72 / 255, opacity: a)))
        return wetH
    }

    private func drawFoam(_ ctx: inout GraphicsContext, _ g: Geo) {
        var p = Path()
        var x: CGFloat = 0
        while x <= g.W + 6 {
            let pt = CGPoint(x: x, y: g.waveY(x))
            if x == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            x += 6
        }
        x = g.W + 6
        while x >= 0 {
            let wob = CGFloat(sin(Double(x) * 0.015 - t * 1.6)) * 5
            p.addLine(to: CGPoint(x: x, y: g.waveY(x) + g.foamHeight + wob))
            x -= 6
        }
        p.closeSubpath()
        ctx.fill(p, with: .color(.white.opacity(pal.foam)))
    }

    /// しゅわしゅわ: 引いていく波が残す小さな泡が、生まれて弾ける
    private func drawBubbles(_ ctx: inout GraphicsContext, _ g: Geo, wetH: CGFloat, dt: Double) {
        if phase == .up, wetH > 4, bubbles.count < 70 {
            let n = Int(ceil(dt * Double(g.W) * 0.00003))
            for _ in 0..<n {
                let x = CGFloat.random(in: 0...g.W)
                let yTop = g.waveY(x) + g.foamHeight * 0.8
                bubbles.append(
                    Bubble(
                        x: x, y: yTop + CGFloat(pow(Double.random(in: 0...1), 1.6)) * max(2, wetBottom - yTop),
                        r: rand(0.8, 3), age: 0, life: rand(1200, 3200), ph: rand(0, 6.28)))
            }
        }
        bubbles.removeAll { $0.age >= $0.life }
        for i in bubbles.indices {
            bubbles[i].age += dt
            let b = bubbles[i]
            let k = b.age / b.life
            let pop = k > 0.85 ? (k - 0.85) / 0.15 : 0
            let bx = b.x + CGFloat(sin(clock * 0.002 + b.ph)) * 1.5
            let a = pal.foam * (1 - k * 0.6) * (1 - pop)
            let rr = b.r * CGFloat(1 + pop * 1.2)
            let circle = Path(ellipseIn: CGRect(x: bx - rr, y: b.y - rr, width: rr * 2, height: rr * 2))
            if pop == 0 { ctx.fill(circle, with: .color(.white.opacity(a * 0.4))) }
            ctx.stroke(circle, with: .color(.white.opacity(a)), lineWidth: 1)
        }
    }

    /// 波頭の白い線と、少し奥を追ってくる薄い波筋
    private func drawCrest(_ ctx: inout GraphicsContext, _ g: Geo) {
        var p = Path()
        var x: CGFloat = 0
        while x <= g.W + 6 {
            let pt = CGPoint(x: x, y: g.waveY(x))
            if x == 0 { p.move(to: pt) } else { p.addLine(to: pt) }
            x += 6
        }
        ctx.stroke(
            p, with: .color(.white.opacity(min(1, pal.foam * 1.4))),
            style: StrokeStyle(lineWidth: 1.5 + g.near * 2.5, lineCap: .round))

        var q = Path()
        x = 0
        while x <= g.W + 6 {
            let yy = g.waveY(x) - g.foamHeight * 1.1 + CGFloat(sin(Double(x * g.freq) * 1.7 - t * 1.4)) * g.amp * 0.4
            if x == 0 { q.move(to: CGPoint(x: x, y: yy)) } else { q.addLine(to: CGPoint(x: x, y: yy)) }
            x += 6
        }
        ctx.stroke(
            q, with: .color(.white.opacity(pal.foam * 0.4)),
            style: StrokeStyle(lineWidth: 1 + g.near * 1.5, lineCap: .round))
    }

    // MARK: - 貝・カニ・岩

    private func drawShoreProps(_ ctx: inout GraphicsContext, _ g: Geo) {
        let m = min(g.W, g.H)
        let rw = clamp(min(g.W * 0.28, g.H * 0.42), 100, 330)
        let sw = clamp(m * 0.075, 26, 64)
        let cw = clamp(m * 0.11, 44, 110)
        // カニは左右の岩のあいだだけを歩く。貝はその中央寄りに置く
        let half = max(g.W * 0.05, g.W / 2 - rw * 1.25 - cw * 0.5)
        sprite(&ctx, "scallop-shell", x: g.W * 0.5 - half * 0.6, y: g.H * 0.975, w: sw, rot: -0.35)

        let crabX = g.W * 0.5 + CGFloat(sin(clock * 0.000524)) * half
        let crabY = g.H * 0.965
        ctx.fill(
            Path(ellipseIn: CGRect(x: crabX - cw * 0.42, y: crabY - cw * 0.05, width: cw * 0.84, height: cw * 0.1)),
            with: .color(.black.opacity(0.14)))
        sprite(
            &ctx, "sand-crab", x: crabX, y: crabY - CGFloat(abs(sin(clock * 0.012))) * cw * 0.03, w: cw,
            ay: 0.88, rot: sin(clock * 0.012) * 0.04)

        func rock(_ x: CGFloat, _ w: CGFloat, _ flip: Bool) {
            let rh = w * aspect(art.asset("shore-rock"))
            ctx.fill(
                Path(ellipseIn: CGRect(x: x - w * 0.52, y: g.H - rh * 0.1 - rh * 0.1, width: w * 1.04, height: rh * 0.2)),
                with: .color(.black.opacity(0.2)))
            sprite(&ctx, "shore-rock", x: x, y: g.H + rh * 0.16, w: w, ay: 1, flip: flip)
        }
        rock(rw * 0.42, rw, false)
        rock(rw * 0.98, rw * 0.5, true)
        rock(g.W - rw * 0.42, rw, true)
        rock(g.W - rw * 0.98, rw * 0.5, false)
    }

    // MARK: - 絵の描画

    /// 画像を (x, y) に描く。ax/ay は画像上の基準点(0〜1)、flip で左右反転、sy で縦方向の伸縮(羽ばたき)。
    /// 時間帯の色味(tint)は、絵の不透明な部分にだけ重ねる。
    private func sprite(
        _ ctx: inout GraphicsContext, _ name: String, x: CGFloat, y: CGFloat, w: CGFloat,
        ax: CGFloat = 0.5, ay: CGFloat = 0.5, flip: Bool = false, rot: Double = 0, sy: CGFloat = 1, alpha: Double = 1
    ) {
        let asset = art.asset(name)
        let h = w * aspect(asset)
        var c = ctx
        c.translateBy(x: x, y: y)
        if rot != 0 { c.rotate(by: .radians(rot)) }
        c.scaleBy(x: flip ? -1 : 1, y: sy)
        c.opacity = alpha
        let rect = CGRect(x: -w * ax, y: -h * ay, width: w, height: h)
        let image = c.resolve(Image(asset))
        if pal.tint.w > 0.01 {
            let tintColor = color(pal.tint)
            c.drawLayer { layer in
                layer.draw(image, in: rect)
                layer.blendMode = .sourceAtop
                layer.fill(Path(rect), with: .color(tintColor))
            }
        } else {
            c.draw(image, in: rect)
        }
    }
}
