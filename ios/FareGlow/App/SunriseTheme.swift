import SwiftUI

enum SunriseTheme {
    static let paper = Color(hex: 0xFBF5EC)
    static let card = Color(hex: 0xFFFDFA)
    static let ink = Color(hex: 0x29384C)
    static let muted = Color(hex: 0x738092)
    static let coral = Color(hex: 0xE97961)
    static let coralDark = Color(hex: 0xCF614D)
    static let sage = Color(hex: 0xDCE5D7)
    static let sky = Color(hex: 0xDCEEF2)
    static let line = Color(hex: 0xE9DFD4)
    static let gold = Color(hex: 0xE8B66E)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}

struct SunriseCard: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(SunriseTheme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(SunriseTheme.line, lineWidth: 1))
            .shadow(color: SunriseTheme.ink.opacity(0.045), radius: 14, y: 5)
    }
}

extension View {
    func sunriseCard() -> some View { modifier(SunriseCard()) }
}
