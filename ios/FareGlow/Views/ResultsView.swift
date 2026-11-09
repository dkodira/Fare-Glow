import SwiftUI

struct ResultsView: View {
    @ObservedObject var search: SearchStore
    @ObservedObject var history: HistoryStore
    let isSignedIn: Bool
    let onSignInRequest: () -> Void

    var body: some View {
        if !search.offers.isEmpty {
            VStack(alignment: .leading, spacing: 13) {
                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("YOUR FARE WINDOW").font(.caption2.weight(.bold)).tracking(1).foregroundStyle(SunriseTheme.muted)
                        Text("\(city(search.activeSearch?.origin ?? search.search.origin)) → \(city(search.activeSearch?.destination ?? search.search.destination))")
                            .font(.title3.weight(.bold)).foregroundStyle(SunriseTheme.ink).lineLimit(1)
                    }
                    Spacer()
                    Button {
                        if isSignedIn { Task { await history.save(search.activeSearch ?? search.search) } }
                        else { onSignInRequest() }
                    } label: {
                        Label("Save", systemImage: "bookmark").font(.caption.weight(.semibold))
                    }.buttonStyle(.bordered).tint(SunriseTheme.coralDark)
                }
                Text("Checked \(search.checkedPairs) of \(search.totalPairs) possible date pairs · \(search.keySource)")
                    .font(.caption).foregroundStyle(SunriseTheme.muted)

                ForEach(search.offers.indices, id: \.self) { index in
                    offerCard(search.offers[index], rank: index + 1)
                }

                if search.hasMoreDates {
                    Button {
                        Task { await search.checkMoreDates() }
                    } label: {
                        HStack {
                            if search.isLoading { ProgressView().tint(SunriseTheme.coralDark) }
                            Text(search.isLoading ? "Checking more dates…" : "Check more dates")
                            Spacer()
                            Image(systemName: "arrow.clockwise")
                        }
                        .font(.subheadline.weight(.semibold)).padding(13)
                        .background(SunriseTheme.paper, in: RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(search.isLoading)
                }

                Text("Prices are snapshots. The absolute lowest fare may be on a date pair not checked yet. Confirm the full itinerary and current total on Google Flights.")
                    .font(.caption2).foregroundStyle(SunriseTheme.muted)
                if !history.message.isEmpty {
                    Text(history.message).font(.caption).foregroundStyle(SunriseTheme.muted)
                }
            }
            .sunriseCard()
        }
    }

    private func offerCard(_ offer: FlightOffer, rank: Int) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label(rank == 1 ? "LOWEST RETURN FARE" : "OPTION \(String(format: "%02d", rank))", systemImage: rank == 1 ? "sparkles" : "airplane")
                    .font(.caption2.weight(.bold)).tracking(0.6).foregroundStyle(rank == 1 ? SunriseTheme.coralDark : SunriseTheme.muted)
                Spacer()
                Text(offer.source).font(.caption2).foregroundStyle(SunriseTheme.muted)
            }
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("GO").font(.caption2.weight(.bold)).foregroundStyle(SunriseTheme.muted)
                    Text(formatDate(offer.departureDate)).font(.headline.weight(.bold)).foregroundStyle(SunriseTheme.ink)
                    Text(offer.outboundTime).font(.caption).foregroundStyle(SunriseTheme.muted)
                }
                Spacer(minLength: 8)
                Image(systemName: "arrow.right").foregroundStyle(SunriseTheme.coral)
                Spacer(minLength: 8)
                VStack(alignment: .leading, spacing: 3) {
                    Text("RETURN").font(.caption2.weight(.bold)).foregroundStyle(SunriseTheme.muted)
                    Text(formatDate(offer.returnDate)).font(.headline.weight(.bold)).foregroundStyle(SunriseTheme.ink)
                    Text("Round trip").font(.caption).foregroundStyle(SunriseTheme.muted)
                }
                Spacer(minLength: 8)
                VStack(alignment: .trailing, spacing: 3) {
                    Text(formatPrice(offer.price, currency: activeCurrency)).font(.title3.weight(.bold)).foregroundStyle(SunriseTheme.coralDark)
                    Text("\(search.activeSearch?.travellers ?? search.search.travellers) travelers").font(.caption2).foregroundStyle(SunriseTheme.muted)
                }
            }
            Divider().overlay(SunriseTheme.line)
            HStack(spacing: 10) {
                Label(offer.outboundStops == 0 ? "Nonstop outbound" : "\(offer.outboundStops) stop(s) outbound", systemImage: "airplane")
                Text(offer.duration)
                Text("\(tripDays(offer)) days away")
            }
            .font(.caption2).foregroundStyle(SunriseTheme.muted).lineLimit(1).minimumScaleFactor(0.8)
            if let url = offer.bookingUrl {
                Link(destination: url) {
                    Label("Confirm on Google Flights", systemImage: "arrow.up.right.square")
                        .font(.caption.weight(.semibold)).foregroundStyle(SunriseTheme.coralDark)
                }
            }
        }
        .padding(13)
        .background(rank == 1 ? Color(hex: 0xFFF4EC) : Color(hex: 0xFFFAF5), in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(rank == 1 ? Color(hex: 0xEFCEBF) : SunriseTheme.line, lineWidth: 1))
    }

    private var activeCurrency: String { search.activeSearch?.currency ?? search.search.currency }

    private func city(_ value: String) -> String { value.components(separatedBy: " (").first ?? value }

    private func formatPrice(_ amount: Int, currency: String) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currency
        formatter.locale = .current
        return formatter.string(from: NSNumber(value: amount)) ?? "\(currency) \(amount)"
    }

    private func formatDate(_ value: String) -> String {
        guard let date = FareSearch.date(value) else { return value }
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: date)
    }

    private func tripDays(_ offer: FlightOffer) -> Int {
        guard let start = FareSearch.date(offer.departureDate), let end = FareSearch.date(offer.returnDate) else { return 0 }
        return (Calendar.current.dateComponents([.day], from: start, to: end).day ?? 0) + 1
    }
}
