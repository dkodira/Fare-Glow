import SwiftUI

struct AirportField: View {
    let title: String
    @Binding var text: String
    @State private var suggestions: [Airport] = []
    @State private var lookupError = ""
    @FocusState private var isFocused: Bool

    private let api = FareGlowAPI(configuration: .current, auth: .shared)

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.caption2.weight(.bold)).tracking(0.8).foregroundStyle(SunriseTheme.muted)
            HStack(spacing: 9) {
                Image(systemName: "mappin.and.ellipse").foregroundStyle(SunriseTheme.coral)
                TextField(title == "FROM" ? "City or airport" : "Destination", text: $text)
                    .textInputAutocapitalization(.words).autocorrectionDisabled()
                    .focused($isFocused).accessibilityLabel(title == "FROM" ? "Origin city or airport" : "Destination city or airport")
            }
            .padding(.horizontal, 12).frame(height: 48)
            .background(Color(hex: 0xFFFAF5), in: RoundedRectangle(cornerRadius: 11))
            .overlay(RoundedRectangle(cornerRadius: 11).stroke(SunriseTheme.line, lineWidth: 1))

            if isFocused && !suggestions.isEmpty {
                VStack(spacing: 0) {
                    ForEach(suggestions) { airport in
                        Button {
                            text = airport.label
                            suggestions = []
                            isFocused = false
                        } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(airport.label).font(.subheadline.weight(.semibold)).foregroundStyle(SunriseTheme.ink)
                                Text("\(airport.name) · \(airport.country)").font(.caption).foregroundStyle(SunriseTheme.muted).lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading).padding(10)
                        }.buttonStyle(.plain)
                        if airport.id != suggestions.last?.id { Divider() }
                    }
                }
                .background(SunriseTheme.card, in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(SunriseTheme.line, lineWidth: 1))
            } else if !lookupError.isEmpty {
                Text(lookupError).font(.caption2).foregroundStyle(SunriseTheme.muted)
            }
        }
        .task(id: text) {
            suggestions = []
            lookupError = ""
            let query = text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard query.count >= 2, isFocused else { return }
            try? await Task.sleep(for: .milliseconds(250))
            guard !Task.isCancelled else { return }
            do { suggestions = try await api.airports(query: query) }
            catch { lookupError = "Airport suggestions are unavailable. You can still enter an IATA code." }
        }
    }
}
