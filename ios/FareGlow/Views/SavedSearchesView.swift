import SwiftUI

struct SavedSearchesView: View {
    @ObservedObject var auth: SupabaseService
    @ObservedObject var history: HistoryStore
    @ObservedObject var search: SearchStore
    let openSearch: () -> Void

    var body: some View {
        NavigationStack {
            List {
                if !history.message.isEmpty { Text(history.message).font(.caption).foregroundStyle(SunriseTheme.muted) }
                if !auth.isSignedIn {
                    ContentUnavailableView("Sign in to sync saved searches", systemImage: "person.crop.circle", description: Text("Your saved iPhone searches stay separate from the website’s list."))
                } else if history.savedSearches.isEmpty {
                    ContentUnavailableView("No saved searches", systemImage: "bookmark", description: Text("Save a route and date window from the Search tab."))
                } else {
                    ForEach(history.savedSearches) { item in
                        HStack(spacing: 10) {
                            Button {
                                search.restore(item)
                                openSearch()
                            } label: {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("\(place(item.search.origin)) → \(place(item.search.destination))").font(.subheadline.weight(.semibold)).foregroundStyle(SunriseTheme.ink)
                                    Text("\(item.search.dateFrom) – \(item.search.dateTo) · \(item.search.pairsPerRequest) pairs/request")
                                        .font(.caption).foregroundStyle(SunriseTheme.muted)
                                }.frame(maxWidth: .infinity, alignment: .leading)
                            }.buttonStyle(.plain)
                            Button(role: .destructive) { Task { await history.deleteSaved(item) } } label: { Image(systemName: "trash") }
                                .accessibilityLabel("Delete saved search")
                        }.listRowBackground(SunriseTheme.card)
                    }
                }
            }
            .scrollContentBackground(.hidden).background(SunriseTheme.paper)
            .navigationTitle("Saved searches")
            .toolbar { if history.isLoading { ToolbarItem(placement: .topBarTrailing) { ProgressView() } } }
            .task { await history.reload() }
        }
    }

    private func place(_ value: String) -> String { value.components(separatedBy: " (").first ?? value }
}
