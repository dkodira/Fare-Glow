import SwiftUI

struct SearchHistoryView: View {
    @ObservedObject var auth: SupabaseService
    @ObservedObject var history: HistoryStore
    @ObservedObject var search: SearchStore
    let openSearch: () -> Void

    var body: some View {
        NavigationStack {
            List {
                if !history.message.isEmpty { Text(history.message).font(.caption).foregroundStyle(SunriseTheme.muted) }
                if history.history.isEmpty {
                    ContentUnavailableView(auth.isSignedIn ? "No recent searches" : "No searches on this iPhone", systemImage: "clock.arrow.circlepath", description: Text(auth.isSignedIn ? "Your iPhone search history will appear here." : "Searches made while signed out are stored on this iPhone."))
                } else {
                    ForEach(history.history) { item in
                        Button {
                            search.restore(item)
                            openSearch()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(place(item.search.origin)) → \(place(item.search.destination))").font(.subheadline.weight(.semibold)).foregroundStyle(SunriseTheme.ink)
                                Text("\(item.search.dateFrom) – \(item.search.dateTo) · checked \(item.checked)/\(item.total)")
                                    .font(.caption).foregroundStyle(SunriseTheme.muted)
                                if let best = item.offers.first { Text("Lowest found: \(best.price) \(item.search.currency)").font(.caption2.weight(.semibold)).foregroundStyle(SunriseTheme.coralDark) }
                            }.frame(maxWidth: .infinity, alignment: .leading)
                        }.listRowBackground(SunriseTheme.card)
                    }
                }
            }
            .scrollContentBackground(.hidden).background(SunriseTheme.paper)
            .navigationTitle("Recent searches")
            .toolbar {
                if !history.history.isEmpty {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Clear") { Task { await history.clearHistory() } }.font(.subheadline)
                    }
                }
            }
            .task { await history.reload() }
        }
    }

    private func place(_ value: String) -> String { value.components(separatedBy: " (").first ?? value }
}
