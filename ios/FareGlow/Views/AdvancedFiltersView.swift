import SwiftUI

struct AdvancedFiltersView: View {
    @Binding var filters: AdvancedFilters

    private let airlines = [
        ("AC", "Air Canada"), ("WS", "WestJet"), ("PD", "Porter Airlines"), ("TS", "Air Transat"), ("F8", "Flair Airlines"),
        ("AA", "American Airlines"), ("UA", "United Airlines"), ("DL", "Delta Air Lines"), ("AS", "Alaska Airlines"),
        ("BA", "British Airways"), ("AF", "Air France"), ("KL", "KLM"), ("LH", "Lufthansa"), ("EK", "Emirates"),
        ("QR", "Qatar Airways"), ("NH", "ANA"), ("JL", "Japan Airlines"),
    ]
    private let times = [("", "Any time"), ("4,7", "Early morning · 4–8am"), ("8,11", "Morning · 8am–noon"), ("12,15", "Afternoon · noon–4pm"), ("16,19", "Evening · 4–8pm"), ("20,23", "Late evening · 8pm–midnight")]
    private let durations = [(0, "No limit"), (360, "Up to 6 hours"), (480, "Up to 8 hours"), (600, "Up to 10 hours"), (720, "Up to 12 hours"), (960, "Up to 16 hours"), (1200, "Up to 20 hours"), (1440, "Up to 24 hours"), (1800, "Up to 30 hours")]
    private let layovers = [("", "Any layover"), ("90,210", "1.5–3.5 hours"), ("90,330", "1.5–5.5 hours"), ("120,360", "2–6 hours"), ("180,480", "3–8 hours")]

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            Picker("Stops · each direction", selection: $filters.stops) {
                Text("Any number").tag("any")
                Text("Nonstop only").tag("nonstop")
                Text("1 stop or fewer").tag("one")
                Text("2 stops or fewer").tag("two")
            }.pickerStyle(.menu)

            Picker("Carry-on bags", selection: $filters.carryOn) {
                Text("No preference").tag(0)
                Text("At least 1").tag(1)
                Text("At least 2").tag(2)
            }.pickerStyle(.menu)

            Picker("Airline preference", selection: Binding(get: { filters.airlineMode }, set: { mode in
                filters.airlineMode = mode
                if mode == "any" { filters.airlines = [] }
            })) {
                Text("Any airline").tag("any")
                Text("Only airlines I choose").tag("include")
                Text("Avoid airlines I choose").tag("exclude")
            }.pickerStyle(.menu)

            if filters.airlineMode != "any" {
                VStack(alignment: .leading, spacing: 4) {
                    Text(filters.airlineMode == "include" ? "CHOOSE AIRLINES TO INCLUDE" : "CHOOSE AIRLINES TO AVOID")
                        .font(.caption2.weight(.bold)).tracking(0.7).foregroundStyle(SunriseTheme.muted)
                    ForEach(airlines.indices, id: \.self) { index in
                        let (code, name) = airlines[index]
                        Toggle(isOn: airlineBinding(code)) {
                            HStack { Text(name); Spacer(); Text(code).font(.caption.monospaced()).foregroundStyle(SunriseTheme.muted) }
                        }
                        .font(.caption).tint(SunriseTheme.coral)
                    }
                }
                .padding(10).background(SunriseTheme.paper, in: RoundedRectangle(cornerRadius: 12))
            }

            HStack {
                Text("Maximum total fare").font(.subheadline)
                Spacer(minLength: 8)
                TextField("No limit", text: $filters.maxPrice)
                    .keyboardType(.numberPad).multilineTextAlignment(.trailing).frame(width: 110)
                    .accessibilityLabel("Maximum total fare in selected currency")
            }
            .padding(10).background(SunriseTheme.paper, in: RoundedRectangle(cornerRadius: 10))

            Picker("Outbound departure time", selection: $filters.outboundTime) {
                ForEach(times.indices, id: \.self) { index in Text(times[index].1).tag(times[index].0) }
            }.pickerStyle(.menu)
            Picker("Return departure time", selection: $filters.returnTime) {
                ForEach(times.indices, id: \.self) { index in Text(times[index].1).tag(times[index].0) }
            }.pickerStyle(.menu)
            Picker("Maximum flight time · each way", selection: $filters.maxDuration) {
                ForEach(durations.indices, id: \.self) { index in Text(durations[index].1).tag(durations[index].0) }
            }.pickerStyle(.menu)
            Picker("Layover length", selection: $filters.layover) {
                ForEach(layovers.indices, id: \.self) { index in Text(layovers[index].1).tag(layovers[index].0) }
            }.pickerStyle(.menu)
            Picker("Travel cabin", selection: $filters.cabin) {
                Text("Economy").tag(1)
                Text("Premium economy").tag(2)
                Text("Business").tag(3)
                Text("First class").tag(4)
            }.pickerStyle(.menu)
            Picker("Sort offers by", selection: $filters.sortBy) {
                Text("Recommended").tag(1)
                Text("Lowest price").tag(2)
                Text("Earliest outbound").tag(3)
                Text("Earliest return arrival").tag(4)
                Text("Shortest flight time").tag(5)
                Text("Lowest emissions").tag(6)
            }.pickerStyle(.menu)

            TextField("Excluded connection airports · e.g. LHR, JFK", text: excludedAirportBinding)
                .textInputAutocapitalization(.characters).autocorrectionDisabled()
                .font(.subheadline).padding(10).background(SunriseTheme.paper, in: RoundedRectangle(cornerRadius: 10))
                .accessibilityLabel("Excluded connection airports")
            Toggle("Prefer lower-emission flights", isOn: $filters.lowEmissions).font(.subheadline).tint(SunriseTheme.coral)
            Text("Airline and airport choices use IATA codes. Some filters depend on the details SerpApi returns.")
                .font(.caption2).foregroundStyle(SunriseTheme.muted)
        }
        .tint(SunriseTheme.coralDark)
    }

    private func airlineBinding(_ code: String) -> Binding<Bool> {
        Binding(
            get: { filters.airlines.contains(code) },
            set: { selected in
                if selected, !filters.airlines.contains(code) { filters.airlines.append(code) }
                else if !selected { filters.airlines.removeAll { $0 == code } }
            }
        )
    }

    private var excludedAirportBinding: Binding<String> {
        Binding(
            get: { filters.excludedAirports.joined(separator: ", ") },
            set: { value in filters.excludedAirports = value.uppercased().split(separator: ",").map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty } }
        )
    }
}
